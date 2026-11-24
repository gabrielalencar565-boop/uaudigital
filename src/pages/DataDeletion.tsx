import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const CONTACT_EMAIL = "uaucomunicacaodigital@gmail.com";

export default function DataDeletion() {
  return (
    <div className="min-h-screen bg-hero-sheen">
      <div className="mx-auto max-w-3xl px-6 py-10">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Instruções de Exclusão de Dados — Fluxo (Uau Digital)</CardTitle>
            <p className="text-sm text-muted-foreground">Última atualização: 24/11/2026</p>
          </CardHeader>
          <CardContent className="space-y-6 text-sm leading-relaxed text-foreground/90">
            <p>
              Esta página explica como remover os dados obtidos através da conexão entre o
              aplicativo Fluxo (Uau Digital, conectado ao Instagram como "Uau Digital-IG") e uma
              conta do Instagram.
            </p>

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-foreground">
                Dados obtidos via Login do Instagram
              </h2>
              <p>
                Ao conectar a conta profissional do Instagram de um cliente, armazenamos: o
                identificador e nome de usuário da conta do Instagram e um token de acesso usado
                para publicar conteúdo aprovado nessa conta e ler as métricas dela. Com a permissão
                de métricas, também guardamos o desempenho da conta (alcance, visualizações,
                visitas ao perfil, seguidores, métricas de cada post e dados agregados do público:
                gênero, faixa etária, cidade e país).
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-foreground">
                Como excluir esses dados
              </h2>
              <ol className="list-decimal space-y-1.5 pl-5">
                <li>
                  <strong>Pelo próprio aplicativo:</strong> um administrador da Uau Digital pode ir
                  em Clientes → selecionar o cliente → Configurações → "Desconectar". Essa ação
                  apaga imediatamente o token de acesso armazenado e as métricas guardadas desse
                  cliente (conta, posts e público) e revoga a conexão — nenhuma publicação nova
                  nem leitura de métricas é possível a partir desse momento.
                </li>
                <li>
                  <strong>Pela própria Meta:</strong> qualquer pessoa com acesso à conta do
                  Facebook/Instagram conectada também pode revogar o acesso do aplicativo
                  diretamente em Configurações do Instagram → Apps e sites, o que invalida o
                  token do lado da Meta independentemente da nossa base de dados.
                </li>
                <li>
                  <strong>Por solicitação direta:</strong> envie um e-mail para{" "}
                  <a href={`mailto:${CONTACT_EMAIL}`} className="underline">
                    {CONTACT_EMAIL}
                  </a>{" "}
                  pedindo a exclusão de qualquer dado relacionado à conexão. Respondemos e
                  confirmamos a exclusão em até 30 dias.
                </li>
              </ol>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-foreground">Outros dados</h2>
              <p>
                Para solicitar a exclusão de qualquer outro dado tratado pelo aplicativo (dados de
                conta de colaborador, dados de cliente da agência, conteúdo de publicação), envie o
                pedido para o mesmo e-mail acima.
              </p>
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
