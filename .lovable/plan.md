## Adições à aba Recompensas

### 1. Nova aba "Critérios para ganhar XP"
Criar uma seção dedicada dentro do painel Recompensas explicando como o colaborador acumula XP.

**Visão do colaborador (read-only):**
- Lista de critérios com ícone, título, descrição e valor em XP (ex.: "Tarefa entregue no prazo +10 XP", "Bônus de excelência +25 XP", "Atraso -5 XP").
- Agrupamento por categoria (Produtividade, Qualidade, Penalidades, Bônus).
- Histórico recente de XP ganho/perdido do próprio usuário (já existe `user_xp_events` — listar últimos eventos com motivo).

**Visão do admin (mesma aba, modo edição):**
- CRUD completo dos critérios: criar, editar, excluir, ativar/desativar.
- Campos: nome, descrição, valor XP (positivo ou negativo), categoria, ícone, ativo.

**Backend:** nova tabela `xp_criteria` com RLS (todos autenticados leem ativos; admin gerencia).

### 2. Seletor de ícone em Recompensas, Níveis e Critérios
Adicionar campo "Ícone" nos formulários de:
- Recompensa (tabela `rewards`)
- Nível (tabela `reward_levels`)
- Critério de XP (nova tabela `xp_criteria`)

**Componente:** picker visual com busca usando ícones do `lucide-react` (mesma abordagem do `IconPicker` já existente em `src/features/agenda/components/IconPicker.tsx` — reaproveitar).

**Storage:** coluna `icon` TEXT armazenando o nome do ícone Lucide (ex.: `"Gift"`, `"Trophy"`, `"Star"`). Renderização dinâmica via `icons[name]` do lucide-react.

**UI:**
- Cards de recompensa exibem o ícone escolhido no lugar do 🎁 padrão.
- Cards/badges de nível exibem o ícone escolhido.
- Critérios exibem o ícone na listagem.
- Fallback para ícone padrão se `icon` for nulo.

### Detalhes técnicos

**Migração SQL:**
- `ALTER TABLE rewards ADD COLUMN icon TEXT;`
- `ALTER TABLE reward_levels ADD COLUMN icon TEXT;`
- `CREATE TABLE public.xp_criteria (id, name, description, xp_value INT, category TEXT, icon TEXT, is_active BOOL, sort_order INT, created_at, updated_at)` + GRANTs + RLS (SELECT para authenticated, ALL para admin via `has_role`) + trigger de `updated_at`.
- Seed inicial de critérios padrão (entrega no prazo, atraso, excelência, etc.).

**Frontend (`RecompensasPanel.tsx`):**
- Nova aba interna "Critérios" via `Tabs` (Loja | Critérios | Admin se aplicável).
- Componente `IconPickerPopover` reutilizável para escolher ícone Lucide em recompensas, níveis e critérios.
- Componente `DynamicLucideIcon` para renderizar por nome.

### Não incluso
- Lógica automática de concessão de XP por critério (continua manual via admin); apenas catálogo informativo + admin pode debitar/creditar como já existe.
