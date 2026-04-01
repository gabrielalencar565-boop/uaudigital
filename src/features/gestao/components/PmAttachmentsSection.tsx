import { useRef, useState, useCallback } from "react";
import { format } from "date-fns";
import { Upload, FileText, Download, MoreHorizontal, Link2, ImagePlus, GripVertical, Trash2, Loader2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { useUploadPmAttachment } from "../hooks/use-pm-data";
import type { PmAttachment } from "../pm-types";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { PmImageViewer } from "./PmImageViewer";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

const sb = supabase as any;

function initials(n: string) {
  return n.split(" ").filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase() ?? "").join("");
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

interface UploadingFile {
  name: string;
  size: number;
  progress: number;
}

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
  const queryClient = useQueryClient();
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");

  const doUpload = useCallback(async (file: File) => {
    if (file.size > 1024 * 1024 * 1024) { toast.error("Arquivo muito grande (máx 1GB)"); return; }

    const uploadEntry: UploadingFile = { name: file.name, size: file.size, progress: 0 };
    setUploadingFiles(prev => [...prev, uploadEntry]);

    // Simulate progress for UX since supabase doesn't expose upload progress
    const interval = setInterval(() => {
      setUploadingFiles(prev =>
        prev.map(f => f.name === file.name && f.progress < 90
          ? { ...f, progress: Math.min(f.progress + (file.size > 10 * 1024 * 1024 ? 2 : 15), 90) }
          : f
        )
      );
    }, 300);

    try {
      await upload.mutateAsync({ task_id: taskId, file });
      clearInterval(interval);
      setUploadingFiles(prev =>
        prev.map(f => f.name === file.name ? { ...f, progress: 100 } : f)
      );
      setTimeout(() => {
        setUploadingFiles(prev => prev.filter(f => f.name !== file.name));
      }, 800);
      toast.success("Arquivo anexado!");
    } catch (err: any) {
      clearInterval(interval);
      setUploadingFiles(prev => prev.filter(f => f.name !== file.name));
      toast.error(err?.message ?? "Erro ao enviar arquivo");
    }
  }, [taskId, upload]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (const file of Array.from(files)) {
      await doUpload(file);
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    
    // Check if it's a file drop (external) vs attachment reorder
    if (e.dataTransfer.files.length > 0 && !draggedId) {
      for (const file of Array.from(e.dataTransfer.files)) {
        await doUpload(file);
      }
    }
  }, [doUpload, draggedId]);

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); if (!draggedId) setDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setDragging(false);
  };

  // Attachment reorder via drag
  const handleAttDragStart = (e: React.DragEvent, attId: string) => {
    setDraggedId(attId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleAttDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleAttDrop = async (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!draggedId || draggedId === targetId) {
      setDraggedId(null);
      return;
    }

    const fromIdx = attachments.findIndex(a => a.id === draggedId);
    const toIdx = attachments.findIndex(a => a.id === targetId);
    if (fromIdx === -1 || toIdx === -1) { setDraggedId(null); return; }

    // Reorder
    const reordered = [...attachments];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);

    // Update order_index in DB
    const updates = reordered.map((att, i) => 
      sb.from("pm_attachments").update({ order_index: i }).eq("id", att.id)
    );
    await Promise.all(updates);
    queryClient.invalidateQueries({ queryKey: ["pm_attachments"] });
    setDraggedId(null);
    toast.success("Ordem atualizada!");
  };

  const handleAttDragEnd = () => { setDraggedId(null); };

  const handleDeleteAttachment = async (att: PmAttachment) => {
    try {
      // Delete from storage
      const { error: storageErr } = await supabase.storage.from("pm-attachments").remove([att.storage_path]);
      if (storageErr) console.warn("Storage delete error:", storageErr);
      // Delete from DB
      await sb.from("pm_attachments").delete().eq("id", att.id);
      queryClient.invalidateQueries({ queryKey: ["pm_attachments"] });
      toast.success("Anexo excluído!");
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao excluir anexo");
    }
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

  const handleRenameStart = (att: PmAttachment) => {
    setRenamingId(att.id);
    setRenameDraft(att.file_name);
  };

  const handleRenameCommit = async (attId: string) => {
    const trimmed = renameDraft.trim();
    if (!trimmed) { setRenamingId(null); return; }
    try {
      await sb.from("pm_attachments").update({ file_name: trimmed }).eq("id", attId);
      queryClient.invalidateQueries({ queryKey: ["pm_attachments"] });
      toast.success("Nome atualizado!");
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao renomear");
    }
    setRenamingId(null);
  };

  const handleDownload = async (url: string, fileName: string) => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(blobUrl);
    } catch {
      toast.error("Erro ao baixar arquivo");
    }
  };

  return (
    <div
      className="space-y-3"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">
          Anexos ({attachments.length})
          {uploadingFiles.length > 0 && (
            <span className="ml-2 text-xs text-muted-foreground">
              <Loader2 className="inline h-3 w-3 animate-spin mr-1" />
              Enviando {uploadingFiles.length} arquivo{uploadingFiles.length > 1 ? 's' : ''}...
            </span>
          )}
        </span>
        <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploadingFiles.length > 0}>
          {uploadingFiles.length > 0 ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Upload className="mr-1 h-3 w-3" />}
          Upload
        </Button>
        <input ref={fileRef} type="file" multiple className="hidden" onChange={handleUpload} />
      </div>

      {/* Upload progress indicators */}
      {uploadingFiles.length > 0 && (
        <div className="space-y-2">
          {uploadingFiles.map((f) => (
            <div key={f.name} className="rounded-lg border border-border/40 bg-card/50 p-2.5 space-y-1.5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium truncate max-w-[70%]">{f.name}</p>
                <span className="text-[10px] text-muted-foreground">{formatFileSize(f.size)}</span>
              </div>
              <Progress value={f.progress} className="h-1.5" />
              <p className="text-[10px] text-muted-foreground">
                {f.progress < 100 ? `${f.progress}% enviado...` : "Concluído!"}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Drop zone overlay */}
      {dragging && !draggedId && (
        <div className="flex items-center justify-center rounded-lg border-2 border-dashed border-primary/50 bg-primary/5 py-8 transition-all">
          <p className="text-sm text-primary font-medium">Solte os arquivos aqui</p>
        </div>
      )}

      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-1.5">
        {attachments.map((att) => {
          const isCover = currentCoverUrl === att.public_url;
          const isImg = isImage(att.file_type);
          const uploader = membersMap[att.uploaded_by];
          const isDragged = draggedId === att.id;

          return (
            <div
              key={att.id}
              draggable
              onDragStart={(e) => handleAttDragStart(e, att.id)}
              onDragOver={handleAttDragOver}
              onDrop={(e) => handleAttDrop(e, att.id)}
              onDragEnd={handleAttDragEnd}
              className={cn(
                "relative group rounded-md border bg-card/30 transition-all",
                isCover ? "border-primary/50 ring-1 ring-primary/30" : "border-border/40",
                isDragged && "opacity-40 scale-95"
              )}
            >
              {/* Drag handle */}
              <div className="absolute top-1 left-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing">
                <GripVertical className="h-3.5 w-3.5 text-muted-foreground bg-background/80 rounded" />
              </div>

              {/* Thumbnail / Icon area */}
              {isImg && att.public_url ? (
                <div
                  className="w-full aspect-[4/3] cursor-pointer overflow-hidden rounded-t-md bg-muted"
                  onClick={() => openViewer(att)}
                >
                  <img src={att.public_url} alt={att.file_name} className="w-full h-full object-cover transition group-hover:scale-105" />
                </div>
              ) : (
                <div className="w-full aspect-[4/3] flex items-center justify-center overflow-hidden rounded-t-md bg-muted/50">
                  <FileText className="h-6 w-6 text-muted-foreground/40" />
                </div>
              )}

              {/* 3-dot menu */}
              <div className="absolute top-1 right-1 z-20">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="icon" variant="secondary" className="h-5 w-5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity bg-background/80 backdrop-blur-sm">
                      <MoreHorizontal className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44" side="bottom" sideOffset={4} style={{ zIndex: 99999 }}>
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
                      <DropdownMenuItem className="text-xs gap-2" onClick={() => handleDownload(att.public_url!, att.file_name)}>
                        <Download className="h-3.5 w-3.5" /> Baixar
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem className="text-xs gap-2" onClick={() => handleRenameStart(att)}>
                      <Pencil className="h-3.5 w-3.5" /> Renomear
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-xs gap-2 text-destructive focus:text-destructive"
                      onClick={() => handleDeleteAttachment(att)}
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Info bar */}
              <div className="px-1.5 py-1 space-y-0.5">
                {renamingId === att.id ? (
                  <Input
                    autoFocus
                    value={renameDraft}
                    onChange={(e) => setRenameDraft(e.target.value)}
                    onBlur={() => handleRenameCommit(att.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleRenameCommit(att.id);
                      if (e.key === "Escape") setRenamingId(null);
                    }}
                    className="h-5 text-[9px] px-1 py-0 rounded"
                  />
                ) : (
                  <p className="truncate text-[9px] font-medium min-w-0">
                    {att.file_name}
                    {isCover && <span className="ml-0.5 text-[7px] text-primary font-bold uppercase">Capa</span>}
                  </p>
                  {att.file_size && (
                    <p className="text-[8px] text-muted-foreground">{formatFileSize(att.file_size)}</p>
                  )}
                )}
                <div className="flex items-center gap-1 text-[8px] text-muted-foreground">
                  <span>{format(new Date(att.created_at), "MMM dd 'às' h:mm a")}</span>
                  {uploader && (
                    <Avatar className="h-3.5 w-3.5 shrink-0 border border-background ml-auto">
                      <AvatarImage src={uploader.avatar} />
                      <AvatarFallback className="text-[5px] bg-primary/10 text-primary">
                        {initials(uploader.name)}
                      </AvatarFallback>
                    </Avatar>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {attachments.length === 0 && !dragging && (
        <div
          className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border/40 py-8 cursor-pointer hover:border-primary/30 transition"
          onClick={() => fileRef.current?.click()}
        >
          <Upload className="h-6 w-6 text-muted-foreground/40 mb-2" />
          <p className="text-xs text-muted-foreground">Arraste ou clique para anexar</p>
        </div>
      )}

      <PmImageViewer
        open={viewerOpen}
        onClose={() => setViewerOpen(false)}
        initialIndex={viewerIndex}
        images={imageAttachments.map(a => ({ url: a.public_url!, name: a.file_name }))}
      />
    </div>
  );
}
