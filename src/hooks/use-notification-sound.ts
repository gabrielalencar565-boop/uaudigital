import { useCallback, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import {
  triggerNotification,
  type NotificationType,
} from "@/lib/notifications";

// ─── Internal types ───────────────────────────────────────────────────
type PendingNotif = {
  key: string;
  type: NotificationType;
  title: string;
  description?: string;
  timestamp?: string;
};

const MAX_PENDING = 30;

// ─── Hook ─────────────────────────────────────────────────────────────
/**
 * Realtime notification system:
 * - Mentions in pm_comments
 * - Task assignments (new or reassigned) in pm_tasks
 * - Overdue & due-soon tasks (periodic check)
 * - Visibility-aware: queues when tab hidden, flushes on return
 */
export function useNotificationSound() {
  const { user } = useSession();
  const userIdRef = useRef<string | null>(null);
  const pendingRef = useRef<PendingNotif[]>([]);
  const shownKeysRef = useRef<Set<string>>(new Set());
  const deadlineIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── helpers ──
  const isTabActive = useCallback(() => {
    if (typeof document === "undefined") return true;
    return document.visibilityState === "visible" && document.hasFocus();
  }, []);

  const showNotif = useCallback((item: PendingNotif) => {
    if (shownKeysRef.current.has(item.key)) return;
    shownKeysRef.current.add(item.key);
    triggerNotification(item.type, item.title, {
      description: item.description,
    });
  }, []);

  const enqueueOrShow = useCallback(
    (item: PendingNotif) => {
      if (shownKeysRef.current.has(item.key)) return;
      if (isTabActive()) {
        showNotif(item);
        return;
      }
      if (!pendingRef.current.some((p) => p.key === item.key)) {
        pendingRef.current.push(item);
        if (pendingRef.current.length > MAX_PENDING)
          pendingRef.current = pendingRef.current.slice(-MAX_PENDING);
      }
    },
    [isTabActive, showNotif]
  );

  const flushPending = useCallback(() => {
    if (!isTabActive() || pendingRef.current.length === 0) return;
    const queue = [...pendingRef.current].sort(
      (a, b) =>
        new Date(a.timestamp ?? 0).getTime() -
        new Date(b.timestamp ?? 0).getTime()
    );
    pendingRef.current = [];
    queue.forEach(showNotif);
  }, [isTabActive, showNotif]);

  const setLastSeen = useCallback(() => {
    if (!user?.id) return;
    localStorage.setItem(
      `uau:notif:last-seen:${user.id}`,
      new Date().toISOString()
    );
  }, [user?.id]);

  // ── Fetch missed while away ──
  const fetchMissedWhileAway = useCallback(async () => {
    if (!user?.id) return;
    const since = localStorage.getItem(`uau:notif:last-seen:${user.id}`);
    if (!since) return;

    const [mentionsRes, assignedRes] = await Promise.all([
      (supabase as any)
        .from("pm_comments")
        .select("id, content, created_at, author_id")
        .neq("author_id", user.id)
        .ilike("content", `%@${user.id}%`)
        .gte("created_at", since)
        .order("created_at", { ascending: true })
        .limit(20),
      (supabase as any)
        .from("pm_tasks")
        .select("id, title, created_by, assignee_id, updated_at")
        .eq("assignee_id", user.id)
        .neq("created_by", user.id)
        .gte("updated_at", since)
        .order("updated_at", { ascending: true })
        .limit(20),
    ]);

    const items: PendingNotif[] = [
      ...(mentionsRes.data ?? []).map((r: any) => ({
        key: `mention-${r.id}`,
        type: "mention" as NotificationType,
        title: "Você foi mencionado",
        description:
          r.content
            ?.substring(0, 80)
            ?.replace(/@([a-f0-9-]{36})/gi, "@alguém") ?? "",
        timestamp: r.created_at,
      })),
      ...(assignedRes.data ?? []).map((r: any) => ({
        key: `assigned-${r.id}-${r.updated_at ?? ""}`,
        type: "task_assigned" as NotificationType,
        title: "Tarefa atribuída a você",
        description: r.title ?? "Uma tarefa foi atribuída",
        timestamp: r.updated_at,
      })),
    ];

    items
      .sort(
        (a, b) =>
          new Date(a.timestamp ?? 0).getTime() -
          new Date(b.timestamp ?? 0).getTime()
      )
      .forEach(enqueueOrShow);
  }, [enqueueOrShow, user?.id]);

  // ── Periodic deadline check ──
  const checkDeadlines = useCallback(async () => {
    if (!user?.id) return;
    const todayStr = new Date().toISOString().slice(0, 10);

    const { data } = await (supabase as any)
      .from("pm_tasks")
      .select("id, title, due_date, assignee_id, status_global")
      .eq("assignee_id", user.id)
      .not("status_global", "in", "(concluido,cancelado)")
      .not("due_date", "is", null)
      .lte("due_date", todayStr)
      .order("due_date", { ascending: true })
      .limit(10);

    if (!data) return;

    const now = new Date();
    for (const t of data as any[]) {
      const dueDate = new Date(t.due_date + "T23:59:59");
      const diffMs = dueDate.getTime() - now.getTime();
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      if (diffDays < 0) {
        enqueueOrShow({
          key: `overdue-${t.id}-${todayStr}`,
          type: "task_overdue",
          title: `Tarefa atrasada: ${t.title ?? "Sem título"}`,
          description: `Venceu há ${Math.abs(diffDays)} dia${Math.abs(diffDays) === 1 ? "" : "s"}`,
          timestamp: t.due_date,
        });
      } else if (diffDays <= 1) {
        enqueueOrShow({
          key: `duesoon-${t.id}-${todayStr}`,
          type: "task_due_soon",
          title: `Tarefa vence ${diffDays === 0 ? "hoje" : "amanhã"}: ${t.title ?? "Sem título"}`,
          description: diffDays === 0 ? "Vence hoje!" : "Vence amanhã",
          timestamp: t.due_date,
        });
      }
    }
  }, [enqueueOrShow, user?.id]);

  // ── Set userId ref ──
  useEffect(() => {
    userIdRef.current = user?.id ?? null;
  }, [user?.id]);

  // ── Visibility & lifecycle ──
  useEffect(() => {
    if (!user?.id) return;

    const key = `uau:notif:last-seen:${user.id}`;
    if (!localStorage.getItem(key)) {
      localStorage.setItem(key, new Date().toISOString());
    }

    const handleVisible = () => {
      if (!isTabActive()) return;
      void fetchMissedWhileAway().finally(() => {
        void checkDeadlines().finally(() => {
          flushPending();
          setLastSeen();
        });
      });
    };

    const handleHidden = () => {
      if (document.visibilityState === "hidden") setLastSeen();
    };

    window.addEventListener("focus", handleVisible);
    document.addEventListener("visibilitychange", handleVisible);
    document.addEventListener("visibilitychange", handleHidden);
    window.addEventListener("beforeunload", setLastSeen);

    // Initial deadline check
    void checkDeadlines();

    // Periodic deadline check every 5 minutes
    deadlineIntervalRef.current = setInterval(() => {
      if (isTabActive()) void checkDeadlines();
    }, 5 * 60 * 1000);

    return () => {
      window.removeEventListener("focus", handleVisible);
      document.removeEventListener("visibilitychange", handleVisible);
      document.removeEventListener("visibilitychange", handleHidden);
      window.removeEventListener("beforeunload", setLastSeen);
      if (deadlineIntervalRef.current) clearInterval(deadlineIntervalRef.current);
    };
  }, [checkDeadlines, fetchMissedWhileAway, flushPending, isTabActive, setLastSeen, user?.id]);

  // ── Realtime subscriptions ──
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`notification-system-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "pm_comments" },
        (payload) => {
          const uid = userIdRef.current;
          if (!uid) return;
          const row = payload.new as any;
          if (row.author_id === uid) return;
          if (row.content && row.content.includes(`@${uid}`)) {
            enqueueOrShow({
              key: `mention-${row.id}`,
              type: "mention",
              title: "Você foi mencionado",
              description:
                row.content
                  ?.substring(0, 80)
                  ?.replace(/@([a-f0-9-]{36})/gi, "@alguém") ?? "",
              timestamp: row.created_at,
            });
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "pm_tasks" },
        (payload) => {
          const uid = userIdRef.current;
          if (!uid) return;
          const row = payload.new as any;
          if (row.created_by === uid) return;
          if (row.assignee_id === uid) {
            enqueueOrShow({
              key: `assigned-${row.id}-${row.created_at ?? ""}`,
              type: "task_assigned",
              title: "Nova tarefa atribuída a você",
              description: row.title ?? "Uma nova tarefa foi atribuída",
              timestamp: row.created_at,
            });
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "pm_tasks" },
        (payload) => {
          const uid = userIdRef.current;
          if (!uid) return;
          const row = payload.new as any;
          const old = payload.old as any;
          if (row.assignee_id === uid && old.assignee_id !== uid) {
            enqueueOrShow({
              key: `assigned-${row.id}-${row.updated_at ?? ""}`,
              type: "task_assigned",
              title: "Tarefa atribuída a você",
              description: row.title ?? "Uma tarefa foi atribuída",
              timestamp: row.updated_at,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enqueueOrShow, user?.id]);
}
