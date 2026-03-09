import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { useHealthScores, useUpsertHealthScore, type HealthScore } from "../hooks/use-health-scores";
import { useHealthScoreToken, useCreateHealthScoreToken } from "../hooks/use-health-score-token";
import { useSession } from "@/hooks/use-session";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MonthYearNav } from "@/features/magic2/components/MonthYearNav";
import { ArrowLeft, HeartPulse, ChevronRight, Link2, Copy, Check, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProgressRing } from "@/components/metrics/ProgressRing";
import { toast } from "sonner";

const QUESTIONS = [
  {
    key: "resultado_percebido" as const,
    commentKey: "comentario_resultado" as const,
    title: "1. Resultado percebido",
    description: "O cliente percebe evolução nos indicadores-chave (leads, vendas, engajamento, visibilidade da marca) com os serviços da agência?",
  },
  {
    key: "alinhamento_estrategico" as const,
    commentKey: "comentario_alinhamento" as const,
    title: "2. Alinhamento estratégico",
    description: "O cliente sente que a agência entende bem seu negócio e suas necessidades, entregando soluções coerentes com seus objetivos?",
  },
  {
    key: "comunicacao_atendimento" as const,
    commentKey: "comentario_comunicacao" as const,
    title: "3. Comunicação e atendimento",
    description: "O cliente está satisfeito com a frequência, clareza e qualidade da comunicação com a agência?",
  },
  {
    key: "qualidade_entregas" as const,
    commentKey: "comentario_qualidade" as const,
    title: "4. Qualidade das entregas",
    description: "O cliente percebe que as entregas (design, conteúdo, vídeos) têm qualidade e atendem suas expectativas?",
  },
  {
    key: "satisfacao_geral" as const,
    commentKey: "comentario_satisfacao" as const,
    title: "5. Satisfação geral",
    description: "De modo geral, o cliente está satisfeito com a parceria com a agência e recomendaria para terceiros?",
  },
];

type ScoreKeys = typeof QUESTIONS[number]["key"];
type CommentKeys = typeof QUESTIONS[number]["commentKey"];

export function HealthScoreTab() {
  const { user } = useSession();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const scoresQ = useHealthScores(month, year);
  const upsert = useUpsertHealthScore();
  const tokenQ = useHealthScoreToken(selectedClientId, month, year);
  const createToken = useCreateHealthScoreToken();

  const clientsQ = useQuery({
    queryKey: ["clients_active"],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("id, name").eq("is_active", true).eq("is_freelancer_sentinel", false).order("name");
      return data ?? [];
    },
  });

  const clients = clientsQ.data ?? [];
  const scores = scoresQ.data ?? [];
  const scoresMap = useMemo(() => {
    const m: Record<string, HealthScore> = {};
    scores.forEach((s) => { m[s.client_id] = s; });
    return m;
  }, [scores]);

  // Form state
  const [formValues, setFormValues] = useState<Record<ScoreKeys, number>>({
    resultado_percebido: 0,
    alinhamento_estrategico: 0,
    comunicacao_atendimento: 0,
    qualidade_entregas: 0,
    satisfacao_geral: 0,
  });
  const [formComments, setFormComments] = useState<Record<CommentKeys, string>>({
    comentario_resultado: "",
    comentario_alinhamento: "",
    comentario_comunicacao: "",
    comentario_qualidade: "",
    comentario_satisfacao: "",
  });

  const selectClient = (clientId: string) => {
    setSelectedClientId(clientId);
    const existing = scoresMap[clientId];
    if (existing) {
      setFormValues({
        resultado_percebido: existing.resultado_percebido,
        alinhamento_estrategico: existing.alinhamento_estrategico,
        comunicacao_atendimento: existing.comunicacao_atendimento,
        qualidade_entregas: existing.qualidade_entregas,
        satisfacao_geral: existing.satisfacao_geral,
      });
      setFormComments({
        comentario_resultado: existing.comentario_resultado ?? "",
        comentario_alinhamento: existing.comentario_alinhamento ?? "",
        comentario_comunicacao: existing.comentario_comunicacao ?? "",
        comentario_qualidade: existing.comentario_qualidade ?? "",
        comentario_satisfacao: existing.comentario_satisfacao ?? "",
      });
    } else {
      setFormValues({ resultado_percebido: 0, alinhamento_estrategico: 0, comunicacao_atendimento: 0, qualidade_entregas: 0, satisfacao_geral: 0 });
      setFormComments({ comentario_resultado: "", comentario_alinhamento: "", comentario_comunicacao: "", comentario_qualidade: "", comentario_satisfacao: "" });
    }
  };

  const average = Math.round(
    (formValues.resultado_percebido + formValues.alinhamento_estrategico + formValues.comunicacao_atendimento + formValues.qualidade_entregas + formValues.satisfacao_geral) / 5
  );

  const handleSave = () => {
    if (!user || !selectedClientId) return;
    upsert.mutate({
      client_id: selectedClientId,
      evaluated_by: user.id,
      month,
      year,
      ...formValues,
      ...formComments,
    });
  };

  const scoreColor = (v: number) => {
    if (v >= 80) return "text-green-500";
    if (v >= 50) return "text-yellow-500";
    return "text-red-500";
  };

  // Client list view
  if (!selectedClientId) {
    return (
      <div className="space-y-4 mt-4">
        <div className="flex items-center justify-between flex-wrap gap-2 opacity-0" style={{ animation: "fadeUp 0.5s ease-out forwards", animationDelay: "0s" }}>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <HeartPulse className="h-5 w-5 text-red-500" /> Health Score
          </h2>
          <MonthYearNav month={month} year={year} onMonthChange={setMonth} onYearChange={setYear} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 opacity-0" style={{ animation: "fadeUp 0.5s ease-out forwards", animationDelay: "0.1s" }}>
          {clients.map((client) => {
            const s = scoresMap[client.id];
            const avg = s ? Math.round((s.resultado_percebido + s.alinhamento_estrategico + s.comunicacao_atendimento + s.qualidade_entregas + s.satisfacao_geral) / 5) : null;
            return (
              <Card
                key={client.id}
                className="cursor-pointer hover:border-primary/40 transition-colors"
                onClick={() => selectClient(client.id)}
              >
                <CardContent className="flex items-center justify-between py-4 px-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center shrink-0">
                      <HeartPulse className={cn("h-4 w-4", avg !== null ? scoreColor(avg) : "text-muted-foreground")} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{client.name}</p>
                      {avg !== null ? (
                        <p className={cn("text-xs font-bold", scoreColor(avg))}>{avg}/100</p>
                      ) : (
                        <p className="text-xs text-muted-foreground">Não avaliado</p>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    );
  }

  // Evaluation form
  const clientName = clients.find((c) => c.id === selectedClientId)?.name ?? "";

  return (
    <div className="space-y-6 mt-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setSelectedClientId(null)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-lg font-semibold">{clientName}</h2>
          <p className="text-xs text-muted-foreground">Avaliação do Health Score</p>
        </div>
      </div>

      {/* Overall score */}
      <Card>
        <CardContent className="flex items-center gap-6 py-6">
          <ProgressRing value={average} size={80} stroke={6} />
          <div>
            <p className={cn("text-3xl font-bold", scoreColor(average))}>{average}/100</p>
            <p className="text-sm text-muted-foreground">Média das 5 avaliações</p>
          </div>
        </CardContent>
      </Card>

      {/* Questions */}
      {QUESTIONS.map((q) => (
        <Card key={q.key}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{q.title}</CardTitle>
            <p className="text-sm text-muted-foreground">{q.description}</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Nota:</span>
                <span className={cn("text-lg font-bold", scoreColor(formValues[q.key]))}>{formValues[q.key]}/100</span>
              </div>
              <Slider
                value={[formValues[q.key]]}
                onValueChange={([v]) => setFormValues((prev) => ({ ...prev, [q.key]: v }))}
                max={100}
                step={1}
                className="w-full"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>0</span><span>50</span><span>100</span>
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Comentário (opcional — até 1000 caracteres):</p>
              <Textarea
                value={formComments[q.commentKey]}
                onChange={(e) => setFormComments((prev) => ({ ...prev, [q.commentKey]: e.target.value.slice(0, 1000) }))}
                placeholder="Adicione observações sobre este aspecto do feedback do cliente..."
                className="resize-none"
                rows={3}
              />
              <p className="text-[10px] text-muted-foreground text-right mt-1">{formComments[q.commentKey].length}/1000 caracteres</p>
            </div>
          </CardContent>
        </Card>
      ))}

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={upsert.isPending} variant="hero" className="px-8">
          Salvar Avaliação
        </Button>
      </div>
    </div>
  );
}
