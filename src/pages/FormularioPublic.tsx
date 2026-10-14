import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import { CheckCircle2, Loader2, SearchX } from "lucide-react";
import { FormFields, answersByLabel, firstMissing, type FormValues } from "@/features/comercial/components/FormFields";
import type { FormField } from "@/features/comercial/lib/builder";

const FN_URL = "https://bzzubzjbsjwuvchuhklr.supabase.co/functions/v1/public-formulario";

interface Loaded { name: string; description: string; agency_name: string; fields: FormField[] }

async function call(body: Record<string, unknown>) {
  const res = await fetch(FN_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

// Página pública de um formulário do CRM (link /f/:slug). Sem login: só conhece as perguntas e o texto de agradecimento.
export default function FormularioPublic() {
  const { slug } = useParams<{ slug: string }>();
  const [form, setForm] = useState<Loaded | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing">("loading");
  const [values, setValues] = useState<FormValues>({});
  const [honey, setHoney] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [thanks, setThanks] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const r = await call({ action: "load", slug });
      if (!alive) return;
      if (!r.ok) return setState("missing");
      // a página pública não recebe ids de pergunta: o índice basta para ligar cada campo ao seu valor
      const fields: FormField[] = (r.data.fields ?? []).map((f: Omit<FormField, "id" | "map">, i: number) => ({ ...f, id: String(i), map: "" }));
      setForm({ name: r.data.name, description: r.data.description ?? "", agency_name: r.data.agency_name ?? "", fields });
      setState("ready");
    })();
    return () => { alive = false; };
  }, [slug]);

  const fields = useMemo(() => form?.fields ?? [], [form]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form || sending) return;
    const missing = firstMissing(fields, values);
    if (missing) return setError(`Responda: ${missing}`);
    setError(null); setSending(true);
    const r = await call({ action: "submit", slug, answers: answersByLabel(fields, values), website: honey });
    setSending(false);
    if (r.ok) return setThanks(String(r.data.thanks || "Recebemos suas respostas!"));
    setError(r.status === 429 ? "Você enviou muitas respostas em pouco tempo. Tente de novo daqui a pouco." : r.data?.error === "required" ? `Responda: ${r.data.field ?? "os campos obrigatórios"}` : r.status === 404 ? "Este formulário não está mais disponível." : "Não foi possível enviar agora. Tente de novo.");
  };

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#0B0B0B] px-4 py-8 text-white sm:py-12">
      <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(ellipse 70% 45% at 50% -5%, rgba(124,58,237,0.28), transparent 70%), radial-gradient(ellipse 40% 30% at 90% 15%, rgba(200,107,230,0.10), transparent 70%)" }} />
      <main className="relative mx-auto w-full max-w-xl">
        {state === "loading" && <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-white/60" /></div>}

        {state === "missing" && (
          <div className="flex flex-col items-center gap-3 py-24 text-center">
            <SearchX className="h-10 w-10 text-white/40" />
            <h1 className="text-xl font-semibold">Formulário não encontrado</h1>
            <p className="text-sm text-white/60">O link pode estar incorreto ou o formulário não está mais aberto.</p>
          </div>
        )}

        {state === "ready" && form && (thanks !== null ? (
          <div className="flex flex-col items-center gap-3 rounded-3xl border border-white/10 bg-white/[0.03] px-6 py-14 text-center">
            <CheckCircle2 className="h-12 w-12 text-emerald-400" />
            <h1 className="text-2xl font-semibold">Obrigado!</h1>
            <p className="max-w-sm text-sm text-white/70">{thanks}</p>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-6 rounded-3xl border border-white/10 bg-white/[0.03] p-6 sm:p-8">
            <header className="space-y-2">
              {form.agency_name && <p className="text-xs font-medium uppercase tracking-widest text-violet-300">{form.agency_name}</p>}
              <h1 className="text-2xl font-semibold tracking-tight">{form.name}</h1>
              {form.description && <p className="text-sm text-white/60">{form.description}</p>}
            </header>
            <FormFields variant="public" fields={fields} values={values} onChange={(id, v) => setValues((p) => ({ ...p, [id]: v }))} />
            {/* campo-isca: pessoas não veem nem preenchem; robôs sim */}
            <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" value={honey} onChange={(e) => setHoney(e.target.value)} className="absolute -left-[9999px] h-0 w-0 opacity-0" />
            {error && <p role="alert" className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{error}</p>}
            <button
              type="submit" disabled={sending}
              className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white transition disabled:opacity-60"
              style={{ background: "linear-gradient(135deg, #7C3AED 0%, #9333EA 50%, #7C3AED 100%)" }}
            >
              {sending && <Loader2 className="h-4 w-4 animate-spin" />} Enviar respostas
            </button>
          </form>
        ))}
      </main>
    </div>
  );
}
