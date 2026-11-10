import { useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowLeft, FileUp, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useSession } from "@/hooks/use-session";
import { cn } from "@/lib/utils";
import { useComercial } from "../ComercialContext";
import { useImportLeads } from "../hooks/use-comercial";
import { SIZES, type Stage } from "../lib/rules";
import { findDuplicates, MAX_IMPORT_ROWS, normalizeInstagram, normalizePhone, parseContacts, phoneHasDdd } from "../lib/import-contacts";

interface Row {
  key: number;
  name: string;
  specialty: string;
  instagram: string;
  phone: string;
  raw: string;
  /** marcado para criar; duplicado já nasce desmarcado */
  include: boolean;
}

const EXAMPLE = `Dra. Ana Souza - Dermatologista - @draanasouza - (86) 99999-1234
Dr. Carlos Lima, Pediatra, instagram.com/drcarloslima
Clínica Sorriso | Odontologia | 86988887777`;

const FILE_ACCEPT = ".csv,.tsv,.txt,.xlsx,.xls";

async function readFileAsText(file: File): Promise<string> {
  if (/\.(xlsx|xls)$/i.test(file.name)) {
    const XLSX = await import("xlsx");
    const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    return XLSX.utils.sheet_to_csv(sheet, { FS: "\t", blankrows: false });
  }
  return file.text();
}

/** Importação em massa de contatos para a primeira coluna do funil: cola a lista, confere na tabela e cria um lead por contato. */
export function ImportarContatosDialog({ open, onClose, stage }: { open: boolean; onClose: () => void; stage: Stage }) {
  const { allLeads: leads, team, today, stageOf } = useComercial();
  const { user } = useSession();
  const importLeads = useImportLeads();
  const fileRef = useRef<HTMLInputElement>(null);

  const [text, setText] = useState("");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [truncated, setTruncated] = useState(false);

  const owner = team.find((m) => m.user_id === user?.id) ?? null;

  const reset = () => { setText(""); setRows(null); setTruncated(false); };
  const close = () => { reset(); onClose(); };

  const existing = useMemo(() => leads.map((l) => ({ id: l.id, name: l.name, phone: l.phone, instagram: l.instagram })), [leads]);
  const dups = useMemo(() => (rows ? findDuplicates(rows, existing) : []), [rows, existing]);

  const read = (source: string) => {
    const parsed = parseContacts(source);
    if (parsed.length === 0) { toast.error("Não encontrei nenhum contato no texto."); return; }
    const cut = parsed.slice(0, MAX_IMPORT_ROWS);
    setTruncated(parsed.length > MAX_IMPORT_ROWS);
    const base: Row[] = cut.map((c, i) => ({ key: i, name: c.name, specialty: c.specialty, instagram: c.instagram, phone: c.phone, raw: c.raw, include: true }));
    const d = findDuplicates(base, existing);
    setRows(base.map((r, i) => ({ ...r, include: !d[i] })));
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const content = await readFileAsText(file);
      setText(content);
      read(content);
    } catch {
      toast.error("Não consegui ler esse arquivo. Use CSV, TXT ou Excel (.xlsx).");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const patch = (key: number, p: Partial<Row>) => setRows((prev) => prev && prev.map((r) => (r.key === key ? { ...r, ...p } : r)));
  const remove = (key: number) => setRows((prev) => prev && prev.filter((r) => r.key !== key));

  const missingName = rows ? rows.filter((r) => r.include && !r.name.trim()).length : 0;
  const ready = rows ? rows.filter((r) => r.include && r.name.trim()) : [];
  const dupCount = rows ? rows.filter((_, i) => dups[i]).length : 0;

  const confirm = () => {
    if (!rows || ready.length === 0) return;
    importLeads.mutate(
      {
        leads: ready.map((r) => ({
          name: r.name.trim(),
          segment: r.specialty.trim() || null,
          instagram: normalizeInstagram(r.instagram) || null,
          phone: normalizePhone(r.phone) || null,
          source: "Prospecção ativa",
          owner_id: owner?.user_id ?? null,
          stage_id: stage.id,
          value: 0,
          services: [],
          size: SIZES[1],
        })),
        firstAction: { type: "Primeira abordagem", title: "Fazer a primeira abordagem", due_date: today },
      },
      {
        onSuccess: (n) => {
          toast.success(n === 1 ? "1 contato adicionado" : `${n} contatos adicionados`);
          close();
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar contatos</DialogTitle>
          <DialogDescription>
            Cada linha vira um card em “{stageOf(stage.id)?.name ?? stage.name}”, com origem “Prospecção ativa”{owner ? ` e ${owner.display_name} como responsável` : ""}.
          </DialogDescription>
        </DialogHeader>

        {!rows ? (
          <div className="space-y-3">
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={EXAMPLE}
              className="min-h-[260px] font-mono text-xs"
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Uma linha por contato: nome, especialidade, Instagram (@perfil ou link) e telefone, separados por “-”, vírgula, “|”, “;” ou tab. O que faltar fica em branco.
              Planilha com cabeçalho (Nome, Especialidade, Instagram, Telefone) também funciona.
            </p>
            <DialogFooter className="gap-2 sm:justify-between sm:space-x-0">
              <div>
                <input ref={fileRef} type="file" accept={FILE_ACCEPT} className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} />
                <Button type="button" variant="outline" className="gap-1.5" onClick={() => fileRef.current?.click()}>
                  <FileUp className="h-4 w-4" /> Enviar CSV ou planilha
                </Button>
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="ghost" onClick={close}>Cancelar</Button>
                <Button type="button" disabled={!text.trim()} onClick={() => read(text)}>Ler contatos</Button>
              </div>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <b className="tabular-nums">{ready.length === 1 ? "1 contato será criado" : `${ready.length} contatos serão criados`}</b>
              {dupCount > 0 && <span className="text-amber-600 dark:text-amber-400">{dupCount} duplicado{dupCount > 1 ? "s" : ""} (desmarcado{dupCount > 1 ? "s" : ""} por padrão)</span>}
              {missingName > 0 && <span className="text-red-500">{missingName} sem nome: preencha para criar</span>}
              {truncated && <span className="text-muted-foreground">Mostrando as primeiras {MAX_IMPORT_ROWS} linhas.</span>}
            </div>

            <div className="max-h-[56vh] overflow-auto rounded-xl border border-border/50">
              <table className="w-full min-w-[760px] text-xs">
                <thead className="sticky top-0 z-10 bg-muted text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="w-10 px-2 py-2">Criar</th>
                    <th className="px-2 py-2">Nome</th>
                    <th className="px-2 py-2">Especialidade</th>
                    <th className="px-2 py-2">Instagram</th>
                    <th className="px-2 py-2">Telefone</th>
                    <th className="w-10 px-2 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => {
                    const dup = dups[i];
                    const noName = !r.name.trim();
                    const badIg = r.instagram.trim() !== "" && !normalizeInstagram(r.instagram);
                    const badPhone = r.phone.trim() !== "" && !normalizePhone(r.phone);
                    const note = dup
                      ? dup.kind === "crm"
                        ? `Já está no CRM como “${dup.label}” (mesmo ${dup.by})`
                        : `Repetido (mesmo ${dup.by} da ${dup.label})`
                      : null;
                    const warn = noName ? "Sem nome identificável" : badIg ? "Instagram não reconhecido: não será salvo" : badPhone ? "Telefone não reconhecido: não será salvo" : normalizePhone(r.phone) && !phoneHasDdd(normalizePhone(r.phone)) ? "Telefone sem DDD" : null;
                    return (
                      <tr key={r.key} className={cn("border-t border-border/40 align-top", dup && "bg-amber-500/5", noName && r.include && "bg-red-500/5")}>
                        <td className="px-2 py-1.5">
                          <Checkbox checked={r.include} onCheckedChange={(c) => patch(r.key, { include: c === true })} aria-label={`Criar ${r.name || "contato sem nome"}`} />
                        </td>
                        <td className="px-1 py-1">
                          <Input
                            value={r.name}
                            onChange={(e) => patch(r.key, { name: e.target.value })}
                            placeholder="Nome (obrigatório)"
                            aria-invalid={noName}
                            className={cn("h-8 text-xs", noName && "border-red-500/70")}
                          />
                          {(note || warn) && (
                            <p className={cn("mt-1 flex items-start gap-1 px-1 text-[11px]", note ? "text-amber-600 dark:text-amber-400" : noName ? "text-red-500" : "text-muted-foreground")}>
                              <AlertTriangle className="mt-px h-3 w-3 shrink-0" /> {note ?? warn}
                            </p>
                          )}
                          {noName && r.raw && <p className="mt-1 truncate px-1 text-[11px] text-muted-foreground" title={r.raw}>Linha: {r.raw}</p>}
                        </td>
                        <td className="px-1 py-1"><Input value={r.specialty} onChange={(e) => patch(r.key, { specialty: e.target.value })} className="h-8 text-xs" /></td>
                        <td className="px-1 py-1"><Input value={r.instagram} onChange={(e) => patch(r.key, { instagram: e.target.value })} placeholder="@perfil" className={cn("h-8 text-xs", badIg && "border-amber-500/70")} /></td>
                        <td className="px-1 py-1"><Input value={r.phone} onChange={(e) => patch(r.key, { phone: e.target.value })} placeholder="DDD + número" inputMode="tel" className={cn("h-8 text-xs", badPhone && "border-amber-500/70")} /></td>
                        <td className="px-1 py-1">
                          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-red-500" onClick={() => remove(r.key)} aria-label="Remover linha">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                  {rows.length === 0 && (
                    <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">Nenhuma linha. Volte e cole outra lista.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <DialogFooter className="gap-2 sm:justify-between sm:space-x-0">
              <Button type="button" variant="ghost" className="gap-1.5" onClick={() => setRows(null)}>
                <ArrowLeft className="h-4 w-4" /> Voltar ao texto
              </Button>
              <div className="flex gap-2">
                <Button type="button" variant="ghost" onClick={close}>Cancelar</Button>
                <Button type="button" disabled={ready.length === 0 || importLeads.isPending} onClick={confirm}>
                  {importLeads.isPending ? "Criando…" : ready.length === 1 ? "Criar 1 contato" : `Criar ${ready.length} contatos`}
                </Button>
              </div>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
