import { QueryClient } from "@tanstack/react-query";

/**
 * QueryClient padronizado com defaults sensatos para a aplicação.
 *
 * - staleTime: 2 minutos (evita refetch desnecessário; realtime cuida de updates)
 * - gcTime: 10 minutos (mantém cache útil por mais tempo)
 * - retry: não retry em 401/403 (erro de auth não se resolve com retry)
 * - refetchOnWindowFocus: desativado (evita ruído em uso intensivo)
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60 * 2, // 2 minutos – realtime invalida quando necessário
        gcTime: 1000 * 60 * 10, // 10 minutos
        refetchOnWindowFocus: false,
        refetchOnReconnect: "always",
        retry: (failureCount, error: any) => {
          const status = error?.status ?? error?.code;
          if (status === 401 || status === 403 || status === "PGRST301") {
            return false;
          }
          return failureCount < 2;
        },
      },
      mutations: {
        retry: false,
      },
    },
  });
}
