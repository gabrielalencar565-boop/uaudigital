# Site UAU Digital — pacote para continuar o projeto

Este pacote tem tudo o que foi feito até 10/10/2026 no site institucional da UAU Digital, para outra conversa do Claude (ou um dev) continuar de onde parou.

## O que tem aqui

| Arquivo | O que é |
| --- | --- |
| `index.html` | Home. Abra no navegador (ou sirva a pasta com `python3 -m http.server`). |
| `sobre.html`, `clientes.html`, `servicos.html`, `grupo-uau.html`, `trabalhe-conosco.html` | Páginas internas, montadas a partir da `copy-do-site.md` |
| `assets/site.css`, `assets/site.js` | Estilo e comportamento compartilhados por todas as páginas |
| `img/` | Fotos reais da equipe e do estúdio, logo da UAU Digital, do Fluxo e da UAU Produtora |
| `logos-originais/` | Arquivos vetoriais originais (PDF) dos logos da UAU e do Fluxo, para o site final |
| `copy-do-site.md` | Copy completa de todas as páginas (Home, Sobre, Clientes, Serviços, Grupo UAU, Trabalhe conosco, Rodapé e SEO) |

## Contexto

- **Empresa:** UAU Digital, agência de posicionamento do interior do Maranhão. Mais de 4 anos de mercado, +100 clientes atendidos, +70 milhões de visualizações geradas. CNPJ 47.107.810/0001-05.
- **Objetivo do site:** página institucional que vai na bio do Instagram e também funciona como site do Grupo UAU (agência + Fluxo + UAU Produtora).
- **Método próprio:** Método VLE (Visto, Lembrado, Escolhido).
- **Referências de estilo (estrutura e dinamismo, não cores):** anonmedia.com.br e dondigital.com.br.

## Decisões já tomadas

1. **Sem planos e sem preços no site.** Isso fica só para a reunião comercial.
2. **Sem cases com números de resultado.** Cases também ficam para a reunião. O site mostra a empresa, os clientes (logos) e depoimentos (vídeo e escrito).
3. **Público amplo, não só saúde.** A maioria dos cases é de médicos, mas o site fala com todos os segmentos (comércio, indústria, serviços, saúde, profissionais liberais, alimentação). Saúde nunca aparece como foco.
4. **Menu:** Início · Sobre · Clientes · Serviços · Grupo UAU · Trabalhe conosco (Blog fica para a fase 2). Botões: Área do Cliente (abre o Fluxo) e Falar com a UAU.
5. **Ordem da home:** Hero → Números → Clientes → Depoimentos → Método VLE → Portfólio → Bastidores → Comparativo (UAU vs. agência comum) → Grupo UAU → CTA final → Rodapé.
6. **Nome correto da unidade audiovisual:** UAU Produtora (não usar "UAU.PROD").
7. **Visual:** fundo escuro com seções claras alternadas, cores da UAU (roxo #7B2FE0 → magenta #C9307A → laranja #F2A04A), fonte Bricolage Grotesque.
8. **Primeira tela (hero):** pedida moderna e minimalista. Versão atual: título "Sua marca" + palavra que alterna (vista. / lembrada. / escolhida.), texto de apoio, dois botões, linha com 3 números e uma foto da equipe à direita.

## Estado em 10/10/2026 (continuação)

- O rascunho de um arquivo só virou um site de 6 páginas com CSS e JS compartilhados.
- Menu, rodapé e botões são iguais em todas as páginas. Se mudar o menu, mude nas 6.
- Área do Cliente → `https://appfluxo.app.br/auth`; Conhecer o Fluxo → `https://appfluxo.app.br`.
- "Falar com a UAU" e o botão de WhatsApp levam por enquanto para o CTA final da home (`index.html#contato`). Quando tiver o número, troque por `https://wa.me/55DDDNUMERO` nas 6 páginas.
- Clientes tem filtro por segmento funcionando; os logos são marcadores (`LOGO 01`…) com `data-seg` para trocar pelas imagens reais.
- Em laranja = dado que falta preencher (igual ao rascunho).
- Atenção: o arquivo `img/logo-produtora.png` ainda mostra "UAU PROD". Pela decisão 6, falta um logo com o nome UAU Produtora.

## O que ainda falta

- Logos dos clientes (com autorização)
- Frases dos depoimentos em vídeo (Dra. Thamara Leal, Dra. Mariana Almeida e 1 ou 2 clientes de fora da saúde)
- Depoimentos escritos (Google ou WhatsApp, com autorização)
- Posts e vídeos reais para o Portfólio
- Número de pessoas no time, contatos (WhatsApp, e-mail, endereço), ano e cidade de fundação
- Print real do painel do Fluxo (o do rascunho foi desenhado como exemplo)
- Decidir se a seção "A UAU em números" continua, já que os números agora aparecem no hero

## Como pedir para outro Claude continuar

Envie este .zip e diga, por exemplo: *"Leia o LEIA-ME.md e continue o site da UAU a partir do index.html, mantendo as decisões já tomadas."*
