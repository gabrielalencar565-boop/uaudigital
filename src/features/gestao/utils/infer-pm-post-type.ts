import { parseTag } from "../pm-constants";

export type PmPostType = "video" | "design";

type TaskLike = {
  post_type?: string | null;
  stage_current?: string | null;
  tags?: string[] | null;
  title?: string | null;
};

const normalize = (value?: string | null) =>
  (value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export function inferPmPostType(task: TaskLike, fallback: PmPostType | null = null): PmPostType | null {
  const normalizedTitle = normalize(task.title);
  const hasWorkflowDesignTitle = /(^|\s-\s|\[)design(\]|\s-\s|$)/.test(normalizedTitle);
  const hasWorkflowVideoTitle = /(^|\s-\s|\[)video(\]|\s-\s|$)/.test(normalizedTitle);

  // Workflow titles are the safest signal for legacy/corrupted tasks where
  // stage_current/post_type were saved with the wrong origin (e.g. Design as video).
  if (hasWorkflowDesignTitle) return "design";
  if (hasWorkflowVideoTitle) return "video";

  if (task.post_type === "video" || task.stage_current === "edicao_videos") return "video";
  if (task.post_type === "design" || task.stage_current === "design") return "design";

  const normalizedTags = (task.tags ?? []).map((tag) => normalize(parseTag(tag).name));
  if (normalizedTags.some((tag) => tag === "video")) return "video";
  if (normalizedTags.some((tag) => tag === "design")) return "design";

  if (normalizedTitle.includes("video")) return "video";
  if (normalizedTitle.includes("design")) return "design";

  return fallback;
}