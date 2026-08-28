import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const CONTACT_EMAIL = "uaucomunicacaodigital@gmail.com";

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-hero-sheen">
      <div className="mx-auto max-w-3xl px-6 py-10">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Política de Privacidade — Uau Digital</CardTitle>
            <p className="text-sm text-muted-foreground">Última atualização: 28/08/2026</p>
          </CardHeader>
          <CardContent className="space-y-6 text-sm leading-relaxed text-foreground/90">
            <p>
              A Uau Digital é uma agência de gestão de redes sociais. Este aplicativo interno
              ("Cronograma") é a ferramenta que a equipe da Uau Digital usa para planejar,
              aprovar e publicar conteúdo nas redes sociais dos clientes que contrataram esse
              serviço. Esta política explica quais dados o aplicativo trata e como.
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
                  <strong>Conexão com Instagram/Facebook:</strong> quando um administrador da Uau
                  Digital conecta a conta profissional do Instagram de um cliente (via Login do
                  Facebook), armazenamos o identificador da Página do Facebook, o identificador da
                  conta do Instagram, o nome de usuário do Instagram e um token de acesso — usados
                  exclusivamente para publicar, em nome desse cliente e com autorização dele, o
                  conteúdo já aprovado no calendário editorial.
                </li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-foreground">3. Como usamos os dados</h2>
              <p>
                Os dados são usados exclusivamente para operar o serviço de gestão de redes sociais
                que a Uau Digital presta a seus próprios clientes: planejar publicações, obter
                aprovação do cliente e publicar o conteúdo aprovado na conta do Instagram do
                cliente na data agendada. Não vendemos, alugamos nem compartilhamos esses dados com
                terceiros para fins de publicidade ou qualquer outra finalidade fora da prestação
                desse serviço.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-foreground">4. Compartilhamento com o Meta</h2>
              <p>
                Para publicar conteúdo, o aplicativo se comunica com a API do Instagram/Graph API
                da Meta usando o token de acesso obtido no momento da conexão, escopado apenas às
                permissões necessárias para essa publicação. Nenhum outro dado é enviado à Meta
                além do estritamente necessário para essa integração.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-foreground">5. Retenção e exclusão</h2>
              <p>
                Mantemos os dados enquanto durar a relação com o cliente ou colaborador. Instruções
                específicas sobre como solicitar a exclusão de dados relacionados à conexão com o
                Instagram/Facebook estão na nossa{" "}
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
