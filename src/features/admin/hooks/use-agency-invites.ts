import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// agency_invites and its RPCs are newer than the generated types.
const sb = supabase as any;

export type AgencyInvite = {
  id: string;
  email: string;
  role: "admin" | "collaborator" | "planner" | "developer";
  role_titles: string[];
  token: string;
  created_at: string;
  expires_at: string;
};

export const inviteLink = (token: string) => `${window.location.origin}/convite/${token}`;

const ERRORS: Record<string, string> = {
  seat_limit: "Sua agência atingiu o limite de pessoas do plano.",
  email_unavailable: "Este e-mail já está em uso por outra conta.",
  invalid_email: "E-mail inválido.",
  forbidden: "Só administradores podem convidar.",
  not_authenticated: "Sessão expirada. Entre novamente.",
};
export const inviteErrorMessage = (e: unknown) => {
  const raw = (e as { message?: string })?.message ?? String(e);
  return ERRORS[raw] ?? ERRORS[Object.keys(ERRORS).find((k) => raw.includes(k)) ?? ""] ?? "Não foi possível criar o convite.";
};

// Open (not accepted, not revoked, not expired) invites of the caller's agency — RLS limits this to admins.
export function useAgencyInvites() {
  return useQuery({
    queryKey: ["agency_invites"],
    queryFn: async () => {
      const { data, error } = await sb
        .from("agency_invites")
        .select("id,email,role,role_titles,token,created_at,expires_at")
        .is("accepted_at", null)
        .is("revoked_at", null)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as AgencyInvite[];
    },
  });
}

export type CreateInviteInput = { email: string; admin: boolean; roleTitles: string[]; sendEmail?: boolean };
export type CreateInviteResult = { id: string; link: string; emailed: boolean; email_error: string | null };

export function useCreateInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateInviteInput): Promise<CreateInviteResult> => {
      const { data, error } = await supabase.functions.invoke("agency-invite", {
        body: {
          email: input.email,
          role: input.admin ? "admin" : "collaborator",
          role_titles: input.roleTitles,
          origin: window.location.origin,
          send_email: input.sendEmail !== false,
        },
      });
      if (error) {
        // The function answers 400 with { error: "<code>" }; surface that code instead of the generic wrapper.
        const body = await (error as { context?: Response }).context?.json?.().catch(() => null);
        throw new Error(body?.error ?? error.message);
      }
      if (data?.error) throw new Error(data.error);
      return data as CreateInviteResult;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["agency_invites"] }),
  });
}

export function useRevokeInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.rpc("revoke_agency_invite", { p_id: id });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["agency_invites"] }),
  });
}
