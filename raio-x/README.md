# Raio-X do Social Media · UAU Digital

Diagnóstico interativo: o social media responde 12 perguntas (2 por área) e recebe uma nota de 0 a 100, um gráfico por área, o principal gargalo e o primeiro passo para melhorar. No caminho, a gente captura nome, WhatsApp e @ (lista de interesse do lançamento).

- **Stack:** Next.js 16 (App Router) + TypeScript + Tailwind CSS 4
- **Leads:** Supabase (tabela `leads`), gravados pelo servidor em `POST /api/leads`
- **Sem Supabase?** O app funciona igual e registra cada lead no log do servidor (plano B)
- **Admin:** `/admin`, protegido por senha, com exportação CSV
- **Visual:** o mesmo da landing da UAU (`site-uau/`): fundo escuro com faixas claras, degradê roxo → magenta → laranja, botões em pílula e eyebrows lilás

---

## Rodar localmente

```bash
cd raio-x
npm install
cp .env.example .env.local   # preencha o que tiver (tudo é opcional para testar)
npm run dev                  # http://localhost:3000
```

Outros comandos:

```bash
npm test        # testes do cálculo de notas, nível, gargalo e validações
npm run lint
npm run build
```

## Onde editar os textos

Tudo fica em **`src/data/raiox.ts`**: perguntas e pontuação, nomes e emojis das áreas, frases das telas de "área concluída", níveis, textos de gargalo, frase da área mais forte e textos das telas (inicial, formulário e resultado). Não precisa mexer nos componentes.

O cálculo está em `src/lib/scoring.ts` (com testes em `src/lib/__tests__`).

## Logo

A logo fica em **`public/logo-uau.png`** (é a mesma do site, `site-uau/img/logo-uau.png`). Ela aparece no topo da tela inicial, do resultado, na imagem do story e na imagem de compartilhamento. Se o arquivo for removido, aparece o texto "uaudigital".

## Quantidade de perguntas

Hoje são 12 (2 por área). Para mudar, é só adicionar ou tirar perguntas em `QUESTIONS` no `src/data/raiox.ts`: a nota de cada área se ajusta sozinha (máximo = nº de perguntas da área × 3) e a tela de "área concluída" aparece ao fim de cada área. Mantenha o mesmo número de perguntas em todas as áreas.

---

## Variáveis de ambiente

| Variável | Onde | Obrigatória | Para quê |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | servidor | não* | URL do projeto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | — | não | Reservada (o app não usa no navegador hoje; pode deixar preenchida) |
| `SUPABASE_SERVICE_ROLE_KEY` | **só servidor** | não* | Grava e lê os leads. Nunca vai para o navegador |
| `ADMIN_PASSWORD` | servidor | para usar o `/admin` | Senha da página de admin |
| `NEXT_PUBLIC_META_PIXEL_ID` | navegador | não | Liga o Pixel da Meta (PageView, Lead, CompleteRegistration) |
| `NEXT_PUBLIC_SITE_URL` | servidor | não | URL pública (ex.: `https://raiox.uaudigital.com.br`), usada na imagem Open Graph. Na Vercel é detectada sozinha |

\* Sem as duas variáveis do Supabase, os leads vão só para o log do servidor (na Vercel: **Project → Logs**, procure por `[raiox] Lead`).

---

## Configurar o Supabase

1. Crie uma conta em [supabase.com](https://supabase.com) e clique em **New project** (região: São Paulo).
2. No menu lateral, abra **SQL Editor → New query**, cole o SQL abaixo e clique em **Run**.
3. Vá em **Project Settings → API** e copie:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** (clique em "Reveal") → `SUPABASE_SERVICE_ROLE_KEY`

```sql
create extension if not exists "pgcrypto";

create table if not exists public.leads (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  nome              text not null,
  whatsapp          text not null,           -- formato 5511987654321
  instagram         text,                    -- sem o @
  nota_geral        smallint not null check (nota_geral between 0 and 100),
  nota_objetivo     smallint not null,
  nota_diagnostico  smallint not null,
  nota_concorrentes smallint not null,
  nota_conteudo     smallint not null,
  nota_apresentacao smallint not null,
  nota_valor        smallint not null,
  nivel             text not null,
  gargalo           text not null,
  respostas         jsonb not null,          -- [{ id, area, pergunta, resposta, pontos }]
  consentimento     boolean not null default true,
  utm_source        text,
  utm_medium        text,
  utm_campaign      text,
  utm_content       text,
  user_agent        text
);

create index if not exists leads_created_at_idx on public.leads (created_at desc);
create index if not exists leads_whatsapp_idx   on public.leads (whatsapp);

-- Segurança: RLS ligado e nenhuma policy pública.
-- Só o servidor (com a service_role key) consegue ler e gravar.
alter table public.leads enable row level security;
```

Se a mesma pessoa refizer o teste, entra uma linha nova (dá pra ver a evolução). Para pegar só o último de cada número:

```sql
select distinct on (whatsapp) * from public.leads order by whatsapp, created_at desc;
```

---

## Deploy na Vercel

Este app fica na pasta `raio-x/` do repositório `uaudigital`.

1. Entre em [vercel.com](https://vercel.com) → **Add New… → Project** e importe o repositório `uaudigital`.
2. Em **Root Directory**, clique em **Edit** e escolha **`raio-x`**. O Framework Preset fica como **Next.js**.
3. Em **Environment Variables**, adicione as variáveis da tabela acima (no mínimo `ADMIN_PASSWORD` e as 3 do Supabase).
4. Clique em **Deploy**.
5. (Opcional) Em **Settings → Domains**, adicione um domínio, por exemplo `raiox.uaudigital.com.br`, e crie o CNAME que a Vercel indicar.
6. Teste: faça o raio-x inteiro, depois abra `/admin`, entre com a senha e confira se o lead apareceu.

Ao mudar uma variável de ambiente, faça um **Redeploy** para valer.

### Link para a bio / comentários

Use UTMs para saber de onde veio cada lead, por exemplo:

```
https://SEU-DOMINIO/?utm_source=instagram&utm_medium=comentario&utm_campaign=raiox&utm_content=video1
```

As UTMs ficam salvas mesmo se a pessoa navegar pelo teste e vão junto com o lead.

---

## Como funciona

- **Fluxo:** inicial → 12 perguntas → "área concluída" a cada 2 perguntas (faixa clara) → contato → resultado.
- **Pontuação:** cada opção vale 0 a 3. Nota da área = soma ÷ 6 × 100 (arredondada). Nota geral = média das 6 áreas (arredondada). A nota é recalculada no servidor a partir das respostas.
- **Gargalo:** área com menor nota. Empate: Objetivo → Apresentação → Diagnóstico → Conteúdo → Valor → Concorrentes.
- **Área mais forte:** maior nota. Empate: ordem das áreas (01 a 06).
- **Opções embaralhadas** por pessoa (a ordem fica salva, então não muda se ela voltar ou recarregar).
- **Progresso salvo** no `localStorage`. Se a pessoa fechar a aba no meio, a tela inicial mostra "Continuar da pergunta X". Quem já viu o resultado volta direto para ele. "Refazer o raio-x" limpa tudo.
- **Story:** "Compartilhar no story" gera um PNG 1080×1920 no próprio navegador (canvas, sem biblioteca) e abre o compartilhamento do celular. No desktop, baixa a imagem.
- **Pixel da Meta:** só carrega com `NEXT_PUBLIC_META_PIXEL_ID`. PageView na entrada, Lead ao enviar o formulário e CompleteRegistration ao ver o resultado (uma vez).
- **Admin:** `/admin` pede a senha (`ADMIN_PASSWORD`), lista os leads e exporta CSV (separado por `;`, abre direto no Excel).

## Estrutura

```
src/
  app/
    page.tsx                 # monta o <RaioX />
    layout.tsx               # fonte, SEO e Pixel
    opengraph-image.tsx      # imagem de compartilhamento 1200x630
    api/leads/route.ts       # POST /api/leads
    admin/                   # página de admin, login e exportação CSV
  components/
    RaioX.tsx                # controla as telas e o progresso
    Intro, Question, AreaDone, LeadForm, Result,
    RadarChart, AreaBars, ShareImage, Logo, MetaPixel
  data/raiox.ts              # TODOS os textos e perguntas
  lib/
    scoring.ts               # cálculo das notas, nível e gargalo
    validation.ts            # WhatsApp, Instagram, nome
    storage.ts               # localStorage seguro + UTMs
    supabase.ts              # acesso ao Supabase (só servidor)
docs/prints/                 # prints das telas no celular
```
