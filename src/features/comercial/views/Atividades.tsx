import { useMemo, useState } from "react";
import { MessageCircle, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useComercial } from "../ComercialContext";
import { useSetActivityDone } from "../hooks/use-comercial";
import { diffDays, isOpenStage, nextActivity, shortDate, waLink, type Activity } from "../lib/rules";
import { Empty, OwnerAvatar, PageHead } from "../components/ui-bits";

const ALL = "__all__";

export function Atividades() {
  const { acts, leads, team, today, leadOf, stageOf, memberOf, openLead, newActivity } = useComercial();
  const setDone = useSetActivityDone();
  const [tab, setTab] = useState<"pend" | "done">("pend");
  const [owner, setOwner] = useState("");

  const list = useMemo(() => acts.filter((a) => !owner || a.owner_id === owner), [acts, owner]);
  const pending = useMemo(() => list.filter((a) => !a.done).sort((a, b) => a.due_date.localeCompare(b.due_date)), [list]);
  const groups = tab === "pend"
    ? [
        { k: "late", title: "Atrasadas", tone: "text-red-500", items: pending.filter((a) => diffDays(a.due_date, today) < 0) },
        { k: "today", title: "Hoje", tone: "text-amber-500", items: pending.filter((a) => diffDays(a.due_date, today) === 0) },
        { k: "next", title: "Próximas", tone: "text-foreground", items: pending.filter((a) => diffDays(a.due_date, today) > 0) },
      ]
    : [{ k: "done", title: "Concluídas", tone: "text-emerald-500", items: list.filter((a) => a.done).sort((a, b) => (b.done_at ?? b.due_date).localeCompare(a.done_at ?? a.due_date)) }];
  const withoutAction = leads.filter((l) => isOpenStage(stageOf(l.stage_id)) && !nextActivity(l.id, acts) && (!owner || l.owner_id === owner));

  const complete = (a: Activity, done: boolean) => {
    setDone.mutate({ id: a.id, done }, {
      onSuccess: () => {
        if (!done) return;
        const lead = leadOf(a.lead_id);
        const stillOpen = lead && isOpenStage(stageOf(lead.stage_id));
        const hasNext = acts.some((x) => x.lead_id === a.lead_id && !x.done && x.id !== a.id);
        if (stillOpen && !hasNext) {
          toast("Atividade concluída. Qual o próximo passo?");
          newActivity(a.lead_id);
        } else toast("Atividade concluída");
      },
    });
  };

  const row = (a: Activity) => {
    const lead = leadOf(a.lead_id);
    if (!lead) return null;
    const d = diffDays(a.due_date, today);
    const wa = waLink(lead.phone);
    return (
      <div key={a.id} className={cn("flex items-center gap-3 px-3 py-2.5", a.done && "opacity-60")}>
        <Checkbox checked={a.done} onCheckedChange={(v) => complete(a, v === true)} aria-label="Concluir" />
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{a.type}</div>
          <div className={cn("truncate text-sm", a.done && "line-through")}>{a.title}</div>
          <button type="button" onClick={() => openLead(lead.id)} className="truncate text-xs text-primary hover:underline">
            {lead.name}{lead.company ? ` · ${lead.company}` : ""}
          </button>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className={cn("rounded-md px-1.5 py-0.5 text-[11px] font-medium", a.done ? "bg-emerald-500/10 text-emerald-500" : d < 0 ? "bg-red-500/10 text-red-500" : d === 0 ? "bg-amber-500/10 text-amber-500" : "bg-muted text-muted-foreground")}>
            {a.done ? `feita ${shortDate(a.done_at ?? a.due_date)}` : d === 0 ? "hoje" : shortDate(a.due_date)}
          </span>
          <OwnerAvatar member={memberOf(a.owner_id)} />
          {!a.done && wa && (
            <Button asChild size="sm" variant="outline" className="h-7 gap-1 px-2 text-xs">
              <a href={wa} target="_blank" rel="noopener noreferrer"><MessageCircle className="h-3 w-3" /> WhatsApp</a>
            </Button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-3">
      <PageHead title="Atividades" right={<Button size="sm" className="gap-1.5" onClick={() => newActivity()}><Plus className="h-3.5 w-3.5" /> Nova atividade</Button>} />
      <div className="flex flex-wrap items-center gap-2">
        {([["pend", "Pendentes"], ["done", "Concluídas"]] as const).map(([k, t]) => (
          <button key={k} type="button" aria-pressed={tab === k} onClick={() => setTab(k)}
            className={cn("rounded-full px-3 py-1 text-xs font-medium transition", tab === k ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground")}>
            {t}
          </button>
        ))}
        <Select value={owner || ALL} onValueChange={(v) => setOwner(v === ALL ? "" : v)}>
          <SelectTrigger className="h-8 w-[190px] text-xs" aria-label="Responsável"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos os responsáveis</SelectItem>
            {team.map((m) => <SelectItem key={m.user_id} value={m.user_id}>{m.display_name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-4">
        {groups.filter((g) => g.items.length).map((g) => (
          <section key={g.k} className="overflow-hidden rounded-2xl border border-border/50 bg-card">
            <h3 className={cn("flex items-center gap-2 border-b border-border/50 px-3 py-2 text-sm font-semibold", g.tone)}>
              {g.title}<span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground">{g.items.length}</span>
            </h3>
            <div className="divide-y divide-border/30">{g.items.map(row)}</div>
          </section>
        ))}
        {groups.every((g) => g.items.length === 0) && <Empty>Nenhuma atividade aqui.</Empty>}
        {tab === "pend" && withoutAction.length > 0 && (
          <section className="overflow-hidden rounded-2xl border border-border/50 bg-card">
            <h3 className="flex items-center gap-2 border-b border-border/50 px-3 py-2 text-sm font-semibold">
              Negócios sem próxima ação<span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground">{withoutAction.length}</span>
            </h3>
            <div className="divide-y divide-border/30">
              {withoutAction.map((l) => (
                <div key={l.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{l.name}</div>
                    <button type="button" onClick={() => openLead(l.id)} className="truncate text-xs text-primary hover:underline">{l.company} · {stageOf(l.stage_id)?.name}</button>
                  </div>
                  <Button size="sm" variant="outline" className="h-7 gap-1 px-2 text-xs" onClick={() => newActivity(l.id)}><Plus className="h-3 w-3" /> Próxima ação</Button>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
