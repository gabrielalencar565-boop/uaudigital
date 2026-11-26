import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const CONTACT_EMAIL = "uaucomunicacaodigital@gmail.com";

const SECTIONS: { title: string; paragraphs: string[] }[] = [
  {
    title: "1. O que é o Fluxo",
    paragraphs: [
      "O Fluxo é a ferramenta que a Uau Digital, agência de gestão de redes sociais, usa para planejar, aprovar, agendar e publicar o conteúdo dos clientes que contrataram esse serviço e para acompanhar o desempenho das contas. Na tela de autorização do Instagram, o aplicativo aparece com o nome \"Uau Digital-IG\".",
    ],
  },
  {
    title: "2. Quem pode usar",
    paragraphs: [
      "O acesso é restrito à equipe da Uau Digital, com conta aprovada pela administração. Clientes da agência e outras pessoas convidadas usam apenas telas específicas, por link, como a aprovação de conteúdo e os relatórios de desempenho.",
      "Cada pessoa deve guardar a própria senha e os links que receber, e usar o aplicativo somente para o trabalho relacionado ao serviço contratado.",
    ],
  },
  {
    title: "3. Conexão com o Instagram",
    paragraphs: [
      "A conta profissional do Instagram de um cliente só é conectada com autorização do dono da conta, na tela do próprio Instagram. Com essa autorização, o aplicativo identifica a conta, publica o conteúdo aprovado no calendário editorial e lê as métricas da conta e das publicações.",
      "O uso do Instagram continua sujeito aos termos e às políticas da Meta. O dono da conta pode retirar a autorização a qualquer momento, nas configurações do Instagram (Apps e sites) ou pedindo a desconexão à Uau Digital. Ao desconectar a conta no aplicativo, o token de acesso e as métricas guardadas dela são apagados.",
    ],
  },
  {
    title: "4. Conteúdo",
    paragraphs: [
      "Fotos, vídeos, legendas e demais materiais inseridos no aplicativo são usados para prestar o serviço contratado. Quem envia ou aprova um conteúdo deve ter o direito de usá-lo, e o conteúdo deve respeitar a lei e as regras das plataformas onde será publicado.",
    ],
  },
  {
    title: "5. Disponibilidade",
    paragraphs: [
      "O aplicativo depende de serviços de terceiros, como o Instagram e os provedores de hospedagem e armazenamento. Pode haver interrupções, mudanças nas regras desses serviços ou falhas de publicação, por isso a equipe acompanha o que foi agendado.",
    ],
  },
  {
    title: "6. Mudanças nestes termos",
    paragraphs: [
      "Estes termos podem ser atualizados. A data da última atualização fica no topo desta página.",
    ],
  },
];

export default function TermsOfUse() {
  return (
    <div className="min-h-screen bg-hero-sheen">
      <div className="mx-auto max-w-3xl px-6 py-10">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Termos de Uso — Fluxo (Uau Digital)</CardTitle>
            <p className="text-sm text-muted-foreground">Última atualização: 26/11/2026</p>
          </CardHeader>
          <CardContent className="space-y-6 text-sm leading-relaxed text-foreground/90">
            {SECTIONS.map((section) => (
              <section key={section.title} className="space-y-2">
                <h2 className="text-base font-semibold text-foreground">{section.title}</h2>
                {section.paragraphs.map((text) => (
                  <p key={text}>{text}</p>
                ))}
              </section>
            ))}

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-foreground">7. Privacidade e contato</h2>
              <p>
                O tratamento de dados está descrito na{" "}
                <a href="/privacidade" className="underline">Política de Privacidade</a> e nas{" "}
                <a href="/exclusao-de-dados" className="underline">instruções de Exclusão de Dados</a>. Dúvidas sobre estes termos podem ser enviadas para{" "}
                <a href={`mailto:${CONTACT_EMAIL}`} className="underline">{CONTACT_EMAIL}</a>.
              </p>
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
