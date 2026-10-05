import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export type DriveStatus = {
  connected: boolean;
  connection: {
    google_email: string | null;
    root_folder_id: string;
    root_folder_name: string;
    status: "active" | "revoked" | "error";
    last_error: string | null;
    connected_at: string;
  } | null;
  clients: number;
  folders: number;
};

export type DriveSyncResult = { created: number; total: number; failures: string[] };

// supabase-js hides the JSON body of non-2xx responses on error.context — read the real reason from there.
export async function driveFunctionError(error: unknown): Promise<string> {
  const context = (error as { context?: Response })?.context;
  if (context && typeof context.json === "function") {
    try {
      const body = await context.json();
      if (body?.error) return body.error as string;
    } catch {
      // body wasn't JSON — fall through
    }
  }
  return error instanceof Error ? error.message : String(error);
}

export async function invokeDrive<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("drive-connect", { body });
  if (error) throw new Error(await driveFunctionError(error));
  if (data?.error) throw new Error(data.error);
  return data as T;
}

export function useDriveStatus() {
  return useQuery({ queryKey: ["drive_status"], queryFn: () => invokeDrive<DriveStatus>({ action: "status" }) });
}

export function useStartDriveConnect() {
  return useMutation({
    mutationFn: async () => {
      const redirect_uri = `${window.location.origin}/admin/drive-callback`;
      const { url } = await invokeDrive<{ url: string }>({ action: "start", redirect_uri });
      return url;
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível iniciar a conexão"),
  });
}

export function useSyncDriveFolders() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => invokeDrive<DriveSyncResult>({ action: "sync_folders" }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["drive_status"] });
      qc.invalidateQueries({ queryKey: ["client_drive_folder"] });
      toast.success(r.created > 0 ? `${r.created} pasta${r.created > 1 ? "s" : ""} criada${r.created > 1 ? "s" : ""}.` : "Todas as pastas já existem.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível criar as pastas"),
  });
}

export function useDisconnectDrive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => invokeDrive<{ ok: boolean }>({ action: "disconnect" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["drive_status"] });
      qc.invalidateQueries({ queryKey: ["client_drive_folder"] });
      toast.success("Google Drive desconectado.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível desconectar"),
  });
}

// Folder Fluxo created for a client in the agency's own Drive (null when Drive isn't connected).
export function useClientDriveFolder(clientId: string) {
  return useQuery({
    queryKey: ["client_drive_folder", clientId],
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await (supabase as any).from("agency_drive_client_folders").select("drive_folder_id").eq("client_id", clientId).maybeSingle();
      if (error) throw error;
      return (data?.drive_folder_id as string | undefined) ?? null;
    },
  });
}
