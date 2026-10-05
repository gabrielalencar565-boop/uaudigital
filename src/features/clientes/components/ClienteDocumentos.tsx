import { useRef, useState } from "react";
import { ChevronDown, Copy, ExternalLink, Pencil, FileText, FolderOpen, Link2, Paperclip, Palette, Plus, ScrollText, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { usePermission } from "@/hooks/use-permission";
import { useClientDriveFolder } from "@/features/admin/hooks/use-drive-connection";
import { ClienteAcessos } from "./ClienteAcessos";
import {
  openClientDocument, useAddClientDocument, useClientDocuments, useDeleteClientDocument, useUpdateClientDocument,
  type ClientDocument, type DocumentKind,
} from "../hooks/use-client-data";

// Alphabetical, with "Acessos" (logins, rendered by ClienteAcessos) always first.
const BLOCKS: { kind: DocumentKind; label: string; icon: typeof FileText }[] = [
  { kind: "briefing", label: "Briefing", icon: ScrollText },
  { kind: "contrato", label: "Contrato", icon: FileText },
  { kind: "marca", label: "Manual da marca", icon: Palette },
  { kind: "outro", label: "Outros", icon: Link2 },
  { kind: "drive", label: "Pasta no Drive", icon: FolderOpen },
];

const MAX_FILE_BYTES = 50 * 1024 * 1024;

const hostOf = (url: string) => {
  try { return new URL(url).host.replace(/^www\./, ""); } catch { return url; }
};
const sizeLabel = (bytes: number | null) => {
  if (!bytes) return "";
  return bytes > 1_048_576 ? `${(bytes / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
};

function AddForm({ clientId, kind, onClose }: { clientId: string; kind: DocumentKind; onClose: () => void }) {
  const add = useAddClientDocument(clientId);
  const fileRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<"link" | "file">("link");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [dragging, setDragging] = useState(false);

  const normalizedUrl = /^https?:\/\//i.test(url.trim()) ? url.trim() : url.trim() ? `https://${url.trim()}` : "";
  const fallbackTitle = mode === "file" ? file?.name ?? "" : normalizedUrl ? hostOf(normalizedUrl) : "";
  const finalTitle = title.trim() || fallbackTitle;
  const valid = finalTitle.length > 0 && (mode === "link" ? !!normalizedUrl : !!file);

  const pick = (f: File | undefined | null) => {
    if (!f) return;
    if (f.size > MAX_FILE_BYTES) {
      toast.error("O arquivo passa de 50 MB.");
      return;
    }
    setFile(f);
  };

  const submit = () => {
    if (!valid) return;
    add.mutate(
      mode === "link"
        ? { title: finalTitle, kind, note: null, url: normalizedUrl }
        : { title: finalTitle, kind, note: null, file: file! },
      { onSuccess: onClose },
    );
  };

  return (
    <div className="space-y-3 border-t border-border/30 pt-4">
      <div className="flex w-fit gap-0.5 rounded-full bg-muted/50 p-0.5 text-xs">
        {([["link", "Link", Link2], ["file", "Arquivo", Paperclip]] as const).map(([key, label, Icon]) => (
          <button
            key={key}
            type="button"
            onClick={() => setMode(key)}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3 py-1 font-medium transition-colors",
              mode === key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="h-3 w-3" /> {label}
          </button>
        ))}
      </div>

      {mode === "link" ? (
        <Input autoFocus value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Cole o link (Drive, Notion, Canva…)" className="h-9 rounded-lg" />
      ) : (
        <>
          <input ref={fileRef} type="file" className="hidden" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); pick(e.dataTransfer.files?.[0]); }}
            className={cn(
              "flex w-full flex-col items-center gap-1 rounded-xl border border-dashed px-3 py-5 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground",
              dragging ? "border-primary/60 bg-primary/5" : "border-border/50",
            )}
          >
            {file ? (
              <>
                <Paperclip className="h-4 w-4 text-primary" />
                <span className="max-w-full truncate font-medium text-foreground">{file.name}</span>
                <span>{sizeLabel(file.size)} · clique para trocar</span>
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                <span>Arraste um arquivo ou clique para escolher</span>
                <span className="opacity-70">até 50 MB</span>
              </>
            )}
          </button>
        </>
      )}

      <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={fallbackTitle ? `Nome (padrão: ${fallbackTitle})` : "Nome (opcional)"} className="h-9 rounded-lg" />

      <div className="flex justify-end gap-1.5">
        <Button variant="ghost" size="sm" className="rounded-full" onClick={onClose}>Cancelar</Button>
        <Button size="sm" className="rounded-full" disabled={!valid || add.isPending} onClick={submit}>
          {add.isPending ? "Salvando…" : "Salvar"}
        </Button>
      </div>
    </div>
  );
}

function EditForm({ clientId, doc, onClose }: { clientId: string; doc: ClientDocument; onClose: () => void }) {
  const update = useUpdateClientDocument(clientId);
  const isFile = !!doc.storage_path;
  const [title, setTitle] = useState(doc.title);
  const [url, setUrl] = useState(doc.url ?? "");
  const normalizedUrl = /^https?:\/\//i.test(url.trim()) ? url.trim() : url.trim() ? `https://${url.trim()}` : "";
  const valid = title.trim().length > 0 && (isFile || normalizedUrl.length > 0);
  const dirty = title.trim() !== doc.title || (!isFile && normalizedUrl !== doc.url);

  return (
    <div className="space-y-2 rounded-lg bg-muted/30 p-2.5">
      <Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nome" className="h-9 rounded-lg" />
      {!isFile && <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Link" className="h-9 rounded-lg" />}
      <div className="flex justify-end gap-1.5">
        <Button variant="ghost" size="sm" className="rounded-full" onClick={onClose}>Cancelar</Button>
        <Button
          size="sm"
          className="rounded-full"
          disabled={!valid || !dirty || update.isPending}
          onClick={() => update.mutate({ id: doc.id, title: title.trim(), ...(isFile ? {} : { url: normalizedUrl }) }, { onSuccess: onClose })}
        >
          Salvar
        </Button>
      </div>
    </div>
  );
}

function DocRow({ doc, onEdit, onDelete }: { doc: ClientDocument; onEdit: () => void; onDelete: () => void }) {
  const isFile = !!doc.storage_path;
  return (
    <div className="group flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-muted/40">
      {isFile ? <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /> : <Link2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
      <button type="button" onClick={() => openClientDocument(doc)} className="min-w-0 flex-1 text-left">
        <span className="block truncate text-sm font-medium">{doc.title}</span>
        <span className="block truncate text-[11px] text-muted-foreground">
          {isFile ? [doc.file_name, sizeLabel(doc.file_size)].filter(Boolean).join(" · ") : hostOf(doc.url ?? "")}
        </span>
      </button>
      <div className="flex shrink-0 items-center opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
        <button type="button" aria-label="Abrir" onClick={() => openClientDocument(doc)} className="rounded-full p-1.5 text-muted-foreground hover:text-foreground">
          <ExternalLink className="h-3.5 w-3.5" />
        </button>
        {doc.url && (
          <button
            type="button"
            aria-label="Copiar link"
            className="rounded-full p-1.5 text-muted-foreground hover:text-foreground"
            onClick={() => { navigator.clipboard.writeText(doc.url!); toast.success("Link copiado!"); }}
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
        )}
        <button type="button" aria-label="Editar" onClick={onEdit} className="rounded-full p-1.5 text-muted-foreground hover:text-foreground">
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button type="button" aria-label="Remover" onClick={onDelete} className="rounded-full p-1.5 text-muted-foreground hover:text-destructive">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

export function ClienteDocumentos({ clientId }: { clientId: string }) {
  const canSeeLogins = usePermission("action_client_credentials");
  const driveFolderQ = useClientDriveFolder(clientId);
  const driveFolderId = driveFolderQ.data ?? null;
  const docsQ = useClientDocuments(clientId);
  const remove = useDeleteClientDocument(clientId);
  const [adding, setAdding] = useState<DocumentKind | null>(null);
  const [expanded, setExpanded] = useState<Set<DocumentKind>>(new Set());
  const toggleExpanded = (k: DocumentKind) => setExpanded((prev) => { const n = new Set(prev); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const openAdd = (k: DocumentKind) => { setAdding(k); setExpanded((prev) => new Set(prev).add(k)); };
  const [editing, setEditing] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<ClientDocument | null>(null);
  const docs = docsQ.data ?? [];

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold">Pasta do cliente</h3>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {canSeeLogins && <ClienteAcessos clientId={clientId} />}
        {BLOCKS.map((b) => {
          const items = docs.filter((d) => d.kind === b.kind);
          const open = adding === b.kind;
          const isExpanded = expanded.has(b.kind);
          return (
            <section key={b.kind} className="flex flex-col rounded-2xl border border-border/30 p-4 transition-colors hover:border-border/60">
              <div className="flex items-center gap-2.5">
                <b.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                {items.length > 0 ? (
                  <button type="button" onClick={() => toggleExpanded(b.kind)} aria-expanded={isExpanded} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                    <h4 className="min-w-0 truncate text-sm font-medium">{b.label}</h4>
                    <span className="text-xs tabular-nums text-muted-foreground">{items.length}</span>
                    <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform", isExpanded && "rotate-180")} />
                  </button>
                ) : (
                  <h4 className="min-w-0 flex-1 truncate text-sm font-medium">{b.label}</h4>
                )}
                {b.kind === "drive" && driveFolderId && (
                  <a
                    href={`https://drive.google.com/drive/folders/${driveFolderId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    Abrir pasta <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                <button
                  type="button"
                  aria-label={open ? "Fechar" : `Adicionar em ${b.label}`}
                  onClick={() => (open ? setAdding(null) : openAdd(b.kind))}
                  className={cn(
                    "grid h-7 w-7 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                    open && "bg-muted text-foreground",
                  )}
                >
                  {open ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                </button>
              </div>

              {items.length > 0 ? (
                isExpanded && <div className="-mx-2 mt-3 space-y-0.5">
                  {items.map((d) =>
                    editing === d.id ? (
                      <EditForm key={d.id} clientId={clientId} doc={d} onClose={() => setEditing(null)} />
                    ) : (
                      <DocRow key={d.id} doc={d} onEdit={() => setEditing(d.id)} onDelete={() => setToDelete(d)} />
                    ),
                  )}
                </div>
              ) : (
                !open && (
                  <button
                    type="button"
                    onClick={() => openAdd(b.kind)}
                    className="mt-3 w-fit text-xs text-muted-foreground/70 transition-colors hover:text-foreground"
                  >
                    {docsQ.isLoading ? "Carregando…" : "Adicionar link ou arquivo"}
                  </button>
                )
              )}

              {open && <div className="mt-4"><AddForm clientId={clientId} kind={b.kind} onClose={() => setAdding(null)} /></div>}
            </section>
          );
        })}
      </div>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover "{toDelete?.title}"?</AlertDialogTitle>
            <AlertDialogDescription>
              {toDelete?.storage_path ? "O arquivo será apagado do Fluxo." : "Só o link sai daqui — o arquivo original continua onde está."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (toDelete) remove.mutate(toDelete); setToDelete(null); }}>Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
