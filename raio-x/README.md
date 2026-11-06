# Raio-X do Social Media · UAU Digital

Diagnóstico interativo: o social media deixa o contato (nome, WhatsApp e @), responde 12 perguntas (2 por área) e recebe um **diagnóstico completo**: nota de 0 a 100, nível, radar, principal gargalo, plano de ação em 3 passos e a análise de cada área com as respostas dela e o que um estrategista faria no lugar.

- **Stack:** Next.js 16 (App Router) + TypeScript + Tailwind CSS 4
- **Leads:** Supabase (tabela `leads`). O contato é gravado antes das perguntas (`POST /api/leads`, status `iniciado`) e o resultado completa o mesmo registro no fim (`PATCH /api/leads`, status `concluido`). Quem desiste no meio continua na lista.
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
  -- contato (preenchido ANTES das perguntas)
  nome              text not null,
  whatsapp          text not null,           -- formato 5511987654321
  instagram         text,                    -- sem o @
  consentimento     boolean not null default true,
  status            text not null default 'iniciado' check (status in ('iniciado', 'concluido')),
  -- resultado (preenchido quando a pessoa termina)
  concluido_em      timestamptz,
  nota_geral        smallint check (nota_geral between 0 and 100),
  nota_objetivo     smallint,
  nota_diagnostico  smallint,
  nota_concorrentes smallint,
  nota_conteudo     smallint,
  nota_apresentacao smallint,
  nota_valor        smallint,
  nivel             text,
  gargalo           text,
  respostas         jsonb,                   -- [{ id, area, pergunta, resposta, pontos }]
  -- origem
  utm_source        text,
  utm_medium        text,
  utm_campaign      text,
  utm_content       text,
  user_agent        text
);

create index if not exists leads_created_at_idx on public.leads (created_at desc);
create index if not exists leads_whatsapp_idx   on public.leads (whatsapp);
create index if not exists leads_status_idx     on public.leads (status);

-- Segurança: RLS ligado e nenhuma policy pública.
-- Só o servidor (com a service_role key) consegue ler e gravar.
alter table public.leads enable row level security;
```

**Já tinha criado a tabela com a versão anterior?** Rode isto para atualizar:

```sql
alter table public.leads
  add column if not exists status text not null default 'concluido',
  add column if not exists concluido_em timestamptz;
alter table public.leads alter column status set default 'iniciado';
alter table public.leads
  alter column nota_geral drop not null,
  alter column nota_objetivo drop not null,
  alter column nota_diagnostico drop not null,
  alter column nota_concorrentes drop not null,
  alter column nota_conteudo drop not null,
  alter column nota_apresentacao drop not null,
  alter column nota_valor drop not null,
  alter column nivel drop not null,
  alter column gargalo drop not null,
  alter column respostas drop not null;
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
6. Teste: preencha o contato, abra `/admin` e veja o lead como "Só iniciou". Termine o raio-x, atualize o admin e confira se virou "Concluiu" com a nota.

Ao mudar uma variável de ambiente, faça um **Redeploy** para valer.

### Link para a bio / comentários

Use UTMs para saber de onde veio cada lead, por exemplo:

```
https://SEU-DOMINIO/?utm_source=instagram&utm_medium=comentario&utm_campaign=raiox&utm_content=video1
```

As UTMs ficam salvas mesmo se a pessoa navegar pelo teste e vão junto com o lead.

---

## Como funciona

- **Fluxo:** inicial → contato → 12 perguntas → "área concluída" a cada 2 perguntas (faixa clara) → diagnóstico completo.
- **Diagnóstico completo:** nota e nível, radar, principal gargalo, plano de ação (as 3 áreas mais fracas, na ordem, com o primeiro passo de cada) e um card por área com a análise da faixa (Crítico, Frágil, Em desenvolvimento, Avançado), as 2 respostas da pessoa e, quando a resposta não foi a ideal, "Como um estrategista faz". Esses textos ficam em `src/data/raiox.ts` (`analysis` em cada área e `tip` em cada pergunta).
- **Pontuação:** cada opção vale 0 a 3. Nota da área = soma ÷ 6 × 100 (arredondada). Nota geral = média das 6 áreas (arredondada). A nota é recalculada no servidor a partir das respostas.
- **Gargalo:** área com menor nota. Empate: Objetivo → Apresentação → Diagnóstico → Conteúdo → Valor → Concorrentes.
- **Área mais forte:** maior nota. Empate: ordem das áreas (01 a 06).
- **Opções embaralhadas** por pessoa (a ordem fica salva, então não muda se ela voltar ou recarregar).
- **Progresso salvo** no `localStorage`. Se a pessoa fechar a aba no meio, a tela inicial mostra "Continuar da pergunta X". Quem já viu o resultado volta direto para ele. "Refazer o raio-x" mantém o contato e zera só as respostas (o registro do lead é atualizado com o novo resultado). Se o envio do resultado falhar (sem internet), o app tenta de novo na próxima vez que a pessoa abrir.
- **Story:** "Compartilhar no story" gera um PNG 1080×1920 no próprio navegador (canvas, sem biblioteca) e abre o compartilhamento do celular. No desktop, baixa a imagem.
- **Pixel da Meta:** só carrega com `NEXT_PUBLIC_META_PIXEL_ID`. PageView na entrada, Lead ao enviar o contato (antes das perguntas) e CompleteRegistration ao ver o diagnóstico (uma vez).
- **Admin:** `/admin` pede a senha (`ADMIN_PASSWORD`), lista os leads com o status ("Concluiu" ou "Só iniciou") e exporta CSV (separado por `;`, abre direto no Excel).

## Estrutura

```
src/
  app/
    page.tsx                 # monta o <RaioX />
    layout.tsx               # fonte, SEO e Pixel
    opengraph-image.tsx      # imagem de compartilhamento 1200x630
    api/leads/route.ts       # POST (contato) e PATCH (resultado) /api/leads
    admin/                   # página de admin, login e exportação CSV
  components/
    RaioX.tsx                # controla as telas e o progresso
    Intro, LeadForm, Question, AreaDone, Result, AreaDiagnosis,
    RadarChart, AreaBars, ShareImage, Logo, MetaPixel, Rich
  data/raiox.ts              # TODOS os textos e perguntas
  lib/
    scoring.ts               # cálculo das notas, nível e gargalo
    validation.ts            # WhatsApp, Instagram, nome
    storage.ts               # localStorage seguro + UTMs
    supabase.ts              # acesso ao Supabase (só servidor)
docs/prints/                 # prints das telas no celular
```
