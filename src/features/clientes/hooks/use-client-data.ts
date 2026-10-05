import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

// Tables/columns added for the beta aren't in the generated types yet.
const sb = supabase as any;

export const DOCUMENT_KINDS = ["briefing", "contrato", "marca", "acessos", "drive", "outro"] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

export type ClientDocument = {
  id: string;
  title: string;
  url: string | null;
  kind: DocumentKind;
  note: string | null;
  storage_path: string | null;
  file_name: string | null;
  file_size: number | null;
  created_at: string;
};

const BUCKET = "client-documents";

export function useClientDocuments(clientId: string) {
  return useQuery({
    queryKey: ["client_documents", clientId],
    queryFn: async (): Promise<ClientDocument[]> => {
      const { data, error } = await sb
        .from("client_documents")
        .select("id, title, url, kind, note, storage_path, file_name, file_size, created_at")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

// Uploaded files sit in a private bucket; a short-lived signed link is minted on click.
export async function openClientDocument(doc: ClientDocument) {
  if (doc.url) {
    window.open(doc.url, "_blank", "noreferrer");
    return;
  }
  if (!doc.storage_path) return;
  // Opened synchronously so the browser doesn't treat the tab as a blocked popup after the async call.
  const tab = window.open("", "_blank");
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(doc.storage_path, 300);
  if (error || !data?.signedUrl) {
    tab?.close();
    toast.error("Não foi possível abrir o arquivo.");
    return;
  }
  if (tab) tab.location.href = data.signedUrl;
  else window.location.href = data.signedUrl;
}

export function useAddClientDocument(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (doc: { title: string; kind: DocumentKind; note: string | null; url?: string; file?: File }) => {
      let file_fields: Record<string, unknown> = {};
      if (doc.file) {
        const { data: agencyId, error: agencyErr } = await sb.rpc("current_agency_id");
        if (agencyErr || !agencyId) throw new Error("Não foi possível identificar a agência.");
        const safeName = doc.file.name.replace(/[^\w.\-]+/g, "_");
        const path = `${agencyId}/${clientId}/${crypto.randomUUID()}-${safeName}`;
        const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, doc.file, { contentType: doc.file.type || undefined });
        if (upErr) throw upErr;
        file_fields = { storage_path: path, file_name: doc.file.name, file_size: doc.file.size };
      }
      const { error } = await sb.from("client_documents").insert({
        client_id: clientId,
        title: doc.title,
        kind: doc.kind,
        note: doc.note,
        url: doc.url ?? null,
        ...file_fields,
      });
      if (error) {
        if (file_fields.storage_path) await supabase.storage.from(BUCKET).remove([file_fields.storage_path as string]);
        throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client_documents", clientId] });
      toast.success("Documento adicionado.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível salvar o documento."),
  });
}

export function useUpdateClientDocument(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, title, url }: { id: string; title: string; url?: string }) => {
      const { error } = await sb.from("client_documents").update({ title, ...(url !== undefined ? { url } : {}) }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client_documents", clientId] });
      toast.success("Documento atualizado.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível atualizar."),
  });
}

export function useDeleteClientDocument(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (doc: ClientDocument) => {
      const { error } = await sb.from("client_documents").delete().eq("id", doc.id);
      if (error) throw error;
      if (doc.storage_path) await supabase.storage.from(BUCKET).remove([doc.storage_path]);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client_documents", clientId] });
      toast.success("Documento removido.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível remover."),
  });
}

export type ClientDetails = {
  plan_name: string | null;
  contract_start: string | null;
  services: string[] | null;
  notes: string | null;
};

export function useClientDetails(clientId: string) {
  return useQuery({
    queryKey: ["client_details", clientId],
    queryFn: async (): Promise<ClientDetails | null> => {
      const { data, error } = await sb
        .from("clients")
        .select("plan_name, contract_start, services, notes")
        .eq("id", clientId)
        .maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
  });
}

export function useSaveClientNotes(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (notes: string) => {
      const { data, error } = await sb.from("clients").update({ notes: notes.trim() || null }).eq("id", clientId).select("id");
      if (error) throw error;
      if (!data?.length) throw new Error("Sem permissão para editar este cliente.");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client_details", clientId] });
      qc.invalidateQueries({ queryKey: ["clients"] });
      toast.success("Observações salvas.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível salvar."),
  });
}

export const CREDENTIAL_PLATFORMS = [
  "instagram", "facebook", "youtube", "tiktok", "linkedin", "x", "pinterest", "google", "whatsapp", "email", "site", "canva", "outro",
] as const;
export type CredentialPlatform = (typeof CREDENTIAL_PLATFORMS)[number];

export type ClientCredential = {
  id: string;
  platform: CredentialPlatform;
  label: string | null;
  username: string | null;
  has_password: boolean;
  note: string | null;
  created_at: string;
};

// The password column isn't selectable from the API at all: only has_password comes back, and the
// real value is fetched one credential at a time through reveal_client_credential().
export function useClientCredentials(clientId: string) {
  return useQuery({
    queryKey: ["client_credentials", clientId],
    queryFn: async (): Promise<ClientCredential[]> => {
      const { data, error } = await sb
        .from("client_credentials")
        .select("id, platform, label, username, has_password, note, created_at")
        .eq("client_id", clientId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export async function revealClientCredential(id: string): Promise<string> {
  const { data, error } = await sb.rpc("reveal_client_credential", { p_id: id });
  if (error) throw error;
  return (data as string | null) ?? "";
}

export function useSaveClientCredential(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (c: {
      id?: string; platform: CredentialPlatform; label: string; username: string; note: string;
      // undefined on edit = keep the current password; "" = clear it.
      password?: string;
    }) => {
      const { error } = await sb.rpc("save_client_credential", {
        p_id: c.id ?? null,
        p_client_id: clientId,
        p_platform: c.platform,
        p_label: c.label,
        p_username: c.username,
        p_password: c.password ?? null,
        p_note: c.note,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client_credentials", clientId] });
      toast.success("Acesso salvo.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível salvar o acesso."),
  });
}

export function useDeleteClientCredential(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("client_credentials").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client_credentials", clientId] });
      toast.success("Acesso removido.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível remover."),
  });
}

// Client photo/logo: stored in the public app-assets bucket (same place the admin Clientes screen uses).
export function useUpdateClientPhoto(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File | null) => {
      let url: string | null = null;
      if (file) {
        const ext = (file.name.split(".").pop() || "png").toLowerCase();
        const path = `client-logos/${crypto.randomUUID()}.${ext}`;
        const up = await supabase.storage.from("app-assets").upload(path, file, { upsert: true, contentType: file.type });
        if (up.error) throw up.error;
        url = supabase.storage.from("app-assets").getPublicUrl(path).data.publicUrl;
      }
      const { data, error } = await sb.from("clients").update({ logo_url: url }).eq("id", clientId).select("id");
      if (error) throw error;
      if (!data?.length) throw new Error("Sem permissão para editar este cliente.");
      return url;
    },
    onSuccess: (url) => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["clients_admin_all"] });
      toast.success(url ? "Foto atualizada." : "Foto removida.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível atualizar a foto."),
  });
}
