import { ClienteCentral } from "./ClienteCentral";
import { ClientesGrid } from "./ClientesGrid";

// "Clientes" tab: the client list, and — once one is opened — that client's whole workspace
// (Cronograma + Resultados, with room for more sections). The open client lives in the URL.
export function ClientesPanel({ clienteId, onClienteChange }: { clienteId: string | null; onClienteChange: (id: string | null) => void }) {
  if (!clienteId) return <ClientesGrid onSelect={(id) => onClienteChange(id)} />;
  return <ClienteCentral clientId={clienteId} onBack={() => onClienteChange(null)} />;
}
