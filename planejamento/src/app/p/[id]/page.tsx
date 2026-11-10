import type { Metadata } from "next";
import PlanoPublico from "@/components/PlanoPublico";
import type { PlanoSalvo } from "@/lib/plano";
import { buscarPlano, supabaseConfigurado } from "@/lib/supabase";

export const metadata: Metadata = { robots: { index: false, follow: false } };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PaginaPlano({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let salvo: PlanoSalvo | null = null;
  if (UUID.test(id) && supabaseConfigurado()) {
    try {
      salvo = await buscarPlano(id);
    } catch (erro) {
      console.error("[planejamento] Falha ao buscar plano:", erro);
    }
  }
  return <PlanoPublico id={id} inicial={salvo} />;
}
