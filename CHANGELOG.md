# 📋 Changelog - Uau Digital

Todas as mudanças notáveis neste projeto serão documentadas neste arquivo.

## [2.0.0] - 2025-01-31

### ✨ Novidades

#### Pontuação Automática de Desempenho
- Todas as 5 categorias agora são calculadas automaticamente:
  - **Metas/Prazos**: +1 por entrega no prazo, -1 por atraso
  - **Aprendizado Contínuo**: 2pts para 4+ etapas diferentes, 1pt para 2-3 etapas
  - **Padrão de Qualidade**: 1pt se taxa de conclusão ≥ 80%
  - **Ambiente Organizado**: 1pt se ≥ 30% das entregas são antecipadas
  - **Comprometimento**: 1pt se ≥ 5 tarefas concluídas no mês
- Removido botão "Editar Pontuação" - sistema 100% automático
- Trigger `tasks_sync_all_scores` recalcula pontuação a cada mudança de tarefa

#### Navegação por Mês no Dashboard
- Adicionado seletor de mês/ano na Visão do Dia
- Dashboard e Modo TV agora respeitam o mês selecionado
- Navegação consistente entre Magic Number e Agenda

#### Modo TV Funcional
- Corrigido botão de Modo TV que não funcionava
- Modo TV agora abre em tela cheia com navegação de meses
- Suporte para visualização tanto de Magic Number quanto Agenda

#### Layout da Agenda Semanal
- Colunas com largura fixa de 280px
- Scroll horizontal para semanas com muitas tarefas
- Melhor legibilidade das informações de cada tarefa

### 🔧 Correções

#### Limpeza de Dados Órfãos
- Criada função `list_users_admin` que filtra usuários deletados
- Limpeza automática de registros em `access_requests`, `team_members`, `profiles`, `user_roles`
- AdminPanel agora mostra email real do usuário (de `auth.users`)

#### Validação de Clientes Duplicados
- Adicionado índice único case-insensitive em `clients.name`
- Criada função `check_client_exists` para validação prévia
- Frontend bloqueia criação de cliente com nome já existente

#### Sincronização em Tempo Real
- Expandido `use-realtime-sync` para incluir:
  - `access_requests`
  - `team_members`
  - `profiles`

### 🗄️ Migrações de Banco

- `20260131172344_*.sql`: Limpeza de órfãos + RPC `list_users_admin` + índice único clientes
- `20260131173144_*.sql`: Função `recompute_all_scores` + trigger automático

---

## [1.5.0] - 2025-01-30

### ✨ Novidades
- Sistema de ranking de desempenho mensal e anual
- Gráfico radar de competências (Top 3)
- Relatório de prazos para administradores

### 🔧 Correções
- Correção na navegação do calendário (ancoragem no 1º dia do mês)
- Melhoria no filtro de membros elegíveis para rankings

---

## [1.0.0] - 2025-01-15

### 🎉 Lançamento Inicial
- Sistema de autenticação com aprovação de admin
- Agenda com visualização mensal e semanal
- Magic Number com checklist de etapas
- Painel administrativo de usuários e clientes
- Integração completa com Supabase
