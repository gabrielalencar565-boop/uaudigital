import { useEffect, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { APP_TAB_ROUTES } from "@/lib/app-routes";
import { ThemeProvider } from "next-themes";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import CronogramaPublic from "./pages/CronogramaPublic";
import AprovacaoPublic from "./pages/AprovacaoPublic";
import RelatorioPublic from "./pages/RelatorioPublic";
import HealthScorePublic from "./pages/HealthScorePublic";
import Pending from "./pages/Pending";
import Onboarding from "./pages/Onboarding";
import Convite from "./pages/Convite";
import InstagramCallback from "./pages/InstagramCallback";
import DriveCallback from "./pages/DriveCallback";
import { StageCatalogProvider } from "./features/gestao/StageCatalogProvider";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import DataDeletion from "./pages/DataDeletion";
import NotFound from "./pages/NotFound";
import { RedirectNotice } from "@/components/redirect/RedirectNotice";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { toast } from "sonner";
import { AppErrorBoundary } from "@/components/error/AppErrorBoundary";
import { useLocation } from "react-router-dom";
import { createQueryClient } from "@/lib/query-client";
import { AvatarBootstrap } from "@/components/avatar/AvatarBootstrap";
import { BrandColorProvider } from "@/components/theme/BrandColorProvider";
import { AutoPushPrompt } from "@/components/notifications/AutoPushPrompt";
import { useSession } from "@/hooks/use-session";



function AppRoutes() {
  const location = useLocation();

  return (
    <AppErrorBoundary resetKey={location.pathname}>
      <Routes>
        <Route path="/auth" element={<Auth />} />
        <Route path="/pending" element={<Pending />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/convite/:token" element={<Convite />} />
        <Route path="/cronograma/:taskId" element={<CronogramaPublic />} />
        <Route path="/avaliacao/:slug" element={<HealthScorePublic />} />
        <Route path="/aprovacao/:token" element={<AprovacaoPublic />} />
        <Route path="/relatorio/:token" element={<RelatorioPublic />} />
        <Route path="/privacidade" element={<PrivacyPolicy />} />
        <Route path="/exclusao-de-dados" element={<DataDeletion />} />
        <Route
          path="/admin/instagram-callback"
          element={
            <RequireAuth>
              <InstagramCallback />
            </RequireAuth>
          }
        />
        <Route
          path="/admin/drive-callback"
          element={
            <RequireAuth>
              <DriveCallback />
            </RequireAuth>
          }
        />
        <Route path="/" element={<Navigate to="/meu-painel" replace />} />
        {APP_TAB_ROUTES.map((path) => (
          <Route
            key={path}
            path={`/${path}`}
            element={
              <RequireAuth>
                <StageCatalogProvider>
                  <Index />
                </StageCatalogProvider>
              </RequireAuth>
            }
          />
        ))}
        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AppErrorBoundary>
  );
}

const App = () => {
  const [queryClient] = useState(() => createQueryClient());
  const { loading: sessionLoading } = useSession();

  // Fluxo loader foi aberto em index.html antes do React montar — fecha assim que a
  // autenticação terminar de resolver (sabemos se há usuário ou não).
  useEffect(() => {
    if (!sessionLoading) window.__fluxoLoader?.hide();
  }, [sessionLoading]);


  // Safety-net: evita "tela branca" por erros assíncronos não tratados em alguns aparelhos.
  useEffect(() => {
    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error("Unhandled promise rejection:", event.reason);
      toast.error("Ocorreu um erro inesperado. Tente novamente.");
      event.preventDefault();
    };

    const onError = (event: ErrorEvent) => {
      console.error("Global error:", event.error ?? event.message);
      toast.error("Ocorreu um erro inesperado. Tente novamente.");
    };

    window.addEventListener("unhandledrejection", onUnhandledRejection);
    window.addEventListener("error", onError);
    return () => {
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
      window.removeEventListener("error", onError);
    };
  }, []);

  return (
    <>
      <RedirectNotice />
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} storageKey="uau-theme">

      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <AvatarBootstrap />
          <BrandColorProvider />
          <AutoPushPrompt />
          <Toaster />
          <Sonner position="bottom-right" />
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
    </>
  );
};

export default App;
