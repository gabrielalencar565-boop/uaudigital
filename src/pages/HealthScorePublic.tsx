import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { ProgressRing } from "@/components/metrics/ProgressRing";
import { cn } from "@/lib/utils";
import { HeartPulse, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

const QUESTIONS = [
  {
    key: "resultado_percebido" as const,
    commentKey: "comentario_resultado" as const,
    title: "1. Resultado percebido",
    description: "Você percebe evolução nos indicadores-chave (leads, vendas, engajamento, visibilidade da marca) com os serviços da agência?",
  },
  {
    key: "alinhamento_estrategico" as const,
    commentKey: "comentario_alinhamento" as const,
    title: "2. Alinhamento estratégico",
    description: "Você sente que a agência entende bem seu negócio e suas necessidades, entregando soluções coerentes com seus objetivos?",
  },
  {
    key: "comunicacao_atendimento" as const,
    commentKey: "comentario_comunicacao" as const,
    title: "3. Comunicação e atendimento",
    description: "Você está satisfeito com a frequência, clareza e qualidade da comunicação com a agência?",
  },
  {
    key: "qualidade_entregas" as const,
    commentKey: "comentario_qualidade" as const,
    title: "4. Qualidade das entregas",
    description: "Você percebe que as entregas (design, conteúdo, vídeos) têm qualidade e atendem suas expectativas?",
  },
  {
    key: "satisfacao_geral" as const,
    commentKey: "comentario_satisfacao" as const,
    title: "5. Satisfação geral",
    description: "De modo geral, você está satisfeito com a parceria com a agência e recomendaria para terceiros?",
  },
];

type ScoreKeys = typeof QUESTIONS[number]["key"];
type CommentKeys = typeof QUESTIONS[number]["commentKey"];

interface TokenData {
  id: string;
  client_id: string;
  month: number;
  year: number;
  used_at: string | null;
  client_name?: string;
}

export default function HealthScorePublic() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [loading, setLoading] = useState(true);
  const [tokenData, setTokenData] = useState<TokenData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [formValues, setFormValues] = useState<Record<ScoreKeys, number>>({
    resultado_percebido: 50,
    alinhamento_estrategico: 50,
    comunicacao_atendimento: 50,
    qualidade_entregas: 50,
    satisfacao_geral: 50,
  });
  const [formComments, setFormComments] = useState<Record<CommentKeys, string>>({
    comentario_resultado: "",
    comentario_alinhamento: "",
    comentario_comunicacao: "",
    comentario_qualidade: "",
    comentario_satisfacao: "",
  });

  useEffect(() => {
    async function validateToken() {
      if (!token) {
        setError("Link inválido. Token não encontrado.");
        setLoading(false);
        return;
      }

      const { data: tokenRow, error: tokenError } = await supabase
        .from("health_score_tokens" as any)
        .select("id, client_id, month, year, used_at")
        .eq("token", token)
        .single();

      if (tokenError || !tokenRow) {
        setError("Link inválido ou expirado.");
        setLoading(false);
        return;
      }

      const row = tokenRow as unknown as { id: string; client_id: string; month: number; year: number; used_at: string | null };

      if (row.used_at) {
        setError("Esta avaliação já foi respondida.");
        setLoading(false);
        return;
      }

      // Get client name
      const { data: client } = await supabase
        .from("clients")
        .select("name")
        .eq("id", row.client_id)
        .single();

      setTokenData({
        id: row.id,
        client_id: row.client_id,
        month: row.month,
        year: row.year,
        used_at: row.used_at,
        client_name: client?.name ?? "Cliente",
      });
      setLoading(false);
    }

    validateToken();
  }, [token]);

  const average = Math.round(
    (formValues.resultado_percebido +
      formValues.alinhamento_estrategico +
      formValues.comunicacao_atendimento +
      formValues.qualidade_entregas +
      formValues.satisfacao_geral) /
      5
  );

  const scoreColor = (v: number) => {
    if (v >= 80) return "text-green-500";
    if (v >= 50) return "text-yellow-500";
    return "text-red-500";
  };

  const handleSubmit = async () => {
    if (!tokenData) return;

    setSubmitting(true);

    // Insert health score (evaluated_by will be a placeholder UUID for anonymous)
    const { error: insertError } = await supabase.from("health_scores" as any).insert({
      client_id: tokenData.client_id,
      evaluated_by: "00000000-0000-0000-0000-000000000000", // Anonymous placeholder
      month: tokenData.month,
      year: tokenData.year,
      ...formValues,
      ...formComments,
    });

    if (insertError) {
      toast.error("Erro ao enviar avaliação. Tente novamente.");
      setSubmitting(false);
      return;
    }

    // Mark token as used
    await supabase
      .from("health_score_tokens" as any)
      .update({ used_at: new Date().toISOString() })
      .eq("id", tokenData.id);

    setSubmitted(true);
    setSubmitting(false);
  };

  const monthNames = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <AlertCircle className="h-12 w-12 text-destructive" />
            <p className="text-center text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <CheckCircle2 className="h-12 w-12 text-primary" />
            <h2 className="text-xl font-semibold">Obrigado!</h2>
            <p className="text-center text-muted-foreground">
              Sua avaliação foi enviada com sucesso. Agradecemos seu feedback!
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="flex justify-center">
          <div className="h-14 w-14 rounded-full bg-destructive/10 flex items-center justify-center">
            <HeartPulse className="h-7 w-7 text-destructive" />
          </div>
        </div>
        <h1 className="text-2xl font-bold">Avaliação de Satisfação</h1>
        <p className="text-muted-foreground">
          {tokenData?.client_name} — {monthNames[(tokenData?.month ?? 1) - 1]}/{tokenData?.year}
        </p>
      </div>

        {/* Overall score preview */}
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
                  <span className={cn("text-lg font-bold", scoreColor(formValues[q.key]))}>
                    {formValues[q.key]}/100
                  </span>
                </div>
                <Slider
                  value={[formValues[q.key]]}
                  onValueChange={([v]) => setFormValues((prev) => ({ ...prev, [q.key]: v }))}
                  max={100}
                  step={1}
                  className="w-full"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>0</span>
                  <span>50</span>
                  <span>100</span>
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">
                  Comentário (opcional — até 1000 caracteres):
                </p>
                <Textarea
                  value={formComments[q.commentKey]}
                  onChange={(e) =>
                    setFormComments((prev) => ({
                      ...prev,
                      [q.commentKey]: e.target.value.slice(0, 1000),
                    }))
                  }
                  placeholder="Adicione observações..."
                  className="resize-none"
                  rows={3}
                />
                <p className="text-[10px] text-muted-foreground text-right mt-1">
                  {formComments[q.commentKey].length}/1000 caracteres
                </p>
              </div>
            </CardContent>
          </Card>
        ))}

        {/* Submit */}
        <div className="flex justify-center pb-8">
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            size="lg"
            className="px-12"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Enviar Avaliação
          </Button>
        </div>
      </div>
    </div>
  );
}
