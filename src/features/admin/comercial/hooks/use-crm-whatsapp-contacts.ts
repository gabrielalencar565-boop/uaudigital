import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CrmWhatsAppContact {
  id: string;
  phone_key: string | null;
  phone_e164: string;
  name: string | null;
  profile_pic_url: string | null;
  last_message_at: string | null;
  last_message_preview: string | null;
}

export function useCrmWhatsAppContacts() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["crm-whatsapp-contacts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_contacts")
        .select("id,phone_key,phone_e164,name,profile_pic_url,last_message_at,last_message_preview")
        .is("user_id", null);
      if (error) throw error;
      const list = (data ?? []) as CrmWhatsAppContact[];
      const byKey = new Map<string, CrmWhatsAppContact>();
      const byId = new Map<string, CrmWhatsAppContact>();
      for (const c of list) {
        if (c.phone_key) byKey.set(c.phone_key, c);
        byId.set(c.id, c);
      }
      return { list, byKey, byId };
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel("crm-wa-contacts-rt")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "whatsapp_contacts" },
        () => qc.invalidateQueries({ queryKey: ["crm-whatsapp-contacts"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);

  return query;
}

export function formatPhonePretty(phone: string | null | undefined): string {
  if (!phone) return "";
  const digits = String(phone).replace(/\D/g, "");
  if (digits.length === 13 && digits.startsWith("55")) {
    return `+55 (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
  }
  if (digits.length === 12 && digits.startsWith("55")) {
    return `+55 (${digits.slice(2, 4)}) ${digits.slice(4, 8)}-${digits.slice(8)}`;
  }
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return phone;
}
