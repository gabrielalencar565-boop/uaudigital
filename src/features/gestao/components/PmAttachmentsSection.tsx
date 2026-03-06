import { useRef, useState } from "react";
import { format } from "date-fns";
import { Upload, FileText, Download, MoreHorizontal, Pencil, Link2, Trash2, ImagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useUploadPmAttachment } from "../hooks/use-pm-data";
import type { PmAttachment } from "../pm-types";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { PmImageViewer } from "./PmImageViewer";

interface Props {
  taskId: string;
  attachments: PmAttachment[];
  membersMap: Record<string, { name: string; avatar?: string }>;
  onSetCover?: (url: string) => void;
  currentCoverUrl?: string | null;
}

export function PmAttachmentsSection({ taskId, attachments, membersMap, onSetCover, currentCoverUrl }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const upload = useUploadPmAttachment();
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);

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
  const imageAttachments = attachments.filter(a => isImage(a.file_type) && a.public_url);

  const openViewer = (att: PmAttachment) => {
    const idx = imageAttachments.findIndex(a => a.id === att.id);
    setViewerIndex(idx >= 0 ? idx : 0);
    setViewerOpen(true);
  };

  const copyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success("URL copiada!");
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Anexos ({attachments.length})</span>
        <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={upload.isPending}>
          <Upload className="mr-1 h-3 w-3" /> Upload
        </Button>
        <input ref={fileRef} type="file" className="hidden" onChange={handleUpload} />
      </div>

      <div className="grid grid-cols-2 gap-2">
        {attachments.map((att) => {
          const isCover = currentCoverUrl === att.public_url;
          const isImg = isImage(att.file_type);

          return (
            <div key={att.id} className={cn(
              "relative group rounded-lg border overflow-hidden bg-card/30",
              isCover ? "border-primary/50 ring-1 ring-primary/30" : "border-border/40"
            )}>
              {/* Thumbnail / Icon area */}
              {isImg && att.public_url ? (
                <div
                  className="w-full h-32 cursor-pointer overflow-hidden bg-muted"
                  onClick={() => openViewer(att)}
                >
                  <img src={att.public_url} alt={att.file_name} className="w-full h-full object-cover transition group-hover:scale-105" />
                </div>
              ) : (
                <div className="w-full h-32 flex items-center justify-center bg-muted/50">
                  <FileText className="h-10 w-10 text-muted-foreground/40" />
                </div>
              )}

              {/* 3-dot menu */}
              <div className="absolute top-1.5 right-1.5">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="icon" variant="secondary" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 backdrop-blur-sm">
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    {isImg && att.public_url && onSetCover && !isCover && (
                      <DropdownMenuItem className="text-xs gap-2" onClick={() => onSetCover(att.public_url!)}>
                        <ImagePlus className="h-3.5 w-3.5" /> Definir como capa
                      </DropdownMenuItem>
                    )}
                    {att.public_url && (
                      <DropdownMenuItem className="text-xs gap-2" onClick={() => copyUrl(att.public_url!)}>
                        <Link2 className="h-3.5 w-3.5" /> Copiar URL
                      </DropdownMenuItem>
                    )}
                    {att.public_url && (
                      <DropdownMenuItem className="text-xs gap-2" asChild>
                        <a href={att.public_url} download={att.file_name} target="_blank" rel="noopener noreferrer">
                          <Download className="h-3.5 w-3.5" /> Baixar
                        </a>
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Info bar */}
              <div className="px-2.5 py-2 flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium">
                    {att.file_name}
                    {isCover && <span className="ml-1 text-[8px] text-primary font-bold uppercase">Capa</span>}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {format(new Date(att.created_at), "MMM dd 'às' HH:mm")}
                  </p>
                </div>
                {membersMap[att.uploaded_by] && (
                  <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center text-[7px] font-bold text-primary shrink-0">
                    {membersMap[att.uploaded_by].name.split(" ").slice(0, 2).map(p => p[0]?.toUpperCase()).join("")}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {attachments.length === 0 && <p className="text-xs text-muted-foreground">Nenhum anexo.</p>}

      {/* Fullscreen image viewer */}
      <PmImageViewer
        open={viewerOpen}
        onClose={() => setViewerOpen(false)}
        initialIndex={viewerIndex}
        images={imageAttachments.map(a => ({ url: a.public_url!, name: a.file_name }))}
      />
    </div>
  );
}
