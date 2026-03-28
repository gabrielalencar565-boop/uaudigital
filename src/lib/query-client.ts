import { QueryClient } from "@tanstack/react-query";

/**
 * QueryClient padronizado com defaults sensatos para a aplicação.
 * 
 * - staleTime: 2 minutos (evita refetch desnecessário em navegação rápida)
 * - gcTime: 10 minutos (mantém cache útil por mais tempo)
 * - retry: não retry em 401/403 (erro de auth não se resolve com retry)
 * - refetchOnWindowFocus: desativado (evita ruído em uso intensivo)
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 30, // 30 segundos – mais responsivo com realtime
        gcTime: 1000 * 60 * 10, // 10 minutos (antigo cacheTime)
        refetchOnWindowFocus: false,
        retry: (failureCount, error: any) => {
          // Não retry em erros de autenticação/autorização
          const status = error?.status ?? error?.code;
          if (status === 401 || status === 403 || status === "PGRST301") {
            return false;
          }
          // Retry até 2 vezes para outros erros
          return failureCount < 2;
        },
      },
      mutations: {
        retry: false, // Mutations não devem fazer retry automático
      },
    },
  });
}
