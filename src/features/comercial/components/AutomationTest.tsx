import { useCallback, useEffect, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { BLOCKS, SAVE_TO, condTrue, fillText, usesBusinessHours, type ComercialAutomation, type Step } from "../lib/builder";
import { useComercial } from "../ComercialContext";
import { blockSummary, triggerText } from "../lib/summary";
import { useForms } from "../hooks/use-builder";

type Line = { kind: "sys" | "bot" | "me" | "act"; text: string };

/** "Testar": você faz o papel do lead e o fluxo corre na tela. Nada é enviado nem gravado. */
export function AutomationTest({ automation, open, onClose }: { automation: ComercialAutomation; open: boolean; onClose: () => void }) {
  const { stages, team } = useComercial();
  const forms = useForms().data ?? [];
  const [log, setLog] = useState<Line[]>([]);
  const [ask, setAsk] = useState<{ options: string[]; free: boolean } | null>(null);
  const [free, setFree] = useState("");
  const resolver = useRef<((v: string) => void) | null>(null);
  const runId = useRef(0);
  const box = useRef<HTMLDivElement>(null);

  const push = useCallback((kind: Line["kind"], text: string) => setLog((l) => [...l, { kind, text }]), []);
  const choose = useCallback((options: string[], freeText: boolean) => new Promise<string>((res) => {
    setAsk({ options, free: freeText });
    resolver.current = (v) => { setAsk(null); setFree(""); res(v); };
  }), []);

  const start = useCallback(async () => {
    const me = ++runId.current;
    setLog([]); setAsk(null);
    const lead = { name: "Lead de teste", company: "Empresa Teste", services: [] as string[], tags: [] as string[], segment: "Saúde", source: "WhatsApp" };
    const vars: { answer?: string; replied?: boolean; businessHours?: boolean } = {};
    const answers: Record<string, string> = {};
    const ctx = { stages, team, forms };
    const fill = (t?: string) => fillText(t, lead, { ...answers, origem: lead.source === "Meta Ads" ? "Meta Ads" : "WhatsApp orgânico" });
    push("sys", `Gatilho · ${triggerText(automation.trigger, ctx)}`);
    if (usesBusinessHours(automation.steps)) {
      push("sys", "Esse fluxo muda conforme o horário. Quando o lead chamou?");
      const h = await choose(["Dentro do horário comercial", "Fora do horário comercial"], false);
      if (me !== runId.current) return;
      vars.businessHours = h.startsWith("Dentro"); push("me", h);
    }

    const walk = async (list: Step[]): Promise<"stop" | void> => {
      for (const s of list) {
        if (me !== runId.current) return "stop";
        switch (s.type) {
          case "msg": push("bot", fill(s.text)); break;
          case "ask": {
            const opts = s.options ?? [];
            push("bot", fill(s.text) + (opts.length ? "\n" + opts.map((o, i) => (s.numbered ? `${i + 1}. ${o}` : `• ${o}`)).join("\n") : ""));
            const quiet = !opts.length && !!s.timeoutMinutes;
            const r = await choose(quiet ? [`Não respondeu (segue em ${s.timeoutMinutes} min)`] : opts, !opts.length);
            if (me !== runId.current) return "stop";
            if (quiet && r.startsWith("Não respondeu")) { push("me", "(sem resposta)"); vars.replied = false; push("sys", `Passaram ${s.timeoutMinutes} min sem resposta: o fluxo segue`); break; }
            push("me", r); vars.answer = r; vars.replied = true;
            if (s.saveTo) { answers[s.saveTo === "segment" ? "segmento" : s.saveTo] = r; if (s.saveTo === "segment") lead.segment = r; push("sys", `Resposta salva em ${SAVE_TO[s.saveTo] ?? s.saveTo}`); }
            break;
          }
          case "meet": {
            push("bot", fillText(s.text, lead));
            const r = await choose(s.options ?? [], false);
            if (me !== runId.current) return "stop";
            push("me", r); push("sys", `Reunião registrada · ${r}`);
            break;
          }
          case "form": push("bot", `Preencha aqui: ${blockSummary(s, ctx).main.replace("Link: ", "")}`); break;
          case "wait": {
            push("sys", `Aguardar · ${blockSummary(s, ctx).main}`);
            if (s.until === "resposta") {
              push("sys", "O lead respondeu dentro do prazo?");
              const r = await choose(["Sim, respondeu", "Não respondeu"], false);
              if (me !== runId.current) return "stop";
              vars.replied = r.startsWith("Sim"); push("me", r);
            }
            break;
          }
          case "cond": {
            const ok = condTrue(s, lead, vars);
            push("sys", `Condição · ${blockSummary(s, ctx).main} → caminho ${ok ? "Sim" : "Não"}`);
            if ((await walk((ok ? s.yes : s.no) ?? [])) === "stop") return "stop";
            break;
          }
          case "tag": {
            const tg = fill(s.tag).trim();
            if (tg && !lead.tags.includes(tg)) lead.tags.push(tg);
            push("act", `${BLOCKS[s.type].name} · Etiqueta “${tg}”`); break;
          }
          case "note": push("act", `Anotação interna · ${fill(s.text)}`); break;
          case "end": push("sys", "Fluxo encerrado."); return "stop";
          case "human": push("sys", `Transferido · ${blockSummary(s, ctx).main}. Automação pausada.`); return "stop";
          default: push("act", `${BLOCKS[s.type].name} · ${blockSummary(s, ctx).main}`);
        }
      }
    };
    await walk(automation.steps);
    if (me === runId.current) push("sys", "Fim do fluxo");
  }, [automation, stages, team, forms, push, choose]);

  useEffect(() => {
    if (open) void start();
    return () => { runId.current++; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  useEffect(() => { box.current?.scrollTo({ top: box.current.scrollHeight }); }, [log, ask]);

  const tone: Record<Line["kind"], string> = {
    sys: "self-center bg-muted/50 text-xs text-muted-foreground",
    bot: "self-start bg-card border border-border/50",
    me: "self-end bg-primary text-primary-foreground",
    act: "self-center border border-dashed border-primary/40 bg-primary/5 text-xs",
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Testando: {automation.name}</DialogTitle>
          <DialogDescription>Você faz o papel do lead. Nada é enviado de verdade e nenhum lead é alterado.</DialogDescription>
        </DialogHeader>
        <div ref={box} className="flex max-h-[45vh] min-h-[200px] flex-col gap-2 overflow-y-auto rounded-xl border border-border/50 bg-muted/20 p-3">
          {log.map((l, i) => <div key={i} className={cn("max-w-[88%] whitespace-pre-wrap rounded-xl px-3 py-2 text-sm", tone[l.kind])}>{l.text}</div>)}
        </div>
        {ask && (
          <div className="flex flex-wrap items-center gap-2">
            {ask.options.map((o) => <Button key={o} size="sm" variant="outline" onClick={() => resolver.current?.(o)}>{o}</Button>)}
            {ask.free && (
              <Input autoFocus value={free} onChange={(e) => setFree(e.target.value)} placeholder="Digite a resposta e Enter" className="h-9 min-w-[180px] flex-1"
                onKeyDown={(e) => { if (e.key === "Enter" && free.trim()) resolver.current?.(free.trim()); }} />
            )}
          </div>
        )}
        <DialogFooter className="gap-2">
          <Button variant="outline" className="gap-1.5" onClick={() => void start()}><RotateCcw className="h-3.5 w-3.5" /> Reiniciar teste</Button>
          <Button onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
