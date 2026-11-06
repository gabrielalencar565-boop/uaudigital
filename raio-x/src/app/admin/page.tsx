import type { Metadata } from "next";
import { isAdmin } from "@/lib/admin-auth";
import { isSupabaseConfigured, listLeads, type LeadRow } from "@/lib/supabase";
import { login, logout } from "./actions";

export const metadata: Metadata = { title: "Admin · Raio-X", robots: { index: false, follow: false } };

const fmtDate = (iso?: string) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }) : "";

const fmtPhone = (w: string) => {
  const d = w.replace(/^55/, "");
  return d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : d.length === 10 ? `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}` : w;
};

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
        <form action={login} className="flex max-w-sm flex-col gap-3">
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

  let leads: LeadRow[] = [];
  let error: string | null = null;
  if (!isSupabaseConfigured()) error = "Supabase não configurado: os leads estão indo só para o log do servidor.";
  else {
    try {
      leads = await listLeads();
    } catch (e) {
      error = `Erro ao buscar leads: ${(e as Error).message}`;
    }
  }

  return (
    <Shell wide>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <p className="mr-auto text-muted">
          <strong className="text-white">{leads.length}</strong> leads
        </p>
        <a href="/admin/export" className="rounded-2xl bg-amarelo px-5 py-3 font-extrabold text-ink">
          Exportar CSV
        </a>
        <form action={logout}>
          <button className="rounded-2xl border border-borda px-5 py-3 font-bold text-muted hover:text-white">Sair</button>
        </form>
      </div>
      {error ? <p className="mb-4 rounded-2xl border-2 border-amarelo p-4">{error}</p> : null}
      <div className="overflow-x-auto rounded-2xl border border-borda">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="bg-card text-xs tracking-wider text-muted uppercase">
            <tr>
              {["Nome", "WhatsApp", "Instagram", "Nota", "Nível", "Gargalo", "Data"].map((h) => (
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
                    {fmtPhone(l.whatsapp)}
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
                <td className="px-4 py-3 font-extrabold tabular-nums">{l.nota_geral}</td>
                <td className="px-4 py-3">{l.nivel}</td>
                <td className="px-4 py-3">{l.gargalo}</td>
                <td className="px-4 py-3 whitespace-nowrap text-muted">{fmtDate(l.created_at)}</td>
              </tr>
            ))}
            {leads.length === 0 && !error ? (
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

function Shell({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <main className="min-h-dvh bg-ink px-5 py-10 text-white">
      <div className={`mx-auto ${wide ? "max-w-6xl" : "max-w-md"}`}>
        <h1 className="title mb-8 text-3xl">Raio-X · Leads</h1>
        {children}
      </div>
    </main>
  );
}
