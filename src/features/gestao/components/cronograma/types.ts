import { Film, Image, LayoutGrid, Camera } from "lucide-react";
import type { PmTask } from "../../pm-types";

export const POST_TYPE_META: Record<string, { label: string; icon: typeof Film; color: string }> = {
  reels: { label: "Reels", icon: Film, color: "bg-pink-500/20 text-pink-500" },
  carrossel: { label: "Carrossel", icon: LayoutGrid, color: "bg-blue-500/20 text-blue-500" },
  post: { label: "Post", icon: Image, color: "bg-emerald-500/20 text-emerald-500" },
  foto: { label: "Foto", icon: Camera, color: "bg-amber-500/20 text-amber-500" },
};

export interface CronogramaPost extends PmTask {
  /** First image attachment URL */
  attachment_url?: string | null;
  /** All image attachment URLs (for carousels) */
  all_attachment_urls?: string[];
}

export interface CronogramaViewProps {
  posts: CronogramaPost[];
  selectedPost: CronogramaPost | null;
  onSelectPost: (post: CronogramaPost | null) => void;
  onDateChange?: (postId: string, newDate: string) => void;
}
