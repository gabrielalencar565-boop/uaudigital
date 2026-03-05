import { useRef } from "react";
import { format } from "date-fns";
import { Paperclip, Upload, FileText, Image, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUploadPmAttachment } from "../hooks/use-pm-data";
import type { PmAttachment } from "../pm-types";
import { toast } from "sonner";

interface Props {
  taskId: string;
  attachments: PmAttachment[];
  membersMap: Record<string, { name: string }>;
}

export function PmAttachmentsSection({ taskId, attachments, membersMap }: Props) {
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
        {attachments.map((att) => (
          <div key={att.id} className="flex items-center gap-3 rounded-md border border-border/40 bg-card/20 p-2">
            {isImage(att.file_type) ? (
              <Image className="h-5 w-5 shrink-0 text-primary" />
            ) : (
              <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{att.file_name}</p>
              <p className="text-[10px] text-muted-foreground">
                {membersMap[att.uploaded_by]?.name ?? "Usuário"} · {format(new Date(att.created_at), "dd/MM HH:mm")}
                {att.file_size ? ` · ${(att.file_size / 1024).toFixed(0)}KB` : ""}
              </p>
            </div>
            {att.public_url && (
              <a href={att.public_url} target="_blank" rel="noopener noreferrer" className="shrink-0 text-muted-foreground hover:text-foreground">
                <Download className="h-4 w-4" />
              </a>
            )}
          </div>
        ))}
        {attachments.length === 0 && <p className="text-xs text-muted-foreground">Nenhum anexo.</p>}
      </div>
    </div>
  );
}
