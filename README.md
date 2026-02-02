# 🎨 Uau Digital - Sistema de Gestão de Marketing

Sistema interno de gestão de equipe e clientes para agência de marketing digital.

## ✨ Funcionalidades

### 📋 Agenda
- **Visualização Mensal/Semanal**: Calendário interativo com drag-and-drop
- **Gestão de Tarefas**: Criação, edição e acompanhamento de tarefas por cliente
- **Atribuição de Equipe**: Multi-seleção de responsáveis por tarefa
- **Ciclos Mensais**: Controle de entregas por mês/ano

### 🔢 Magic Number
- **Dashboard de Etapas**: Acompanhamento visual do progresso de cada cliente
- **Checklist por Ciclo**: 7 etapas (Captação → Agendamento)
- **Navegação por Mês/Ano**: Filtro temporal para visualizar ciclos anteriores
- **Modo TV**: Visualização em tela cheia para monitores da agência

### 📊 Desempenho
- **Pontuação Automática**: 5 categorias calculadas automaticamente:
  - Metas/Prazos (entregas no prazo)
  - Aprendizado Contínuo (variedade de etapas)
  - Padrão de Qualidade (taxa de conclusão)
  - Ambiente Organizado (entregas antecipadas)
  - Comprometimento (volume de tarefas)
- **Ranking Mensal/Anual**: Comparativo entre membros da equipe
- **Radar de Competências**: Gráfico visual do Top 3

### 👥 Administração
- **Gestão de Usuários**: Aprovação/rejeição de solicitações de acesso
- **Gestão de Clientes**: CRUD com validação de duplicatas
- **Controle de Papéis**: Admin, Planner, Collaborator
- **Limpeza de Dados**: Remoção automática de registros órfãos

### 🖥️ Meu Painel
- **Tarefas Pessoais**: Visualização das tarefas atribuídas
- **Performance Individual**: Ranking e pontuação do usuário logado

## 🛠️ Tecnologias

- **Frontend**: React 18 + TypeScript + Vite
- **Estilização**: Tailwind CSS + shadcn/ui
- **Backend**: Supabase (Lovable Cloud)
- **Estado**: TanStack Query (React Query)
- **Drag & Drop**: @dnd-kit
- **Gráficos**: Recharts

## 🚀 Instalação Local

```bash
# Clonar o repositório
git clone <YOUR_GIT_URL>

# Instalar dependências
npm install

# Iniciar servidor de desenvolvimento
npm run dev
```

## 📁 Estrutura do Projeto

```
src/
├── components/       # Componentes reutilizáveis (UI, layout)
├── features/         # Módulos por funcionalidade
│   ├── admin/        # Painel administrativo
│   ├── agenda/       # Calendário e tarefas
│   ├── dayview/      # Visão do dia / Modo TV
│   ├── magic2/       # Magic Number (dashboard)
│   ├── meu-painel/   # Painel pessoal
│   └── performance/  # Desempenho e rankings
├── hooks/            # Hooks customizados
├── integrations/     # Cliente Supabase
├── lib/              # Utilitários
└── pages/            # Páginas da aplicação
```

## 🔐 Autenticação

O sistema usa autenticação via email com confirmação obrigatória. Novos usuários precisam:
1. Criar conta com email/senha
2. Confirmar email
3. Aguardar aprovação de um administrador

## 📝 Licença

Projeto privado - Uau Digital © 2025
