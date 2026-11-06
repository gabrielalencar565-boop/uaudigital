import type { Metadata } from "next";
import { OBJETIVOS } from "@/data/formulario";
import { isAdmin } from "@/lib/admin-auth";
import { withBase } from "@/lib/base";
import { inicioDoDiaBrasilia } from "@/lib/limites";
import { contarGeracoes, listarLeads, supabaseConfigurado, type LeadAdmin } from "@/lib/supabase";

export const metadata: Metadata = { title: "Admin · Planejamento do Mês", robots: { index: false, follow: false } };

const fmtData = (iso?: string) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }) : "";

const fmtFone = (w: string) => {
  const d = w.replace(/^55/, "");
  return d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : d.length === 10 ? `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}` : w;
};

const nomeObjetivo = (id: string | null) => OBJETIVOS.find((o) => o.id === id)?.nome ?? "—";

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;

  if (!process.env.ADMIN_PASSWORD) {
    return (
      <Shell>
        <p className="text-muted">
          Configure a variável <code className="text-white">ADMIN_PASSWORD</code> para liberar o admin.
        </p>
      </Shell>
    );
  }

  if (!(await isAdmin())) {
    return (
      <Shell>
        <form method="post" action={withBase("/admin/login")} className="flex max-w-sm flex-col gap-3">
          <label htmlFor="password" className="font-bold">
            Senha
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="h-12 rounded-2xl border-2 border-borda bg-card px-4 text-white outline-none focus:border-amarelo"
          />
          {erro ? <p className="font-bold text-amarelo">Senha incorreta.</p> : null}
          <button className="btn-primary">Entrar</button>
        </form>
      </Shell>
    );
  }

  let leads: LeadAdmin[] = [];
  let geracoesHoje = 0;
  let falha: string | null = null;
  if (!supabaseConfigurado()) falha = "Supabase não configurado: os leads estão indo só para o log do servidor.";
  else {
    try {
      [leads, geracoesHoje] = await Promise.all([listarLeads(), contarGeracoes("id=not.is.null", inicioDoDiaBrasilia())]);
    } catch (e) {
      falha = `Erro ao buscar dados: ${(e as Error).message}`;
    }
  }
  const totalGeracoes = leads.reduce((acc, l) => acc + (l.geracoes?.[0]?.count ?? 0), 0);

  return (
    <Shell largo>
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Numero titulo="Leads" valor={leads.length} />
        <Numero titulo="Gerações hoje" valor={geracoesHoje} destaque />
        <Numero titulo="Gerações no total" valor={totalGeracoes} />
      </div>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <p className="mr-auto text-sm text-muted">Cada geração com IA tem custo na API da Anthropic. Acompanhe pelas gerações de hoje.</p>
        <a href={withBase("/admin/export")} className="rounded-2xl bg-amarelo px-5 py-3 font-extrabold text-ink">
          Exportar CSV
        </a>
        <form method="post" action={withBase("/admin/logout")}>
          <button className="rounded-2xl border border-borda px-5 py-3 font-bold text-muted hover:text-white">Sair</button>
        </form>
      </div>
      {falha ? <p className="mb-4 rounded-2xl border-2 border-amarelo p-4">{falha}</p> : null}
      <div className="overflow-x-auto rounded-2xl border border-borda">
        <table className="w-full min-w-[960px] text-left text-sm">
          <thead className="bg-card text-xs tracking-wider text-muted uppercase">
            <tr>
              {["Nome", "WhatsApp", "Instagram", "Nicho", "Objetivo", "Gerações", "Data"].map((h) => (
                <th key={h} className="px-4 py-3 font-bold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {leads.map((l) => (
              <tr key={l.id} className="border-t border-borda">
                <td className="px-4 py-3 font-bold">{l.nome}</td>
                <td className="px-4 py-3">
                  <a className="underline underline-offset-2" href={`https://wa.me/${l.whatsapp}`} target="_blank" rel="noreferrer">
                    {fmtFone(l.whatsapp)}
                  </a>
                </td>
                <td className="px-4 py-3">
                  {l.instagram ? (
                    <a className="underline underline-offset-2" href={`https://instagram.com/${l.instagram}`} target="_blank" rel="noreferrer">
                      @{l.instagram}
                    </a>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </td>
                <td className="px-4 py-3">{l.nicho ?? "—"}</td>
                <td className="px-4 py-3">{nomeObjetivo(l.objetivo)}</td>
                <td className="px-4 py-3 font-extrabold tabular-nums">{l.geracoes?.[0]?.count ?? 0}</td>
                <td className="px-4 py-3 whitespace-nowrap text-muted">{fmtData(l.created_at)}</td>
              </tr>
            ))}
            {leads.length === 0 && !falha ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-muted">
                  Nenhum lead ainda.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}

function Numero({ titulo, valor, destaque }: { titulo: string; valor: number; destaque?: boolean }) {
  return (
    <div className={`rounded-2xl p-4 ${destaque ? "bg-amarelo text-ink" : "border border-borda bg-card"}`}>
      <p className={`text-xs font-bold tracking-wider uppercase ${destaque ? "" : "text-muted"}`}>{titulo}</p>
      <p className="mt-1 text-3xl font-extrabold tabular-nums">{valor}</p>
    </div>
  );
}

function Shell({ children, largo = false }: { children: React.ReactNode; largo?: boolean }) {
  return (
    <main className="min-h-dvh bg-ink px-5 py-10 text-white">
      <div className={`mx-auto ${largo ? "max-w-6xl" : "max-w-md"}`}>
        <h1 className="title mb-8 text-3xl">Planejamento do Mês · Leads</h1>
        {children}
      </div>
    </main>
  );
}
