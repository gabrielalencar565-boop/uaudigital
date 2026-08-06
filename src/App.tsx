import { useEffect, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import CronogramaPublic from "./pages/CronogramaPublic";
import AprovacaoPublic from "./pages/AprovacaoPublic";
import HealthScorePublic from "./pages/HealthScorePublic";
import Pending from "./pages/Pending";
import NotFound from "./pages/NotFound";
import { RedirectNotice } from "@/components/redirect/RedirectNotice";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { toast } from "sonner";
import { AppErrorBoundary } from "@/components/error/AppErrorBoundary";
import { useLocation } from "react-router-dom";
import { createQueryClient } from "@/lib/query-client";
import { AvatarBootstrap } from "@/components/avatar/AvatarBootstrap";
import { SplashScreen } from "@/components/SplashScreen";



function AppRoutes() {
  const location = useLocation();

  return (
    <AppErrorBoundary resetKey={location.pathname}>
      <Routes>
        <Route path="/auth" element={<Auth />} />
        <Route path="/pending" element={<Pending />} />
        <Route path="/cronograma/:taskId" element={<CronogramaPublic />} />
        <Route path="/avaliacao/:slug" element={<HealthScorePublic />} />
        <Route path="/aprovacao/:token" element={<AprovacaoPublic />} />
        <Route
          path="/"
          element={
            <RequireAuth>
              <Index />
            </RequireAuth>
          }
        />
        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AppErrorBoundary>
  );
}

const App = () => {
  const [queryClient] = useState(() => createQueryClient());
  const [showSplash, setShowSplash] = useState(() => {
    try {
      return sessionStorage.getItem("uau-splash-shown") !== "1";
    } catch {
      return true;
    }
  });


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
          <Toaster />
          <Sonner position="bottom-right" />
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
          {showSplash && (
            <SplashScreen
              onFinish={() => {
                try {
                  sessionStorage.setItem("uau-splash-shown", "1");
                } catch {
                  /* noop */
                }
                setShowSplash(false);
              }}
            />
          )}

          
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
    </>
  );
};

export default App;
