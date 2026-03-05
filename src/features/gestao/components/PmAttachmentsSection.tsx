import { useRef } from "react";
import { format } from "date-fns";
import { Upload, FileText, Image, Download, ImagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useUploadPmAttachment } from "../hooks/use-pm-data";
import type { PmAttachment } from "../pm-types";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  taskId: string;
  attachments: PmAttachment[];
  membersMap: Record<string, { name: string }>;
  onSetCover?: (url: string) => void;
  currentCoverUrl?: string | null;
}

export function PmAttachmentsSection({ taskId, attachments, membersMap, onSetCover, currentCoverUrl }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const upload = useUploadPmAttachment();

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) { toast.error("Arquivo muito grande (máx 20MB)"); return; }
    try {
      await upload.mutateAsync({ task_id: taskId, file });
      toast.success("Arquivo anexado!");
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao enviar arquivo");
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  const isImage = (type: string | null) => type?.startsWith("image/");

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Anexos ({attachments.length})</span>
        <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={upload.isPending}>
          <Upload className="mr-1 h-3 w-3" /> Upload
        </Button>
        <input ref={fileRef} type="file" className="hidden" onChange={handleUpload} />
      </div>

      <div className="space-y-2">
        {attachments.map((att) => {
          const isCover = currentCoverUrl === att.public_url;
          return (
            <div key={att.id} className={cn(
              "flex items-center gap-3 rounded-md border bg-card/20 p-2",
              isCover ? "border-primary/50 bg-primary/5" : "border-border/40"
            )}>
              {isImage(att.file_type) ? (
                <Image className="h-5 w-5 shrink-0 text-primary" />
              ) : (
                <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {att.file_name}
                  {isCover && <span className="ml-1.5 text-[9px] text-primary font-bold uppercase">Capa</span>}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {membersMap[att.uploaded_by]?.name ?? "Usuário"} · {format(new Date(att.created_at), "dd/MM HH:mm")}
                  {att.file_size ? ` · ${(att.file_size / 1024).toFixed(0)}KB` : ""}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {/* Set as cover (only for images with public_url) */}
                {isImage(att.file_type) && att.public_url && onSetCover && !isCover && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    onClick={() => onSetCover(att.public_url!)}
                    title="Definir como capa"
                  >
                    <ImagePlus className="h-3.5 w-3.5" />
                  </Button>
                )}
                {att.public_url && (
                  <a href={att.public_url} target="_blank" rel="noopener noreferrer" className="shrink-0 text-muted-foreground hover:text-foreground">
                    <Download className="h-4 w-4" />
                  </a>
                )}
              </div>
            </div>
          );
        })}
        {attachments.length === 0 && <p className="text-xs text-muted-foreground">Nenhum anexo.</p>}
      </div>
    </div>
  );
}
