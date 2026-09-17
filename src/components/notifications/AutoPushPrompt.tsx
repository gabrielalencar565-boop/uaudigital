import { useEffect, useRef } from "react";
import { useSession } from "@/hooks/use-session";
import { isPushSupported, subscribeToPush } from "@/lib/push-notifications";

// Fires the browser's native "allow notifications?" prompt automatically the first time
// a logged-in user opens the app on a device — same mechanism as the manual toggle in
// PushNotificationsDialog, just triggered without waiting for them to find that menu.
// Only runs once per browser/device: `Notification.permission` starts at "default" and
// the browser itself remembers "granted"/"denied" forever after the first answer, so this
// naturally never re-prompts once the user has responded (allow or deny) — nothing to
// track ourselves.
export function AutoPushPrompt() {
  const { user } = useSession();
  const attempted = useRef(false);

  useEffect(() => {
    if (!user?.id || attempted.current) return;
    if (!isPushSupported()) return;
    if (Notification.permission !== "default") return;

    attempted.current = true;
    (async () => {
      try {
        await navigator.serviceWorker.ready;
        await subscribeToPush(user.id);
      } catch {
        // Denied, dismissed, or unsupported — nothing to do; the manual toggle in the
        // profile menu still works if permission ends up granted later.
      }
    })();
  }, [user?.id]);

  return null;
}
