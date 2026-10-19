import { supabase } from "@/integrations/supabase/client";

const sb = supabase as any;

// Mesma ideia do randomToken() da função drive-upload: cada cópia de um anexo do Drive precisa do seu próprio access_token.
export function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Navegadores embutidos (WhatsApp/Instagram) recusam tocar <video> de uma URL sem extensão: a URL do proxy precisa de uma.
const MIME_EXTENSIONS: Record<string, string> = {
  "video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm", "video/x-msvideo": "avi",
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "image/DNG": "dng",
  "application/pdf": "pdf", "application/x-zip-compressed": "zip",
};
export const extensionFor = (mime: string | null | undefined) => MIME_EXTENSIONS[mime ?? ""] ?? "bin";

export interface AttachmentRowLike {
  id: string;
  task_id: string | null;
  category?: string | null;
  drive_file_id?: string | null;
  storage_path: string;
  storage_provider?: string | null;
  file_type?: string | null;
  [k: string]: unknown;
}

/** Uma cópia do anexo para outra tarefa: o arquivo é o mesmo, mas a linha de um arquivo do Drive ganha o próprio token. */
export function cloneAttachmentRow(att: AttachmentRowLike, taskId: string): Record<string, unknown> {
  const { id: _id, created_at: _created, ...rest } = att as Record<string, unknown>;
  const row: Record<string, unknown> = { ...rest, task_id: taskId };
  if (att.storage_provider === "drive" && att.drive_file_id) {
    const token = randomToken();
    row.access_token = token;
    row.public_url = `https://bzzubzjbsjwuvchuhklr.supabase.co/functions/v1/drive-file-proxy/${att.drive_file_id}.${extensionFor(att.file_type)}?t=${token}`;
  }
  return row;
}

/** As outras linhas do mesmo arquivo final (as cópias feitas quando a etapa avançou). Só vale para os anexos do Conteúdo final. */
export async function sameFileRows(att: AttachmentRowLike): Promise<AttachmentRowLike[]> {
  if (att.category !== "final") return [];
  let q = sb.from("pm_attachments").select("*").neq("id", att.id).eq("category", "final");
  q = att.drive_file_id ? q.eq("drive_file_id", att.drive_file_id) : q.eq("storage_path", att.storage_path);
  const { data } = await q;
  return (data ?? []) as AttachmentRowLike[];
}

/** As outras etapas do mesmo post (cópias ligadas pela chave do post). Posts antigos, sem chave, não têm ligação. */
export async function linkedPostTaskIds(taskId: string): Promise<string[]> {
  const { data: t } = await sb.from("pm_tasks").select("id, post_key").eq("id", taskId).maybeSingle();
  if (!t) return [];
  const key: string = t.post_key ?? t.id;
  const { data } = await sb.from("pm_tasks").select("id").is("deleted_at", null).neq("id", taskId).or(`id.eq.${key},post_key.eq.${key}`);
  return (data ?? []).map((r: { id: string }) => r.id);
}

/** Copia anexos finais recém-enviados para as outras etapas do mesmo post (sem duplicar quem já tem o arquivo). */
export async function copyToLinkedTasks(rows: AttachmentRowLike[], fromTaskId: string): Promise<number> {
  const finals = rows.filter((r) => r.category === "final");
  if (finals.length === 0) return 0;
  const taskIds = await linkedPostTaskIds(fromTaskId);
  if (taskIds.length === 0) return 0;
  const { data: existing } = await sb.from("pm_attachments").select("task_id, drive_file_id, storage_path").in("task_id", taskIds).eq("category", "final");
  const has = new Set((existing ?? []).map((e: { task_id: string; drive_file_id: string | null; storage_path: string }) => `${e.task_id}|${e.drive_file_id ?? e.storage_path}`));
  const inserts: Record<string, unknown>[] = [];
  for (const tid of taskIds) {
    for (const r of finals) {
      if (has.has(`${tid}|${r.drive_file_id ?? r.storage_path}`)) continue;
      inserts.push(cloneAttachmentRow(r, tid));
    }
  }
  if (inserts.length === 0) return 0;
  const { error } = await sb.from("pm_attachments").insert(inserts);
  if (error) { console.warn("Não consegui copiar o anexo para as outras etapas:", error.message); return 0; }
  return inserts.length;
}

/** Apaga as outras linhas do mesmo arquivo final. Devolve quantas saíram (quem não pode apagar fica de fora, sem erro). */
export async function deleteSameFileRows(att: AttachmentRowLike): Promise<number> {
  const siblings = await sameFileRows(att);
  if (siblings.length === 0) return 0;
  const { data } = await sb.from("pm_attachments").delete().in("id", siblings.map((s) => s.id)).select("id");
  return (data ?? []).length;
}

/** Ainda há alguma linha usando esse arquivo guardado no armazenamento do Fluxo? (para não apagar o arquivo de quem ainda usa) */
export async function storagePathStillUsed(storagePath: string): Promise<boolean> {
  const { count } = await sb.from("pm_attachments").select("id", { count: "exact", head: true }).eq("storage_path", storagePath);
  return (count ?? 0) > 0;
}
