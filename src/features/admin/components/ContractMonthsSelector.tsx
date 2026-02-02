import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface ContractMonthsSelectorProps {
  clientId: string;
  clientName: string;
}

type CycleRow = {
  id: string;
  month: number;
  year: number;
  is_active: boolean;
};

const MONTHS = [
  { value: 1, label: "Jan" },
  { value: 2, label: "Fev" },
  { value: 3, label: "Mar" },
  { value: 4, label: "Abr" },
  { value: 5, label: "Mai" },
  { value: 6, label: "Jun" },
  { value: 7, label: "Jul" },
  { value: 8, label: "Ago" },
  { value: 9, label: "Set" },
  { value: 10, label: "Out" },
  { value: 11, label: "Nov" },
  { value: 12, label: "Dez" },
];

export function ContractMonthsSelector({ clientId, clientName }: ContractMonthsSelectorProps) {
  const qc = useQueryClient();
  const [year, setYear] = useState(() => new Date().getFullYear());

  // Buscar ciclos do magic2 para este cliente (via magic2_client_links)
  const cyclesQ = useQuery({
    queryKey: ["client_contract_months", clientId, year],
    queryFn: async () => {
      // Primeiro busca o magic2_client vinculado
      const { data: linkData, error: linkError } = await supabase
        .from("magic2_client_links")
        .select("magic2_client_id")
        .eq("agenda_client_id", clientId)
        .maybeSingle();
      
      if (linkError) throw linkError;
      
      if (!linkData) {
        // Cliente não tem vínculo magic2, retorna vazio
        return { cycles: [] as CycleRow[], magic2ClientId: null };
      }

      // Busca os ciclos do magic2_client
      const { data: cyclesData, error: cyclesError } = await supabase
        .from("magic2_cycles")
        .select("id, month, year, is_active")
        .eq("client_id", linkData.magic2_client_id)
        .eq("year", year);
      
      if (cyclesError) throw cyclesError;
      
      return { 
        cycles: (cyclesData ?? []) as CycleRow[], 
        magic2ClientId: linkData.magic2_client_id 
      };
    },
  });

  const toggleMonth = useMutation({
    mutationFn: async (input: { month: number; activate: boolean }) => {
      const magic2ClientId = cyclesQ.data?.magic2ClientId;
      
      if (!magic2ClientId) {
        // Precisa criar o vínculo primeiro
        const { data: ensureData, error: ensureError } = await supabase
          .rpc("magic2_ensure_client_link", { _agenda_client_id: clientId });
        if (ensureError) throw ensureError;
        
        // Agora cria o ciclo
        const dueDate = `${year}-${String(input.month).padStart(2, "0")}-27`;
        const { error: insertError } = await supabase
          .from("magic2_cycles")
          .insert({
            client_id: ensureData,
            year,
            month: input.month,
            due_date: dueDate,
            is_active: input.activate,
          });
        if (insertError) throw insertError;
        return;
      }

      // Busca ciclo existente
      const existingCycle = cyclesQ.data?.cycles.find(
        (c) => c.month === input.month
      );

      if (existingCycle) {
        // Atualiza
        const { error } = await supabase
          .from("magic2_cycles")
          .update({ is_active: input.activate })
          .eq("id", existingCycle.id);
        if (error) throw error;
      } else {
        // Cria novo ciclo
        const dueDate = `${year}-${String(input.month).padStart(2, "0")}-27`;
        const { error } = await supabase
          .from("magic2_cycles")
          .insert({
            client_id: magic2ClientId,
            year,
            month: input.month,
            due_date: dueDate,
            is_active: input.activate,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client_contract_months", clientId, year] });
      qc.invalidateQueries({ queryKey: ["magic2"] });
    },
    onError: (e: any) => {
      toast.error(e?.message ?? "Erro ao atualizar mês");
    },
  });

  const isMonthActive = (month: number) => {
    const cycle = cyclesQ.data?.cycles.find((c) => c.month === month);
    return cycle?.is_active ?? false;
  };

  const activeCount = cyclesQ.data?.cycles.filter((c) => c.is_active).length ?? 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          Meses de Contrato
        </Label>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setYear((y) => y - 1)}
            disabled={toggleMonth.isPending}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium min-w-[60px] text-center">{year}</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setYear((y) => y + 1)}
            disabled={toggleMonth.isPending}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {cyclesQ.isLoading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-4 gap-2">
            {MONTHS.map((m) => {
              const active = isMonthActive(m.value);
              return (
                <label
                  key={m.value}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border px-3 py-2 cursor-pointer transition",
                    active
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border bg-card/20 text-muted-foreground hover:bg-card/40",
                    toggleMonth.isPending && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <Checkbox
                    checked={active}
                    onCheckedChange={(checked) => {
                      toggleMonth.mutate({ month: m.value, activate: !!checked });
                    }}
                    disabled={toggleMonth.isPending}
                  />
                  <span className="text-sm font-medium">{m.label}</span>
                </label>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">
            {activeCount > 0
              ? `${activeCount} mês(es) ativo(s) em ${year}`
              : `Nenhum mês ativo em ${year}`}
          </p>
        </>
      )}
    </div>
  );
}
