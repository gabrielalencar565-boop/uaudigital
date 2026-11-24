import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const CONTACT_EMAIL = "uaucomunicacaodigital@gmail.com";

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-hero-sheen">
      <div className="mx-auto max-w-3xl px-6 py-10">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Política de Privacidade — Fluxo (Uau Digital)</CardTitle>
            <p className="text-sm text-muted-foreground">Última atualização: 24/11/2026</p>
          </CardHeader>
          <CardContent className="space-y-6 text-sm leading-relaxed text-foreground/90">
            <p>
              A Uau Digital é uma agência de gestão de redes sociais. Este aplicativo interno
              (Fluxo, conectado ao Instagram com o nome "Uau Digital-IG") é a ferramenta que a
              equipe da Uau Digital usa para planejar, aprovar e publicar conteúdo nas redes
              sociais dos clientes que contrataram esse serviço e para acompanhar o desempenho
              dessas contas. Esta política explica quais dados o aplicativo trata e como.
            </p>

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-foreground">1. Quem usa este aplicativo</h2>
              <p>
                O acesso é restrito à equipe interna da Uau Digital (colaboradores aprovados pelo
                administrador) e, em telas específicas e limitadas, aos clientes da agência
                (aprovação de conteúdo e avaliação de atendimento). O aplicativo não é público nem
                distribuído para o público em geral.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-foreground">2. Dados que tratamos</h2>
              <ul className="list-disc space-y-1.5 pl-5">
                <li>
                  <strong>Conta da equipe:</strong> nome, e-mail e função (via Supabase Auth), usados
                  para login e controle de permissões internas.
                </li>
                <li>
                  <strong>Dados dos clientes da agência:</strong> nome, CNPJ e informações de
                  contato, usados para organizar o trabalho de cada conta.
                </li>
                <li>
                  <strong>Conteúdo de publicação:</strong> fotos, vídeos e legendas produzidos para
                  os clientes, armazenados em uma conta do Google Drive de propriedade da Uau
                  Digital (acesso privado, nunca público).
                </li>
                <li>
                  <strong>Conexão com o Instagram:</strong> quando um administrador da Uau Digital
                  conecta a conta profissional do Instagram de um cliente (via Login do Instagram,
                  com autorização do dono da conta), armazenamos o identificador da conta, o nome
                  de usuário do Instagram e um token de acesso. O token é usado para publicar, em
                  nome desse cliente, o conteúdo já aprovado no calendário editorial e, com a
                  permissão de métricas (<code>instagram_business_manage_insights</code>), para ler
                  as métricas da conta.
                </li>
                <li>
                  <strong>Métricas do Instagram:</strong> a partir dessa permissão, lemos e
                  guardamos o desempenho da conta autorizada: alcance, visualizações, visitas ao
                  perfil, cliques no link, número de seguidores e novos seguidores; por post,
                  alcance, curtidas, comentários, salvamentos, compartilhamentos e interações (com
                  o link, a miniatura e um trecho da legenda); e dados agregados do público
                  seguidor (gênero, faixa etária, cidade e país). Não acessamos mensagens diretas
                  nem dados pessoais de seguidores individuais.
                </li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-foreground">3. Como usamos os dados</h2>
              <p>
                Os dados são usados exclusivamente para operar o serviço de gestão de redes sociais
                que a Uau Digital presta a seus próprios clientes: planejar publicações, obter
                aprovação do cliente, publicar o conteúdo aprovado na conta do Instagram do
                cliente na data agendada e medir o desempenho da conta para avaliar quais
                conteúdos funcionam. As métricas aparecem em relatórios de desempenho, que a
                agência pode enviar ao dono da conta por link ou PDF. Não vendemos, alugamos nem
                compartilhamos esses dados com terceiros para fins de publicidade ou qualquer
                outra finalidade fora da prestação desse serviço.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-foreground">4. Compartilhamento com o Meta</h2>
              <p>
                Para publicar conteúdo e ler métricas, o aplicativo se comunica com a API do
                Instagram da Meta usando o token de acesso obtido no momento da conexão, limitado
                às permissões que o dono da conta autorizou (acesso básico ao perfil, publicação
                de conteúdo e métricas). Nenhum outro dado é enviado à Meta além do estritamente
                necessário para essa integração.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-foreground">5. Retenção e exclusão</h2>
              <p>
                Mantemos os dados enquanto durar a relação com o cliente ou colaborador. O dono da
                conta pode revogar o acesso a qualquer momento. Ao desconectar a conta no
                aplicativo, o token e as métricas guardadas dela são apagados. Instruções específicas sobre como solicitar a exclusão de dados
                relacionados à conexão com o Instagram estão na nossa{" "}
                <a href="/exclusao-de-dados" className="underline">
                  página de Exclusão de Dados
                </a>
                .
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-foreground">6. Contato</h2>
              <p>
                Dúvidas sobre esta política ou sobre os dados tratados podem ser enviadas para{" "}
                <a href={`mailto:${CONTACT_EMAIL}`} className="underline">
                  {CONTACT_EMAIL}
                </a>
                .
              </p>
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
