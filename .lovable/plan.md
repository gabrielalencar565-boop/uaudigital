
## Diagnóstico do problema

Investiguei por que o gatilho "Assumiu 1º lugar" não chegou no grupo. O ID configurado na automação é `5599826449551560491860` (apenas dígitos). O Z-API exige o formato **com hífen** (`559982644955-1560491860` ou com sufixo `@g.us`) para enviar a um grupo.

No payload bruto que chegou pelo webhook, o `phone` original era de fato `559982644955-1560491860`, mas o sistema **removeu o hífen** ao salvar em `whatsapp_contacts.phone_e164`. Resultado: ao clicar em "ID" no Conversar, copiamos um ID sem hífen; o dispatcher então roda `isGroupId()` (procura por `-` ou `@g.us`) → não reconhece como grupo → trata como telefone normal → Z-API tenta enviar para um número de telefone inexistente.

Mesma raiz afeta os 4 grupos atuais:
- `Eu` → deveria ser `559982644955-1560491860`
- `UAU TEAM 💜⚡️` / `Gerência Uau` / `Comunidade - Uau Digital` → IDs Z-API completos no formato `120363xxx-xxxxxx`

## O que vou implementar

### 1. Preservar o hífen do ID do grupo (webhook + dispatcher)
- Ajustar a normalização no `whatsapp-webhook` para, quando `isGroup=true`, **manter o `phone` original** (com hífen) ao inserir em `whatsapp_messages.contact_phone` e em `whatsapp_contacts.phone_e164`.
- Garantir que `isGroupId()` no dispatcher trate qualquer string que tenha contido hífen como grupo (já trata, só precisa receber o valor correto).

### 2. Corrigir os contatos de grupo já existentes
- Migration de dados: para cada contato com `origin = 'grupo'`, reler o último `whatsapp_messages.raw->>'phone'` daquele grupo e atualizar `phone_e164` para o valor original com hífen. Atualizar também o `phone_key` (já preserva hífen, ok).
- Atualizar a automação "Assumiu 1º lugar" para o `group_phone` corrigido do grupo "Eu" (`559982644955-1560491860`), assim o próximo evento vai para o grupo.

### 3. Botão "Testar" em cada card de automação
- No `AutomationCard` (Central de Automações) adicionar botão **"Testar"** (ícone Send).
- Ao clicar, enviar uma única mensagem renderizada com **dados de exemplo** (`nome=Gabriel`, `primeiro_nome=Gabriel`, `tarefa=Tarefa de teste`, `cliente=Cliente Demo`, `prazo=12/06/2026`, `xp=120`, `nivel=5`, `ranking=1º lugar`, `tarefas_do_dia=• Exemplo`, etc.).
- Roteamento conforme audiência configurada:
  - `group` → envia direto pelo `whatsapp-dispatch` (action `send` com `phone=group_phone`) para o ID do grupo.
  - `assignee` / `all_team` / `admins` → envia para o **admin que disparou o teste** (próprio número), com o prefixo `🧪 [TESTE] ` para deixar claro.
- Toast com resultado (sucesso/erro + status code).

### 4. UI do Conversar
- Manter o botão "Copiar ID" mas agora copiando o `phone_e164` já com hífen (após a correção dos dados).

## Detalhes técnicos

- **Webhook**: na função `normalizePhoneOrGroup`, quando `isGroup`, retornar o `phone` bruto em lowercase sem `@g.us`, **sem aplicar regex de dígitos**.
- **Dispatcher / action `send`**: aceita `phone` arbitrário (já aceita), `isGroupId` cobre os formatos com hífen e `@g.us` — sem mudanças funcionais.
- **Migration**: bloco PL/pgSQL que faz `UPDATE whatsapp_contacts SET phone_e164 = ...` baseado em `raw->>'phone'` da última mensagem de cada grupo, lidando com a unique constraint (`phone_e164_key`).
- **Botão Testar**: chama `supabase.functions.invoke('whatsapp-dispatch', { body: { action: 'send', phone, type: 'automation_test', message } })`.

## Arquivos afetados

- `supabase/functions/whatsapp-webhook/index.ts` — preservar hífen em grupos
- `supabase/migrations/<novo>.sql` — corrigir contatos e o `group_phone` da automação `xp_first`
- `src/features/admin/whatsapp/AutomationsCenter.tsx` — botão Testar + handler
- (opcional) `src/features/admin/whatsapp/use-whatsapp-automations.ts` — mutation `useTestAutomation`

Sem mudanças no schema, apenas dados e código.
