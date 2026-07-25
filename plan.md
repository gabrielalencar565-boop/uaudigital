# Plano de Migração — UAU Digital: Lovable Cloud → Vercel + Supabase próprio

## Contexto

O projeto **UAU Digital** (repo `gabrielalencar565-boop/uaudigital`, projeto Lovable `48fe0349-cfbf-4295-8c8b-6d5b265c8ef6`) é uma SPA Vite + React + TypeScript + shadcn/ui, hoje hospedada em `uaudigital.lovable.app` e rodando sobre um projeto **Supabase gerenciado pelo Lovable Cloud** (`mkgxjeyztruvigdoecwe.supabase.co`). É um sistema em produção ativa (gestão de equipe/clientes de agência), com **~230 migrations SQL** e **7 Edge Functions**, ou seja, tem dados reais de usuários que não podem ser perdidos na migração.

O objetivo é sair do Lovable Cloud (hosting + Supabase gerenciado) e passar a hospedar em infraestrutura própria: **Vercel** (frontend) + **Supabase próprio** (banco, auth, storage, edge functions). Você já tem os conectores Vercel e Supabase conectados no claude.ai.

## Inventário do que é específico do Lovable (precisa ser tratado)

| Item | Onde | O que fazer |
|---|---|---|
| AI Gateway do Lovable (`ai.gateway.lovable.dev`, `LOVABLE_API_KEY`) | `supabase/functions/ai-improve-text/index.ts` | Trocar por uma chamada direta a um provedor de IA (ex: Google Gemini API diretamente, já que o gateway usa `google/gemini-2.5-flash`) |
| `lovable-tagger` (devDependency) + `componentTagger()` | `vite.config.ts`, `package.json` | Remover — é só uma ferramenta do editor Lovable, não afeta build de produção, mas não faz sentido mantê-la |
| Detecção de hostname `lovableproject.com` | `src/main.tsx:81`, `src/components/pwa/PwaInstallPrompt.tsx:35` | Ajustar a lógica de "ambiente de preview" para o novo domínio/preview do Vercel (`*.vercel.app`) |
| URLs hardcoded `uaudigital.lovable.app` | `src/features/projetos/components/HealthScoreTab.tsx:224,239` | Trocar pelo domínio novo definitivo (env var, não hardcode) |
| Meta tags Lovable (`og:image`, `twitter:site @Lovable`, `author=Lovable`) | `index.html` | Atualizar para branding próprio |
| Ícone hospedado em `storage.googleapis.com/gpt-engineer-file-uploads/...` | `index.html` | Baixar o asset e servir de `/public` |
| `README.md` menciona "Backend: Supabase (Lovable Cloud)" | `README.md` | Atualizar descrição de stack |

Nenhum outro acoplamento estrutural forte com o Lovable foi encontrado — o app já usa `@supabase/supabase-js` puro (`src/integrations/supabase/client.ts`), então a maior parte da migração é de **infraestrutura**, não de código.

## Fase 1 — Provisionar o novo Supabase

1. Criar um projeto Supabase novo (via conector Supabase já autenticado), na região mais próxima dos usuários atuais.
2. Rodar `supabase link` + `supabase db push` (ou aplicar as ~230 migrations de `supabase/migrations/` em ordem) contra o projeto novo — isso recria schema, RLS policies, e os 4 buckets de storage (`app-assets`, `crm-proposals`, `pm-attachments`, `avatars`, já criados via `INSERT INTO storage.buckets` nas migrations).
3. Habilitar as extensions usadas: `pg_cron` e `pg_net` (referenciadas em 2 migrations para jobs agendados).
4. Fazer deploy das 7 Edge Functions: `whatsapp-dispatch`, `ai-improve-text`, `public-cronograma`, `admin-generate-recovery-link`, `link-preview`, `whatsapp-webhook`, `public-health-score`.
5. Configurar os secrets das functions no projeto novo: `WHATSAPP_API_KEY`, `WHATSAPP_ZAPI_INSTANCE_ID`, os secrets dinâmicos por cliente (nome vem de `settings.api_key_secret` em runtime — conferir na tabela de configurações quais nomes existem hoje) e a nova chave do provedor de IA (substituindo `LOVABLE_API_KEY`). `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` são providos automaticamente pelo Supabase para as functions.
6. Recriar manualmente (não está no código, é config do dashboard do Lovable Cloud) as configurações de Auth: providers habilitados, redirect URLs, templates de e-mail, confirmação de e-mail on/off.

## Fase 2 — Migrar dados reais (o ponto mais delicado)

Como é produção com dados reais, schema vazio não basta:

1. **Dados das tabelas** (`public.*`): `pg_dump --data-only` do projeto Lovable Cloud → `pg_restore`/`psql` no projeto novo. Pode ser feito via Supabase CLI (`supabase db dump --data-only`) apontando a connection string do projeto antigo.
2. **Usuários de autenticação** (`auth.users` + `auth.identities`): copiar via `pg_dump` do schema `auth` entre os dois projetos Supabase (mesma versão major do Postgres/GoTrue) — preserva senhas com hash e não obriga reset. Testar com um usuário de teste antes de migrar todos.
3. **Arquivos de Storage**: copiar objetos dos 4 buckets do projeto antigo para o novo (script simples via Storage API, listando e baixando/subindo cada objeto, ou `rclone` com o endpoint S3-compatible do Supabase Storage).
4. Validar contagens (linhas por tabela, nº de usuários, nº de arquivos) entre origem e destino antes de seguir.

## Fase 3 — Ajustes de código

1. Aplicar as trocas da tabela de inventário acima (remover `lovable-tagger`, trocar AI gateway, remover hostname/URLs hardcoded, atualizar `index.html`).
2. Atualizar `.env` / variáveis do Vercel com as credenciais do **novo** projeto Supabase: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`.
3. Rodar `npm run build` e `npm run test` localmente para confirmar que nada quebrou com a remoção do `lovable-tagger`.

## Fase 4 — Deploy no Vercel

1. Importar o repo `gabrielalencar565-boop/uaudigital` no Vercel (conector já conectado).
2. Framework preset: Vite. Build command `npm run build` (ou `vite build`), output dir `dist`.
3. Adicionar `vercel.json` com rewrite de SPA (todas as rotas → `index.html`), já que o app usa `react-router-dom` client-side:
   ```json
   { "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
   ```
4. Configurar as env vars do passo anterior no dashboard do Vercel (Production + Preview).
5. Conferir o `manifest.json`/`service-worker.js` (PWA) — testar instalação do PWA no domínio novo, já que `start_url` e escopo do service worker dependem do domínio.

## Fase 5 — Corte (cutover) e testes

1. Deploy em domínio de preview do Vercel primeiro, testar fluxo completo (login, tarefas, storage, WhatsApp, AI improve-text) contra o **novo** Supabase.
2. Congelar escritas no projeto antigo (ou fazer uma migração incremental final dos dados gerados entre o dump inicial e o corte) para evitar perda de dados criados durante o teste.
3. Apontar o domínio customizado (ex: `uaudigital.com` ou o domínio atual) para o Vercel.
4. Manter o projeto Lovable Cloud antigo somente leitura por um período de segurança antes de desativar de vez.

## Riscos e pontos de atenção

- **Migração de `auth.users`**: é a parte com maior risco de erro silencioso — testar exaustivamente com poucos usuários antes de migrar a base toda.
- **Secrets dinâmicos por cliente** no WhatsApp dispatch (`settings.api_key_secret`): levantar a lista completa de nomes de secret em uso antes de recriar no projeto novo, senão o disparo de mensagens quebra silenciosamente por cliente.
- **`pg_cron`/`pg_net`**: confirmar se as extensions estão disponíveis no plano do novo projeto Supabase (algumas exigem approval/habilitação manual no dashboard).
- **AI Gateway**: sem o `ai.gateway.lovable.dev`, o custo e rate limit da função `ai-improve-text` passam a ser diretos com o provedor escolhido — vale revisar billing.

## Checklist final

- [ ] Projeto Supabase novo criado e migrations aplicadas
- [ ] Extensions `pg_cron`/`pg_net` habilitadas
- [ ] 7 Edge Functions deployadas com todos os secrets configurados
- [ ] Auth (providers, redirects, templates) reconfigurado
- [ ] Dados de `public.*`, `auth.*` e Storage migrados e validados
- [ ] Código sem dependências do Lovable (tagger, AI gateway, hostname checks, URLs hardcoded)
- [ ] Deploy no Vercel funcionando em preview com o Supabase novo
- [ ] Domínio customizado apontado para o Vercel
- [ ] Projeto Lovable Cloud antigo mantido em read-only por período de segurança
