import { useMemo } from "react";
import { Video, Star, Trophy } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

type ScoreRow = {
  user_id: string;
  year: number;
  month: number;
  aprendizado_continuo: number;
  padrao_qualidade_uau: number;
  metas_prazos: number;
  ambiente_organizado: number;
  comprometimento: number;
  video_destaque: number;
  squad_destaque: number;
};

type TeamMember = {
  user_id: string;
  display_name: string;
  role_title: string;
  avatar_url: string | null;
};

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("");
}

function totalPoints(s: ScoreRow) {
  return (
    s.aprendizado_continuo +
    s.padrao_qualidade_uau +
    s.metas_prazos +
    s.ambiente_organizado +
    s.comprometimento +
    (s.video_destaque ?? 0) +
    (s.squad_destaque ?? 0)
  );
}

function medalForRank(rank: number) {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return null;
}

export function AnnualShowcasePanel({
  scores,
  team,
  teamById,
}: {
  scores: ScoreRow[];
  team: TeamMember[];
  teamById: Map<string, TeamMember>;
}) {
  const showcase = useMemo(() => {
    // Compute totals + bonus counts per user
    const map = new Map<string, { total: number; videoCount: number; squadCount: number }>();

    for (const s of scores) {
      const prev = map.get(s.user_id) ?? { total: 0, videoCount: 0, squadCount: 0 };
      prev.total += totalPoints(s);
      if ((s.video_destaque ?? 0) > 0) prev.videoCount += 1;
      if ((s.squad_destaque ?? 0) > 0) prev.squadCount += 1;
      map.set(s.user_id, prev);
    }

    return team
      .map((m) => {
        const v = map.get(m.user_id) ?? { total: 0, videoCount: 0, squadCount: 0 };
        return { user_id: m.user_id, ...v };
      })
      .sort((a, b) => b.total - a.total);
  }, [scores, team]);

  if (showcase.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {showcase.map((item, idx) => {
        const member = teamById.get(item.user_id);
        const rank = idx + 1;
        const medal = medalForRank(rank);
        const isTop3 = rank <= 3;

        return (
          <div
            key={item.user_id}
            className={`relative flex flex-col items-center gap-2 rounded-xl border p-4 text-center transition-all ${
              isTop3
                ? "border-primary/30 bg-primary/5 shadow-sm"
                : "border-border/50 bg-card/30"
            }`}
          >
            {/* Rank badge */}
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              {medal ? (
                <span className="text-2xl leading-none drop-shadow-sm">{medal}</span>
              ) : (
                <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-muted px-1.5 text-xs font-bold tabular-nums text-muted-foreground">
                  {rank}º
                </span>
              )}
            </div>

            {/* Avatar */}
            <Avatar className={`${isTop3 ? "h-16 w-16" : "h-14 w-14"} mt-2 shadow-sm`}>
              <AvatarImage src={member?.avatar_url ?? undefined} />
              <AvatarFallback className="text-sm font-semibold">
                {initials(member?.display_name ?? "?")}
              </AvatarFallback>
            </Avatar>

            {/* Name */}
            <p className="text-sm font-semibold leading-tight truncate w-full">
              {member?.display_name?.split(" ")[0] ?? "—"}
            </p>

            {/* Total points */}
            <div className="flex items-baseline gap-1">
              <span className={`${isTop3 ? "text-2xl" : "text-xl"} font-bold tabular-nums text-primary`}>
                {item.total}
              </span>
              <span className="text-[10px] text-muted-foreground">pts</span>
            </div>

            {/* Badges row */}
            <div className="flex items-center gap-1.5 flex-wrap justify-center">
              {/* Position badge */}
              {medal ? (
                <span className="text-lg leading-none">{medal}</span>
              ) : (
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1 text-[10px] font-bold tabular-nums text-muted-foreground">
                  {rank}º
                </span>
              )}
              {item.videoCount > 0 && (
                <span
                  className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold text-white shadow-sm"
                  style={{ background: "linear-gradient(145deg, #f5d020, #f5ab20, #c89b3c)" }}
                  title={`Vídeo Destaque × ${item.videoCount}`}
                >
                  <Video className="h-2.5 w-2.5" />
                  {item.videoCount > 1 && <span>×{item.videoCount}</span>}
                </span>
              )}
              {item.squadCount > 0 && (
                <span
                  className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold text-white shadow-sm"
                  style={{ background: "linear-gradient(145deg, #f5d020, #f5ab20, #c89b3c)" }}
                  title={`Squad Destaque × ${item.squadCount}`}
                >
                  <Star className="h-2.5 w-2.5 fill-white" />
                  {item.squadCount > 1 && <span>×{item.squadCount}</span>}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
