import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getBrazilianHolidays } from "@/lib/holidays";
import { format } from "date-fns";

export type InternalDate = {
  id: string;
  title: string;
  day_of_month: number;
  is_recurring: boolean;
  specific_date: string | null;
  icon: string;
  color: string;
  is_active: boolean;
};

export function useInternalDates() {
  return useQuery({
    queryKey: ["internal_dates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("internal_dates")
        .select("id, title, day_of_month, is_recurring, specific_date, icon, color, is_active")
        .eq("is_active", true)
        .order("day_of_month");
      if (error) throw error;
      return (data ?? []) as InternalDate[];
    },
  });
}

export function useCreateInternalDate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { title: string; day_of_month: number; icon: string; color: string; created_by: string }) => {
      const { error } = await supabase.from("internal_dates").insert(input);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["internal_dates"] }),
  });
}

export function useUpdateInternalDate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<InternalDate> }) => {
      const { error } = await supabase.from("internal_dates").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["internal_dates"] }),
  });
}

export function useDeleteInternalDate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("internal_dates").update({ is_active: false }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["internal_dates"] }),
  });
}

export type SpecialDate = {
  type: "holiday" | "birthday" | "internal";
  label: string;
  icon?: string;
  color?: string;
  personName?: string;
};

/**
 * Builds a map of yyyy-MM-dd → SpecialDate[] for the given year/month.
 */
export function useAgendaSpecialDates(
  year: number,
  month: number, // 1-based
  teamMembers: Array<{ user_id: string; display_name: string; birth_date: string | null }>
) {
  const internalDatesQ = useInternalDates();

  return useMemo(() => {
    const map = new Map<string, SpecialDate[]>();

    const add = (key: string, entry: SpecialDate) => {
      const prev = map.get(key) ?? [];
      prev.push(entry);
      map.set(key, prev);
    };

    // 1. Holidays
    const holidays = getBrazilianHolidays(year);
    holidays.forEach((name, dateKey) => {
      // Only include holidays in the current month
      const [, m] = dateKey.split("-").map(Number);
      if (m === month) {
        add(dateKey, { type: "holiday", label: name });
      }
    });

    // 2. Birthdays
    for (const m of teamMembers) {
      if (!m.birth_date) continue;
      const bd = new Date(m.birth_date + "T12:00:00");
      const bdMonth = bd.getMonth() + 1;
      if (bdMonth !== month) continue;
      const bdDay = String(bd.getDate()).padStart(2, "0");
      const key = `${year}-${String(month).padStart(2, "0")}-${bdDay}`;
      add(key, {
        type: "birthday",
        label: `🎂 ${m.display_name}`,
        personName: m.display_name,
      });
    }

    // 3. Internal recurring dates
    for (const d of internalDatesQ.data ?? []) {
      if (!d.is_active) continue;
      if (d.is_recurring) {
        const dayStr = String(d.day_of_month).padStart(2, "0");
        const key = `${year}-${String(month).padStart(2, "0")}-${dayStr}`;
        add(key, { type: "internal", label: d.title, icon: d.icon, color: d.color });
      } else if (d.specific_date) {
        const [sy, sm] = d.specific_date.split("-").map(Number);
        if (sy === year && sm === month) {
          add(d.specific_date, { type: "internal", label: d.title, icon: d.icon, color: d.color });
        }
      }
    }

    return map;
  }, [year, month, teamMembers, internalDatesQ.data]);
}
