/**
 * Factory de query keys centralizada.
 * Evita strings soltas espalhadas pelo código e garante consistência.
 * 
 * Padrão: [scope, ...params]
 * Ex: queryKeys.tasks.list({ month: "2026-01" }) => ["tasks", { month: "2026-01" }]
 */
export const queryKeys = {
  // ─────────────────────────────────────────────────────────────
  // Profiles & Team
  // ─────────────────────────────────────────────────────────────
  profiles: {
    all: ["profiles"] as const,
  },
  teamMembers: {
    all: ["team_members"] as const,
  },

  // ─────────────────────────────────────────────────────────────
  // App Settings
  // ─────────────────────────────────────────────────────────────
  appSettings: {
    all: ["app_settings"] as const,
  },

  // ─────────────────────────────────────────────────────────────
  // Clients (Agenda)
  // ─────────────────────────────────────────────────────────────
  clients: {
    all: ["clients"] as const,
  },
  clientStages: {
    byClient: (clientId: string) => ["client_stages", clientId] as const,
  },

  // ─────────────────────────────────────────────────────────────
  // Client Cycles (Magic Number v1)
  // ─────────────────────────────────────────────────────────────
  clientCycles: {
    all: ["client_cycles"] as const,
    byYear: (year: number) => ["client_cycles", year] as const,
    byYearMonth: (year: number, month: number) => ["client_cycles", year, month] as const,
  },
  clientCycleStages: {
    byYear: (year: number) => ["client_cycle_stages", { year }] as const,
    byYearMonth: (year: number, month: number) => ["client_cycle_stages", { year, month }] as const,
  },

  // ─────────────────────────────────────────────────────────────
  // Magic2
  // ─────────────────────────────────────────────────────────────
  magic2: {
    all: ["magic2"] as const,
    month: (year: number, month: number) => ["magic2", "month", { year, month }] as const,
    dashboard: (year: number, month: number) => ["magic2", "dashboard", { year, month }] as const,
    year: (year: number) => ["magic2", "year", year] as const,
    inactiveAgendaClients: (year: number, month: number) =>
      ["magic2", "inactive-agenda-clients", { year, month }] as const,
  },

  // ─────────────────────────────────────────────────────────────
  // Tasks (Agenda)
  // ─────────────────────────────────────────────────────────────
  tasks: {
    all: ["tasks"] as const,
    list: (params?: {
      month?: string;
      start?: string;
      end?: string;
      assignedUserId?: string;
      clientId?: string;
    }) => ["tasks", params ?? {}] as const,
  },

  // ─────────────────────────────────────────────────────────────
  // Performance
  // ─────────────────────────────────────────────────────────────
  performance: {
    byYear: (year: number) => ["performance_scores", year] as const,
  },

  // ─────────────────────────────────────────────────────────────
  // User Roles
  // ─────────────────────────────────────────────────────────────
  userRoles: {
    byUser: (userId: string) => ["user_roles", userId] as const,
  },

  // ─────────────────────────────────────────────────────────────
  // Access Requests (Admin)
  // ─────────────────────────────────────────────────────────────
  accessRequests: {
    all: ["access_requests"] as const,
  },
} as const;

/**
 * Helper para invalidar queries de forma consistente.
 * Mantém compatibilidade com invalidações parciais (prefixo).
 */
export type QueryKeyScope = keyof typeof queryKeys;
