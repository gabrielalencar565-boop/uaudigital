# Planejamento do Mês em 5 Minutos · UAU Digital

O social media responde algumas perguntas sobre um cliente e recebe, na hora, um planejamento de conteúdo do mês: objetivo, metas, público, tom de voz e um calendário de 4 semanas em que cada post tem um papel na jornada do público. No fim, baixa um PDF para apresentar ao cliente.

- **Stack:** Next.js 16 (App Router) + TypeScript + Tailwind CSS 4
- **IA:** API da Anthropic (`@anthropic-ai/sdk`), modelo `claude-sonnet-5-5` por padrão, com saída estruturada validada por Zod
- **Plano B:** sem chave da Anthropic (ou se a IA falhar), o planejamento sai de modelos prontos preenchidos com as respostas. O app nunca mostra erro técnico.
- **Leads e gerações:** Supabase (tabelas `leads` e `geracoes`), gravados pelo servidor
- **Endereço:** `www.uaucomunicacaodigital.com.br/planejamento` (a landing repassa `/planejamento` para este projeto)

---

## Rodar localmente

```bash
cd planejamento
npm install
cp .env.example .env.local   # tudo é opcional para testar
npm run dev                  # http://localhost:3000/planejamento
```

```bash
npm test        # distribuição das fases, dias, plano B e validação do JSON
npm run lint
npm run build
```

## Onde editar

| O quê | Arquivo |
| --- | --- |
| Textos da interface | `src/data/textos.ts` |
| Nichos, objetivos, pesos das fases, formatos, tons, dias | `src/data/formulario.ts` |
| As 6 fases (nome, função, cor, posição no mês) | `src/data/fases.ts` |
| Modelos do plano B (ganchos, ideias, CTAs, metas, tom de voz, stories) | `src/data/modelos.ts` |
| Prompt de sistema da IA | `src/lib/ia.ts` (`PROMPT_SISTEMA`) |
| Lógica de distribuição | `src/lib/distribuicao.ts` |

## Como o planejamento é montado

1. **Esqueleto do mês (sempre nosso, nunca da IA):** total de posts = posts por semana × 4. A quantidade de cada fase segue os pesos do objetivo (arredondamento pelo maior resto; com 12 posts ou mais, toda fase aparece pelo menos uma vez). A ordem puxa Identificação e Solução para o começo e Resistência, Prova social e Recompensa para o fim, sem repetir a mesma fase seguida. Os dias seguem a tabela (2 = Ter/Qui, 3 = Seg/Qua/Sex, 4 = Seg/Ter/Qui/Sáb, 5 = Seg a Sex) e o formato é o preferido da fase entre os que o cliente topa.
2. **Conteúdo:** a IA recebe o esqueleto e escreve objetivo, metas, público, tom de voz, ganchos, ideias, CTAs, stories e as frases para apresentar. A resposta é validada com Zod. Se falhar, tenta de novo uma vez. Se falhar de novo (ou passar de 45 s, ou a IA recusar), entra o plano B.
3. **Regras de publicidade:** saúde (dentistas, médicos, psicólogos, nutricionistas, estética) sem promessa de resultado e sem antes e depois sem autorização; advocacia sem captação direta e sem promessa de resultado. Valem para a IA e para o plano B.

## Limites de uso (proteção de custo)

- **Por WhatsApp:** 3 gerações por dia.
- **Por IP:** 10 gerações por dia.
- **Como conta:** pela tabela `geracoes`, no horário de Brasília. Sem Supabase, a contagem fica na memória do servidor.

---

## Variáveis de ambiente

| Variável | Onde | Obrigatória | Para quê |
| --- | --- | --- | --- |
| `ANTHROPIC_API_KEY` | só servidor | não* | Chave da API da Anthropic |
| `ANTHROPIC_MODEL` | servidor | não | Modelo da IA. Padrão: `claude-sonnet-5-5` |
| `NEXT_PUBLIC_SUPABASE_URL` | servidor | não** | URL do projeto Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | só servidor | não** | Chave secreta do Supabase (`sb_secret_...` ou a antiga `service_role`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | não usada | não | Reservada |
| `ADMIN_PASSWORD` | servidor | para o `/admin` | Senha do admin |
| `NEXT_PUBLIC_META_PIXEL_ID` | navegador | não | Pixel da Meta (PageView, Lead, CompleteRegistration) |
| `NEXT_PUBLIC_SITE_URL` | servidor | não | `https://www.uaucomunicacaodigital.com.br` (sem `/planejamento`) |

\* Sem a chave, todo planejamento sai do plano B.
\*\* Sem o Supabase, os leads vão para o log do servidor (Vercel → projeto → **Logs**, procure por `[planejamento]`), a página `/p/[id]` só abre no aparelho de quem gerou, e o limite diário vale por instância.

---

## 1. Chave da Anthropic

1. Entre em [platform.claude.com](https://platform.claude.com) e crie a conta da UAU.
2. Em **Settings → Billing**, adicione um cartão e um crédito inicial (US$ 5 já dá para muitos testes).
3. Em **Settings → Limits**, defina um **limite de gasto mensal**. É a sua trava de segurança.
4. Em **Settings → API Keys**, clique em **Create Key**, dê o nome `planejamento-vercel` e copie a chave (`sk-ant-...`). Ela aparece uma vez só.
5. A chave vai só na Vercel, em `ANTHROPIC_API_KEY`. Não coloque no código nem mande para ninguém.

**Custo estimado:** cada planejamento usa algo como 3 mil tokens de entrada e 4 a 6 mil de saída. No `claude-sonnet-5-5` (US$ 2 por milhão de entrada e US$ 10 por milhão de saída), isso dá uns **US$ 0,05 a 0,07 por planejamento**. O admin mostra as gerações do dia para você acompanhar.

## 2. Supabase

Dá para usar o mesmo projeto do Raio-X, com tabelas novas.

1. Abra o projeto no [supabase.com](https://supabase.com) → **SQL Editor** → **New query**.
2. Cole e rode (**Run**):

```sql
create extension if not exists "pgcrypto";

create table if not exists public.leads_planejamento (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  nome          text not null,
  whatsapp      text not null,           -- formato 5511987654321
  instagram     text,
  consentimento boolean not null default true,
  respostas     jsonb,                   -- últimas respostas do formulário
  nicho         text,
  objetivo      text,
  utm_source    text,
  utm_medium    text,
  utm_campaign  text,
  utm_content   text,
  user_agent    text
);

create table if not exists public.geracoes (
  id            uuid primary key,
  created_at    timestamptz not null default now(),
  lead_id       uuid references public.leads_planejamento(id) on delete set null,
  whatsapp      text not null,
  ip            text,
  fonte         text not null check (fonte in ('ia', 'modelo')),
  modelo        text,
  mes           text not null,
  cliente_nome  text not null,
  nicho         text,
  objetivo      text,
  respostas     jsonb,
  plano         jsonb not null
);

create index if not exists geracoes_created_at_idx on public.geracoes (created_at desc);
create index if not exists geracoes_whatsapp_idx   on public.geracoes (whatsapp, created_at);
create index if not exists geracoes_ip_idx         on public.geracoes (ip, created_at);
create index if not exists geracoes_lead_idx       on public.geracoes (lead_id);
create index if not exists leads_planejamento_created_idx on public.leads_planejamento (created_at desc);

-- Só o servidor (chave secreta) lê e grava.
alter table public.leads_planejamento enable row level security;
alter table public.geracoes enable row level security;
grant all on public.leads_planejamento to service_role;
grant all on public.geracoes to service_role;
```

3. Em **Project Settings → API Keys**, copie a **Secret key** (`sb_secret_...`). A **Project URL** está no topo da página inicial do projeto.

## 3. Vercel

1. **Add New… → Project** → importe `uaudigital`.
2. **Project Name:** `planejamentodomes`.
3. **Root Directory:** **Edit** → `planejamento` → **Continue**. Confira se o preset virou **Next.js**.
4. **Environment Variables:** `ANTHROPIC_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_PASSWORD`, `NEXT_PUBLIC_SITE_URL`.
5. **Deploy.** Teste em `https://<endereço-do-projeto>.vercel.app/planejamento`.
6. Em **Settings → Domains**, confira o endereço `.vercel.app` do projeto. A landing repassa `/planejamento` para ele (rewrite no `site-uau/vercel.json`).

A geração com IA pode levar até 45 s. A rota já pede 60 s de execução (`maxDuration`), que é o máximo do plano Hobby.

---

## Telas

- **Visual:** o mesmo da landing da UAU (fundo escuro, faixa clara no objetivo do mês, degradê roxo → magenta → laranja, botões em pílula e a logo real).
- **Fluxo:** inicial → 4 etapas → contato → geração → planejamento.
- **Resultado:**
  - cards de objetivo, público e tom de voz
  - legenda das 6 fases e calendário de 4 semanas
  - stories da semana e frases para apresentar ao cliente
  - botões: PDF, copiar, gerar de novo e planejar outro cliente
- **Prompt pronto em cada post:** o botão "Copiar prompt do roteiro" gera um texto para colar no ChatGPT ou no Claude e receber o roteiro do post (Reels cena a cena, carrossel slide a slide ou arte estática, sempre com legenda). O prompt usa só o que está no planejamento (marca, público, dor, objeção, tom, fase, gancho, ideia, CTA) e as regras de publicidade do nicho. Edite em `src/lib/promptRoteiro.ts`.
- **`/p/[id]`:** reabre um planejamento salvo, sem os dados do lead.
- **`/admin`:** leads (nicho, objetivo, nº de gerações), gerações de hoje e exportação CSV.
- **PDF:** A4 branco com detalhes nas cores da UAU (roxo, magenta e laranja) e a fonte Bricolage embutida. O rodapé discreto é a única menção à UAU.
