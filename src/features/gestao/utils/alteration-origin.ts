import { inferPmPostType } from "./infer-pm-post-type";

// An alteration comes from one of three kinds of work: planning, design or video. Everything that depends on it (which stage
// the task returns to, which revision it reopens, who gets it) must read ONE answer, resolved here, instead of each place
// guessing from the title or the tags (a design card with "vídeo" in its name used to come back as a video alteration).
export type AlterationOrigin = "planejamento" | "design" | "video";

export const ALTERATION_ORIGINS: AlterationOrigin[] = ["planejamento", "design", "video"];

/** Stage where each kind of work happens (the one an alteration returns to). */
export const WORK_STAGE_BY_ORIGIN: Record<AlterationOrigin, string> = {
  planejamento: "planejamento",
  design: "design",
  video: "edicao_videos",
};

/** Key of each kind of alteration in the stage → cargo settings and in the per-client team (stage_assignees). */
export const ALTERATION_KEY_BY_ORIGIN: Record<AlterationOrigin, string> = {
  planejamento: "alteracao_pauta",
  design: "alteracao_design",
  video: "alteracao_video",
};
export const ALTERATION_KEYS = Object.values(ALTERATION_KEY_BY_ORIGIN);

export const ALTERATION_LABEL_BY_ORIGIN: Record<AlterationOrigin, string> = {
  planejamento: "Alteração do Planejamento",
  design: "Alteração do Design",
  video: "Alteração do Vídeo",
};

type TaskLike = {
  alteration_origin?: string | null;
  post_type?: string | null;
  stage_current?: string | null;
  title: string;
  tags?: string[] | null;
};

const isOrigin = (v: unknown): v is AlterationOrigin => v === "planejamento" || v === "design" || v === "video";

export type ResolvedAlterationOrigin = {
  origin: AlterationOrigin | null;
  /** Design AND video children under the same task (a planning with both kinds of post). */
  mixed: boolean;
};

/**
 * Order of trust: what was saved when the task entered "alteracoes" → a planning task → the type of its subtasks → its own
 * post type → a review without any type (that is a planning review) → and only then clues in the title and tags.
 */
export function resolveAlterationOrigin(task: TaskLike, childPostTypes: (string | null | undefined)[] = []): ResolvedAlterationOrigin {
  if (isOrigin(task.alteration_origin)) return { origin: task.alteration_origin, mixed: false };

  const types = new Set(childPostTypes.filter((t): t is string => !!t));
  const hasDesign = types.has("design");
  const hasVideo = types.has("video");
  const mixed = hasDesign && hasVideo;

  if (task.post_type === "planejamento") return { origin: "planejamento", mixed };
  if (mixed) return { origin: null, mixed: true };
  if (hasDesign) return { origin: "design", mixed: false };
  if (hasVideo) return { origin: "video", mixed: false };

  if (task.post_type === "design" || task.post_type === "video") return { origin: task.post_type, mixed: false };

  const noTypedChildren = !hasDesign && !hasVideo;
  if (task.post_type == null && task.stage_current === "revisao" && noTypedChildren) return { origin: "planejamento", mixed: false };

  const guessed = inferPmPostType({ title: task.title, post_type: task.post_type as any, stage_current: task.stage_current as any, tags: task.tags ?? [] } as any);
  return { origin: isOrigin(guessed) ? guessed : null, mixed: false };
}
