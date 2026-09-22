import { useEffect, useState } from "react";
import { Sparkles, X } from "lucide-react";
import { useAppSettings } from "@/features/data/queries";
import { useAppUpdateAvailable } from "@/hooks/use-app-update-available";
import type { MainTab } from "@/components/layout/UauSidebarShell";
import { setPendingMeuPainelAction, type MeuPainelPendingAction } from "@/lib/pending-meu-painel-action-store";
import { setPendingHighlight } from "@/lib/pending-highlight-store";

const DISMISS_KEY = "uau_whats_new_dismissed_at";
const VALID_ACTIONS: MeuPainelPendingAction[] = ["highlight_personalize"];

function switchTab(tab: MainTab, action: string | null, targetSelector: string | null) {
  // As duas formas de "chamar atenção pra algo" precisam ser guardadas ANTES de trocar de
  // aba: se o painel de destino ainda não estiver montado, ele só lê o valor pendente no
  // próprio mount — um CustomEvent sozinho chegaria cedo demais e se perderia.
  if (action && VALID_ACTIONS.includes(action as MeuPainelPendingAction)) {
    setPendingMeuPainelAction(action as MeuPainelPendingAction);
  }
  if (targetSelector) {
    setPendingHighlight(targetSelector);
  }
  window.dispatchEvent(new CustomEvent("uau:switch-tab", { detail: { tab } }));
}

export function TopAnnouncementBanner() {
  const appSettingsQ = useAppSettings();
  const { updateAvailable, reload } = useAppUpdateAvailable();

  const publishedAt = appSettingsQ.data?.whats_new_published_at ?? null;
  const announcementActive = !!appSettingsQ.data?.whats_new_enabled && !!appSettingsQ.data?.whats_new_title && !!publishedAt;

  const [dismissedAt, setDismissedAt] = useState<string | null>(() => {
    try {
      return localStorage.getItem(DISMISS_KEY);
    } catch {
      return null;
    }
  });

  // Republica (novo `publicado_em`) sempre reaparece, mesmo pra quem já tinha dispensado o aviso anterior.
  const announcementDismissed = announcementActive && dismissedAt === publishedAt;

  const dismissAnnouncement = () => {
    if (!publishedAt) return;
    try {
      localStorage.setItem(DISMISS_KEY, publishedAt);
    } catch {
      // localStorage indisponível (modo privado etc.) — só não persiste entre sessões
    }
    setDismissedAt(publishedAt);
  };

  if (announcementActive && !announcementDismissed) {
    const targetTab = appSettingsQ.data?.whats_new_target_tab as MainTab | null;
    const targetAction = appSettingsQ.data?.whats_new_target_action ?? null;
    const targetSelector = appSettingsQ.data?.whats_new_target_selector ?? null;
    return (
      <div className="mb-4 flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-4 py-2.5 text-sm">
        <Sparkles className="h-4 w-4 shrink-0 text-primary" />
        <button
          type="button"
          onClick={() => {
            if (targetTab) switchTab(targetTab, targetAction, targetSelector);
            dismissAnnouncement();
          }}
          className="min-w-0 flex-1 text-left"
        >
          <span className="font-semibold text-foreground">{appSettingsQ.data!.whats_new_title}</span>
          {appSettingsQ.data?.whats_new_description && (
            <span className="text-muted-foreground"> — {appSettingsQ.data.whats_new_description}</span>
          )}
        </button>
        <button
          type="button"
          onClick={dismissAnnouncement}
          className="shrink-0 rounded-lg p-1 text-muted-foreground transition hover:bg-primary/15 hover:text-foreground"
          aria-label="Dispensar aviso"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return <UpdateAvailableFallback updateAvailable={updateAvailable} reload={reload} />;
}

// Fallback genérico: nenhum aviso configurado pelo admin, mas o app detectou que uma nova
// versão foi publicada (arquivos com hash diferente) — convida a recarregar a página.
function UpdateAvailableFallback({ updateAvailable, reload }: { updateAvailable: boolean; reload: () => void }) {
  const [dismissed, setDismissed] = useState(false);

  if (!updateAvailable || dismissed) return null;

  return (
    <div className="mb-4 flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-4 py-2.5 text-sm">
      <Sparkles className="h-4 w-4 shrink-0 text-primary" />
      <button type="button" onClick={reload} className="min-w-0 flex-1 text-left">
        <span className="font-semibold text-foreground">Nova atualização disponível</span>
        <span className="text-muted-foreground"> — clique aqui pra recarregar a página e usar a versão mais recente.</span>
      </button>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="shrink-0 rounded-lg p-1 text-muted-foreground transition hover:bg-primary/15 hover:text-foreground"
        aria-label="Dispensar aviso de atualização"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
