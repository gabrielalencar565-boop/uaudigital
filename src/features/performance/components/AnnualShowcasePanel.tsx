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
    const map = new Map<string, { total: number; videoCount: number; squadCount: number }>();

    for (const s of scores) {
      const prev = map.get(s.user_id) ?? { total: 0, videoCount: 0, squadCount: 0 };
      prev.total += totalPoints(s);
      if ((s.video_destaque ?? 0) > 0) prev.videoCount += 1;
      if ((s.squad_destaque ?? 0) > 0) prev.squadCount += 1;
      map.set(s.user_id, prev);
    }

    // Compute monthly rankings to count positions per user
    const months = new Set(scores.map((s) => s.month));
    // positions: Map<user_id, number[]> — array of positions achieved
    const positionsList = new Map<string, number[]>();

    for (const m of months) {
      const monthScores = scores.filter((s) => s.month === m);
      const ranked = team
        .map((t) => {
          const s = monthScores.find((sc) => sc.user_id === t.user_id);
          return { user_id: t.user_id, pts: s ? totalPoints(s) : 0 };
        })
        .sort((a, b) => b.pts - a.pts);

      ranked.forEach((r, idx) => {
        if (r.pts === 0) return;
        const prev = positionsList.get(r.user_id) ?? [];
        prev.push(idx + 1);
        positionsList.set(r.user_id, prev);
      });
    }

    return team
      .map((m) => {
        const v = map.get(m.user_id) ?? { total: 0, videoCount: 0, squadCount: 0 };
        const positions = positionsList.get(m.user_id) ?? [];
        return { user_id: m.user_id, ...v, positions };
      })
      .sort((a, b) => b.total - a.total);
  }, [scores, team]);

  if (showcase.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-2xl font-semibold tracking-tight">Painel Anual</h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 pt-5">
      {showcase.map((item, idx) => {
        const member = teamById.get(item.user_id);
        const rank = idx + 1;
        const medal = medalForRank(rank);
        const isTop3 = rank <= 3;

        return (
          <div
            key={item.user_id}
             className={`relative flex flex-col items-center gap-1.5 rounded-xl border p-4 pt-8 text-center transition-all ${
              isTop3
                ? "border-border/40 bg-card shadow-sm"
                : "border-border/50 bg-card/30"
            }`}
          >
            {/* Rank badge — above card */}
            <div className="absolute -top-4 left-1/2 -translate-x-1/2">
              {medal ? (
                <span className="text-3xl leading-none drop-shadow-sm">{medal}</span>
              ) : (
                <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-muted px-1.5 text-xs font-bold tabular-nums text-muted-foreground">
                  {rank}º
                </span>
              )}
            </div>

            {/* Avatar */}
            <Avatar className={`${isTop3 ? "h-16 w-16" : "h-14 w-14"} shadow-sm`}>
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
              <span className={`${isTop3 ? "text-2xl" : "text-xl"} font-bold tabular-nums`}>
                {item.total}
              </span>
              <span className="text-[10px] text-muted-foreground">pts</span>
            </div>

            {/* Badges row */}
            <div className="flex items-center gap-0.5 flex-wrap justify-center">
              {item.positions
                .sort((a, b) => a - b)
                .map((pos, i) => {
                  const emoji = pos === 1 ? "🥇" : pos === 2 ? "🥈" : pos === 3 ? "🥉" : null;
                  if (emoji) return <span key={`p${i}`} className="text-base leading-none">{emoji}</span>;
                  return (
                    <span key={`p${i}`} className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1 text-[10px] font-bold tabular-nums text-muted-foreground">
                      {pos}º
                    </span>
                  );
                })}
              {Array.from({ length: item.videoCount }, (_, i) => (
                <span
                  key={`v${i}`}
                  className="inline-flex h-[22px] w-[22px] items-center justify-center rounded-full shadow-sm"
                  style={{ background: "linear-gradient(145deg, #f5d020, #f5ab20, #c89b3c)" }}
                  title="Vídeo Destaque"
                >
                  <Video className="h-2.5 w-2.5 text-white" />
                </span>
              ))}
              {Array.from({ length: item.squadCount }, (_, i) => (
                <span
                  key={`sq${i}`}
                  className="inline-flex h-[22px] w-[22px] items-center justify-center rounded-full shadow-sm"
                  style={{ background: "linear-gradient(145deg, #f5d020, #f5ab20, #c89b3c)" }}
                  title="Squad Destaque"
                >
                  <Star className="h-2.5 w-2.5 text-white fill-white" />
                </span>
              ))}
            </div>
          </div>
        );
      })}
      </div>
    </div>
  );
}
