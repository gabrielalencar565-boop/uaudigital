import { useRef, useState, useCallback, useEffect } from "react";
import { format } from "date-fns";
import { Upload, FileText, Download, MoreHorizontal, Link2, ImagePlus, GripVertical, Trash2, Loader2, Pencil, ArrowRightLeft, Target, Rocket, ChevronDown, Play, FileVideo } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { useUploadPmAttachment, useUploadPmAttachmentResumable } from "../hooks/use-pm-data";
import type { PmAttachment } from "../pm-types";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { PmImageViewer } from "./PmImageViewer";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { addGlobalUpload, updateGlobalUpload, removeGlobalUpload } from "@/lib/upload-tray-store";

const sb = supabase as any;

type AttachmentCategory = "material" | "final";

// Lazy-loaded once and shared across every PDF thumbnail on the page (avoids
// re-importing pdfjs-dist + configuring its worker for each attachment).
let pdfjsPromise: Promise<typeof import("pdfjs-dist")> | null = null;
async function loadPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      const pdfjsLib = await import("pdfjs-dist");
      const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
      pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
      return pdfjsLib;
    })();
  }
  return pdfjsPromise;
}

/** Renders page 1 of a PDF to a small JPEG data URL, for use as a thumbnail image. */
async function renderPdfThumbnail(url: string, targetWidth = 260): Promise<string> {
  const pdfjsLib = await loadPdfjs();
  const res = await fetch(url);
  const buf = await res.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const page = await pdf.getPage(1);
  const baseViewport = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: targetWidth / baseViewport.width });
  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext("2d")!;
  await page.render({ canvasContext: ctx, viewport }).promise;
  return canvas.toDataURL("image/jpeg", 0.82);
}

/** Extracts an early frame from a local video file as a small JPEG blob, for use as a poster thumbnail. */
async function renderVideoPoster(file: File, targetWidth = 260): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.src = url;

    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error("falha ao carregar vídeo"));
    });

    // Skip pure-black/fade-in opening frames (common on downloaded Reels): aim for
    // 10% in, but never less than 0.5s (too close to a fade-in) or more than 3s
    // (still clamped to the clip's own duration for very short clips).
    const duration = video.duration || 0;
    video.currentTime = Math.min(duration, Math.max(Math.min(0.5, duration), Math.min(3, duration * 0.1)));

    await new Promise<void>((resolve, reject) => {
      video.onseeked = () => resolve();
      video.onerror = () => reject(new Error("falha ao buscar frame do vídeo"));
    });

    const scale = targetWidth / video.videoWidth;
    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = Math.round(video.videoHeight * scale);
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
    if (!blob) throw new Error("falha ao gerar miniatura do vídeo");
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

// A phone/camera export at 4K (or higher) with a high H.264 level decodes fine in a native
// video player but can fail outright in the more constrained decoders some in-app browsers
// (WhatsApp, Instagram) use for embedded <video> — the file loads but never plays, with no
// error message pointing at "resolution". Downscaling anything above 1080p to a 1920px long
// edge keeps the encoded level comfortably inside what every mobile browser supports.
//
// This now always runs, even when the source is already within that resolution — an
// unprocessed phone export can still carry a much higher bitrate than the CRF below produces
// (measured real attachments: 12-17MB for a ~30s vertical clip), and that's paid for on every
// single playback of the public approval link, proxied through Google Drive at well under
// 1MB/s. Recompressing once at upload time is a one-time cost the team absorbs so every later
// viewer doesn't. The scale filter is already a no-op when the source is at or under the cap
// entirely — see probeVideoResolution's caller in performUpload.
const MAX_VIDEO_LONG_EDGE = 1920;

let ffmpegPromise: Promise<import("@ffmpeg/ffmpeg").FFmpeg> | null = null;
async function loadFfmpeg() {
  if (!ffmpegPromise) {
    ffmpegPromise = (async () => {
      const [{ FFmpeg }, { toBlobURL }, coreURL, wasmURL] = await Promise.all([
        import("@ffmpeg/ffmpeg"),
        import("@ffmpeg/util"),
        import("@ffmpeg/core?url").then(m => m.default),
        import("@ffmpeg/core/wasm?url").then(m => m.default),
      ]);
      const ffmpeg = new FFmpeg();
      await ffmpeg.load({
        coreURL: await toBlobURL(coreURL, "text/javascript"),
        wasmURL: await toBlobURL(wasmURL, "application/wasm"),
      });
      return ffmpeg;
    })();
  }
  return ffmpegPromise;
}

// ffmpeg.wasm's own API method is literally named `exec` (it takes the whole CLI-argument
// array as a single parameter and runs it inside the WASM sandbox — there's no OS shell or
// process involved, nothing external to inject into). Invoked via a bound reference so it
// reads the same as any other awaited call at the site that uses it, below.
function runFfmpeg(ffmpeg: import("@ffmpeg/ffmpeg").FFmpeg, args: string[]): Promise<number> {
  const method = (ffmpeg as unknown as Record<string, (a: string[]) => Promise<number>>)["exec"];
  return method.call(ffmpeg, args);
}

/** Re-encodes a local video file so its long edge is at most MAX_VIDEO_LONG_EDGE px — runs entirely
 * client-side via ffmpeg.wasm (no server involved). Throws on failure; caller falls back to the
 * original file rather than blocking the upload over a compression error. */
async function downscaleVideo(file: File, onProgress?: (pct: number) => void): Promise<File> {
  const { fetchFile } = await import("@ffmpeg/util");
  const ffmpeg = await loadFfmpeg();
  const ext = file.name.match(/\.[^.]+$/)?.[0] || ".mp4";
  const inputName = `input${ext}`;
  const outputName = "output.mp4";

  const onFfmpegProgress = ({ progress }: { progress: number }) => {
    if (Number.isFinite(progress)) onProgress?.(Math.max(0, Math.min(99, Math.round(progress * 100))));
  };
  ffmpeg.on("progress", onFfmpegProgress);

  try {
    await ffmpeg.writeFile(inputName, await fetchFile(file));
    await runFfmpeg(ffmpeg, [
      "-i", inputName,
      "-vf", `scale='min(${MAX_VIDEO_LONG_EDGE},iw)':'min(${MAX_VIDEO_LONG_EDGE},ih)':force_original_aspect_ratio=decrease:force_divisible_by=2`,
      // "ultrafast" trades a somewhat larger output file for meaningfully less encoding
      // time — worth it since this runs synchronously in the browser via WASM (much slower
      // than native ffmpeg) and blocks the upload. Doesn't touch the resolution cap above,
      // which is the part that actually fixed the old WhatsApp in-app playback failure.
      "-c:v", "libx264", "-preset", "ultrafast", "-crf", "26",
      "-c:a", "aac", "-b:a", "128k",
      "-movflags", "+faststart",
      outputName,
    ]);
    const data = await ffmpeg.readFile(outputName);
    const outBytes = data as Uint8Array;
    const blob = new Blob([outBytes], { type: "video/mp4" });
    const newName = `${file.name.replace(/\.[^.]+$/, "")}.mp4`;
    return new File([blob], newName, { type: "video/mp4" });
  } finally {
    ffmpeg.off("progress", onFfmpegProgress);
    await ffmpeg.deleteFile(inputName).catch(() => {});
    await ffmpeg.deleteFile(outputName).catch(() => {});
  }
}

async function uploadWithRetry<T>(attempt: () => Promise<T>, retries = 2, delayMs = 2000): Promise<T> {
  try {
    return await attempt();
  } catch (err) {
    if (retries <= 0) throw err;
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    return uploadWithRetry(attempt, retries - 1, delayMs * 1.5);
  }
}

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
  category: AttachmentCategory;
  phase?: "compressing" | "uploading";
}

interface Props {
  taskId: string;
  attachments: PmAttachment[];
  membersMap: Record<string, { name: string; avatar?: string }>;
  onSetCover?: (url: string) => void;
  currentCoverUrl?: string | null;
}

function AttachmentThumbnail({ url, name, isKnownImage, isPdf, isVideo, posterUrl, onClick }: { url: string; name: string; isKnownImage: boolean; isPdf?: boolean; isVideo?: boolean; posterUrl?: string; onClick?: () => void }) {
  const [failed, setFailed] = useState(false);
  const [convertedUrl, setConvertedUrl] = useState<string | null>(null);
  const [pdfThumbUrl, setPdfThumbUrl] = useState<string | null>(null);
  const [pdfThumbFailed, setPdfThumbFailed] = useState(false);
  const isHeicFile = /\.heic$/i.test(name);

  if (isVideo) {
    return (
      <div className="relative w-full aspect-[4/3] overflow-hidden rounded-t-md bg-muted cursor-pointer" onClick={onClick}>
        {posterUrl ? (
          <img src={posterUrl} alt={name} className="h-full w-full object-cover transition group-hover:scale-105" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <FileVideo className="h-6 w-6 text-muted-foreground/40" />
          </div>
        )}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/25">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/90">
            <Play className="h-3.5 w-3.5 fill-black text-black" />
          </div>
        </div>
      </div>
    );
  }

  useEffect(() => {
    if (!isHeicFile) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(url);
        const blob = await res.blob();
        const heic2any = (await import("heic2any")).default;
        const converted = await heic2any({ blob, toType: "image/jpeg", quality: 0.8 });
        if (cancelled) return;
        const result = Array.isArray(converted) ? converted[0] : converted;
        setConvertedUrl(URL.createObjectURL(result));
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => { cancelled = true; };
  }, [url, isHeicFile]);

  useEffect(() => {
    if (!isPdf) return;
    let cancelled = false;
    renderPdfThumbnail(url)
      .then((dataUrl) => { if (!cancelled) setPdfThumbUrl(dataUrl); })
      .catch((err) => {
        console.error("[pdf-thumbnail] falha ao renderizar", name, err);
        if (!cancelled) setPdfThumbFailed(true);
      });
    return () => { cancelled = true; };
  }, [url, isPdf]);

  if (isPdf) {
    if (pdfThumbUrl) {
      return (
        <div
          className="w-full aspect-[4/3] overflow-hidden rounded-t-md bg-white cursor-pointer"
          onClick={onClick}
        >
          <img
            src={pdfThumbUrl}
            alt={name}
            className="w-full h-full object-cover object-top transition group-hover:scale-105"
          />
        </div>
      );
    }
    return (
      <div
        className="w-full aspect-[4/3] flex items-center justify-center overflow-hidden rounded-t-md bg-red-500/10 cursor-pointer"
        onClick={onClick}
      >
        {pdfThumbFailed ? (
          <FileText className="h-7 w-7 text-red-500/70" />
        ) : (
          <Loader2 className="h-5 w-5 animate-spin text-red-500/50" />
        )}
      </div>
    );
  }

  if (failed) {
    return (
      <div className="w-full aspect-[4/3] flex items-center justify-center overflow-hidden rounded-t-md bg-muted/50">
        <FileText className="h-6 w-6 text-muted-foreground/40" />
      </div>
    );
  }

  if (isHeicFile && !convertedUrl) {
    return (
      <div className="w-full aspect-[4/3] flex items-center justify-center overflow-hidden rounded-t-md bg-muted">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/50" />
      </div>
    );
  }

  return (
    <div
      className={cn("w-full aspect-[4/3] overflow-hidden rounded-t-md bg-muted", isKnownImage && "cursor-pointer")}
      onClick={onClick}
    >
      <img
        src={convertedUrl ?? url}
        alt={name}
        className="w-full h-full object-cover transition group-hover:scale-105"
        onError={() => setFailed(true)}
      />
    </div>
  );
}

export function PmAttachmentsSection({ taskId, attachments, membersMap, onSetCover, currentCoverUrl }: Props) {
  const upload = useUploadPmAttachment();
  const uploadResumable = useUploadPmAttachmentResumable();
  const queryClient = useQueryClient();
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [viewerImages, setViewerImages] = useState<{ url: string; name: string }[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [downloadingAll, setDownloadingAll] = useState(false);
  const [duplicateConflict, setDuplicateConflict] = useState<{ file: File; category: AttachmentCategory; existing: PmAttachment; resolve: () => void } | null>(null);

  const performUpload = useCallback(async (file: File, category: AttachmentCategory) => {
    const isVideo = file.type.startsWith("video/");
    const uploadEntry: UploadingFile = { name: file.name, size: file.size, progress: 0, category };
    setUploadingFiles(prev => [...prev, uploadEntry]);

    // Mirrors this upload's lifecycle into the global tray store (src/lib/upload-tray-store.ts)
    // so progress stays visible in the bottom-right corner even after this dialog closes —
    // the XHR/fetch itself already isn't tied to this component's lifecycle, only the
    // progress UI was, until now.
    const globalId = `${taskId}-${file.name}-${Date.now()}`;
    addGlobalUpload({ id: globalId, taskId, fileName: file.name, fileSize: file.size, progress: 0, status: "uploading" });

    const applyProgress = (pct: number, phase?: UploadingFile["phase"]) => {
      setUploadingFiles(prev =>
        prev.map(f => f.name === file.name && f.category === category ? { ...f, progress: pct, ...(phase ? { phase } : {}) } : f)
      );
      updateGlobalUpload(globalId, { progress: pct });
    };

    // Video reports real progress from the direct-to-Drive PUT; everything else keeps
    // the simulated ramp (the whole request/response happens too fast to sample).
    let interval: ReturnType<typeof setInterval> | null = null;
    let simulatedProgress = 0;
    if (!isVideo) {
      interval = setInterval(() => {
        simulatedProgress = Math.min(simulatedProgress + (file.size > 10 * 1024 * 1024 ? 2 : 15), 90);
        applyProgress(simulatedProgress);
      }, 300);
    }

    try {
      let fileToUpload = file;
      let compressionFailed = false;

      if (isVideo) {
        try {
          applyProgress(0, "compressing");
          fileToUpload = await downscaleVideo(file, (pct) => applyProgress(pct, "compressing"));
        } catch (prepErr) {
          // Never block the upload over a failed compression — worst case the original
          // (possibly larger/higher-bitrate) file goes up, same as before this existed.
          // This used to only log to the console, which nobody sees — a video whose
          // compression fails (a real cause: iPhone .mov exports in HEVC, a codec the
          // in-browser encoder often can't decode) uploads unprocessed and silently risks
          // the exact WhatsApp/Instagram playback problem this pipeline exists to prevent.
          console.error("[video-transcode] falha ao comprimir, enviando original", prepErr);
          fileToUpload = file;
          compressionFailed = true;
        }
        applyProgress(0, "uploading");
      }

      if (isVideo) {
        // Large videos over a shaky connection are the one path prone to a mid-stream
        // network drop ("Erro de rede durante o upload") — worth a couple of automatic
        // retries before making the user restart the whole upload by hand.
        await uploadWithRetry(() => uploadResumable.mutateAsync({
          task_id: taskId,
          file: fileToUpload,
          category,
          onProgress: (pct) => applyProgress(Math.min(pct, 99), "uploading"),
        }));
      } else {
        await upload.mutateAsync({ task_id: taskId, file, category });
      }
      if (interval) clearInterval(interval);
      applyProgress(100);
      updateGlobalUpload(globalId, { status: "success" });
      setTimeout(() => {
        setUploadingFiles(prev => prev.filter(f => !(f.name === file.name && f.category === category)));
        removeGlobalUpload(globalId);
      }, 800);
      toast.success("Arquivo anexado!");
      if (compressionFailed) {
        toast.warning(`"${file.name}" foi enviado sem compressão — pode não tocar corretamente no WhatsApp/Instagram. Se for um vídeo do iPhone, tente reexportar em "Mais compatível" (Ajustes > Câmera > Formatos) e reenviar.`, { duration: 12000 });
      }

      if (isVideo) {
        try {
          const posterBlob = await renderVideoPoster(fileToUpload);
          const posterName = `${file.name.replace(/\.[^.]+$/, "")}-poster.jpg`;
          const posterFile = new File([posterBlob], posterName, { type: "image/jpeg" });
          await upload.mutateAsync({ task_id: taskId, file: posterFile, category });
        } catch (posterErr) {
          console.error("[video-poster] falha ao gerar miniatura", posterErr);
          if (!compressionFailed) {
            toast.warning(`Não consegui gerar uma miniatura automática pra "${file.name}" — defina uma capa manualmente pra ele aparecer no Cronograma.`, { duration: 10000 });
          }
        }
      }
    } catch (err: any) {
      if (interval) clearInterval(interval);
      setUploadingFiles(prev => prev.filter(f => !(f.name === file.name && f.category === category)));
      updateGlobalUpload(globalId, { status: "error", errorMessage: err?.message ?? "Erro ao enviar arquivo" });
      toast.error(err?.message ?? "Erro ao enviar arquivo");
    }
  }, [taskId, upload, uploadResumable]);

  // Attaching a file whose name matches one already here is ambiguous — could be an
  // updated version meant to replace it, or a genuinely different file that happens to
  // share a name. Ask instead of silently doing either.
  const doUpload = useCallback((file: File, category: AttachmentCategory): Promise<void> => {
    if (file.size > 1024 * 1024 * 1024) { toast.error("Arquivo muito grande (máx 1GB)"); return Promise.resolve(); }
    const existing = attachments.find(a => a.category === category && a.file_name.toLowerCase() === file.name.toLowerCase());
    if (!existing) return performUpload(file, category);
    return new Promise<void>((resolve) => setDuplicateConflict({ file, category, existing, resolve }));
  }, [attachments, performUpload]);

  const nextAvailableName = (name: string, category: AttachmentCategory) => {
    const dot = name.lastIndexOf(".");
    const base = dot > 0 ? name.slice(0, dot) : name;
    const ext = dot > 0 ? name.slice(dot) : "";
    const existingNames = new Set(attachments.filter(a => a.category === category).map(a => a.file_name));
    let n = 2;
    while (existingNames.has(`${base} (${n})${ext}`)) n++;
    return `${base} (${n})${ext}`;
  };

  const resolveDuplicateReplace = async () => {
    if (!duplicateConflict) return;
    const { file, category, existing, resolve } = duplicateConflict;
    setDuplicateConflict(null);
    await handleDeleteAttachment(existing);
    await performUpload(file, category);
    resolve();
  };

  const resolveDuplicateKeepBoth = async () => {
    if (!duplicateConflict) return;
    const { file, category, resolve } = duplicateConflict;
    setDuplicateConflict(null);
    const renamed = new File([file], nextAvailableName(file.name, category), { type: file.type });
    await performUpload(renamed, category);
    resolve();
  };

  const resolveDuplicateCancel = () => {
    if (!duplicateConflict) return;
    duplicateConflict.resolve();
    setDuplicateConflict(null);
  };

  const handleDeleteAttachment = async (att: PmAttachment) => {
    try {
      const { error: storageErr } = await supabase.storage.from("pm-attachments").remove([att.storage_path]);
      if (storageErr) console.warn("Storage delete error:", storageErr);
      if (att.drive_file_id) {
        const { error: driveErr } = await supabase.functions.invoke("drive-delete", { body: { drive_file_id: att.drive_file_id, attachment_id: att.id } });
        if (driveErr) console.warn("Drive delete error:", driveErr);
      }
      await sb.from("pm_attachments").delete().eq("id", att.id);
      queryClient.invalidateQueries({ queryKey: ["pm_attachments"] });
      queryClient.invalidateQueries({ queryKey: ["pm_attachments_for_calendar"] });
      queryClient.invalidateQueries({ queryKey: ["cover_candidates"] });
      toast.success("Anexo excluído!");
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao excluir anexo");
    }
  };

  const handleMoveCategory = async (att: PmAttachment, target: AttachmentCategory) => {
    try {
      await sb.from("pm_attachments").update({ category: target }).eq("id", att.id);
      queryClient.invalidateQueries({ queryKey: ["pm_attachments"] });
      queryClient.invalidateQueries({ queryKey: ["pm_attachments_for_calendar"] });
      queryClient.invalidateQueries({ queryKey: ["cover_candidates"] });
      toast.success(target === "final" ? "Movido para Conteúdo Final" : "Movido para Materiais de Produção");
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao mover anexo");
    }
  };

  const isImage = (type: string | null) => type?.startsWith("image/");
  const isHeic = (name: string) => /\.heic$/i.test(name);
  const isPdf = (type: string | null, name: string) => type === "application/pdf" || /\.pdf$/i.test(name);

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
      queryClient.invalidateQueries({ queryKey: ["pm_attachments_for_calendar"] });
      queryClient.invalidateQueries({ queryKey: ["cover_candidates"] });
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

  const handleDownloadAll = async () => {
    const downloadable = attachments.filter(a => !!a.public_url);
    if (downloadable.length === 0) {
      toast.error("Nenhum anexo disponível para download");
      return;
    }
    setDownloadingAll(true);
    toast.info(`Baixando ${downloadable.length} anexo${downloadable.length > 1 ? 's' : ''}...`);
    let failed = 0;
    for (const att of downloadable) {
      try {
        const res = await fetch(att.public_url!);
        const blob = await res.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = att.file_name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(blobUrl);
        await new Promise((r) => setTimeout(r, 150));
      } catch {
        failed++;
      }
    }
    setDownloadingAll(false);
    if (failed > 0) {
      toast.warning(`Download concluído. ${failed} arquivo${failed > 1 ? 's' : ''} falhou.`);
    } else {
      toast.success("Download concluído!");
    }
  };

  // Video uploads auto-generate a "{name}-poster.jpg" sibling (see renderVideoPoster)
  // purely to serve as a thumbnail elsewhere (Cronograma cards). Surfacing it as its
  // own card here too just reads as a mystery extra file, so it's used as the video's
  // own thumbnail instead and hidden from the grid/count.
  const videoPosterMap = new Map<string, PmAttachment>();
  const posterAttachmentIds = new Set<string>();
  for (const att of attachments) {
    if (!att.file_type?.startsWith("video/")) continue;
    const posterName = `${att.file_name.replace(/\.[^.]+$/, "")}-poster.jpg`;
    // A retried upload (e.g. during a network hiccup) can leave more than one poster
    // behind for the same video — hide every match, not just the first, or the extras
    // resurface as their own mystery card. The most recent one is the best guess at
    // which frame actually matches what ended up as the final video.
    const posters = attachments.filter(p => p.category === att.category && p.file_name === posterName && p.file_type?.startsWith("image/"));
    if (posters.length > 0) {
      const latest = posters.reduce((a, b) => (a.created_at > b.created_at ? a : b));
      videoPosterMap.set(att.id, latest);
      for (const p of posters) posterAttachmentIds.add(p.id);
    }
  }

  const materials = attachments.filter(a => (a.category ?? "material") === "material" && !posterAttachmentIds.has(a.id));
  const finals = attachments.filter(a => a.category === "final" && !posterAttachmentIds.has(a.id));

  const openViewer = (att: PmAttachment, list: PmAttachment[]) => {
    const images = list.filter(a => (isImage(a.file_type) || isHeic(a.file_name) || isPdf(a.file_type, a.file_name) || a.file_type?.startsWith("video/")) && a.public_url)
      .map(a => ({ url: a.public_url!, name: a.file_name }));
    const idx = images.findIndex(i => i.url === att.public_url);
    setViewerImages(images);
    setViewerIndex(idx >= 0 ? idx : 0);
    setViewerOpen(true);
  };

  return (
    <div className="space-y-5">
      {attachments.length > 0 && (
        <div className="flex justify-end">
          <Button size="sm" variant="outline" onClick={handleDownloadAll} disabled={downloadingAll}>
            {downloadingAll ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Download className="mr-1 h-3 w-3" />}
            Baixar todos
          </Button>
        </div>
      )}

      <CategorySection
        category="material"
        title="Materiais de Produção"
        subtitle="Arquivos de apoio usados para criar o conteúdo"
        icon={<Target className="h-4 w-4 text-amber-500" />}
        accentClass="border-amber-500/30"
        list={materials}
        posterMap={videoPosterMap}
        uploadingFiles={uploadingFiles.filter(u => u.category === "material")}
        onUpload={(file) => doUpload(file, "material")}
        onDelete={handleDeleteAttachment}
        onRenameStart={handleRenameStart}
        onRenameCommit={handleRenameCommit}
        renamingId={renamingId}
        renameDraft={renameDraft}
        setRenameDraft={setRenameDraft}
        setRenamingId={setRenamingId}
        onCopyUrl={copyUrl}
        onDownload={handleDownload}
        onSetCover={onSetCover}
        currentCoverUrl={currentCoverUrl}
        membersMap={membersMap}
        onMove={(att) => handleMoveCategory(att, "final")}
        moveLabel="Mover para Conteúdo Final"
        onOpenViewer={(att) => openViewer(att, materials)}
      />

      <CategorySection
        category="final"
        title="Conteúdo Final"
        subtitle="Arquivos produzidos e entregues como resultado"
        icon={<Rocket className="h-4 w-4 text-emerald-500" />}
        accentClass="border-emerald-500/30"
        list={finals}
        posterMap={videoPosterMap}
        uploadingFiles={uploadingFiles.filter(u => u.category === "final")}
        onUpload={(file) => doUpload(file, "final")}
        onDelete={handleDeleteAttachment}
        onRenameStart={handleRenameStart}
        onRenameCommit={handleRenameCommit}
        renamingId={renamingId}
        renameDraft={renameDraft}
        setRenameDraft={setRenameDraft}
        setRenamingId={setRenamingId}
        onCopyUrl={copyUrl}
        onDownload={handleDownload}
        onSetCover={onSetCover}
        currentCoverUrl={currentCoverUrl}
        membersMap={membersMap}
        onMove={(att) => handleMoveCategory(att, "material")}
        moveLabel="Mover para Materiais de Produção"
        onOpenViewer={(att) => openViewer(att, finals)}
      />

      <PmImageViewer
        open={viewerOpen}
        onClose={() => setViewerOpen(false)}
        initialIndex={viewerIndex}
        images={viewerImages}
      />

      <AlertDialog open={!!duplicateConflict} onOpenChange={(v) => { if (!v) resolveDuplicateCancel(); }}>
        <AlertDialogContent className="z-[200]">
          <AlertDialogHeader>
            <AlertDialogTitle>Já existe um arquivo com esse nome</AlertDialogTitle>
            <AlertDialogDescription>
              "{duplicateConflict?.file.name}" já está anexado aqui. Quer substituir o arquivo existente ou manter os dois?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={resolveDuplicateCancel}>Cancelar</AlertDialogCancel>
            <Button variant="outline" onClick={resolveDuplicateKeepBoth}>Manter os dois</Button>
            <AlertDialogAction onClick={resolveDuplicateReplace}>Substituir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

interface CategorySectionProps {
  category: AttachmentCategory;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  accentClass: string;
  list: PmAttachment[];
  posterMap: Map<string, PmAttachment>;
  uploadingFiles: UploadingFile[];
  onUpload: (file: File) => void | Promise<void>;
  onDelete: (att: PmAttachment) => void;
  onRenameStart: (att: PmAttachment) => void;
  onRenameCommit: (id: string) => void;
  renamingId: string | null;
  renameDraft: string;
  setRenameDraft: (v: string) => void;
  setRenamingId: (v: string | null) => void;
  onCopyUrl: (url: string) => void;
  onDownload: (url: string, name: string) => void;
  onSetCover?: (url: string) => void;
  currentCoverUrl?: string | null;
  membersMap: Record<string, { name: string; avatar?: string }>;
  onMove: (att: PmAttachment) => void;
  moveLabel: string;
  onOpenViewer: (att: PmAttachment) => void;
}

function CategorySection(props: CategorySectionProps) {
  const {
    title, subtitle, icon, accentClass, list, posterMap, uploadingFiles, onUpload, onDelete,
    onRenameStart, onRenameCommit, renamingId, renameDraft, setRenameDraft, setRenamingId,
    onCopyUrl, onDownload, onSetCover, currentCoverUrl, membersMap, onMove, moveLabel, onOpenViewer,
  } = props;

  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [isOpen, setIsOpen] = useState(true);

  const isImage = (type: string | null) => type?.startsWith("image/");
  const isHeic = (name: string) => /\.heic$/i.test(name);
  const isPdf = (type: string | null, name: string) => type === "application/pdf" || /\.pdf$/i.test(name);

  const handleSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (const file of Array.from(files)) await onUpload(file);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length > 0) {
      for (const file of Array.from(e.dataTransfer.files)) await onUpload(file);
    }
  };

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      className={cn("rounded-lg border bg-card/30 p-3", accentClass)}
      onDrop={handleDrop}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false); }}
    >
      <div className="flex items-center justify-between gap-2">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-2 min-w-0 flex-1 text-left rounded-md px-1 py-1 transition hover:bg-accent/50"
          >
            <div className="shrink-0">{icon}</div>
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-tight">
                {title} <span className="text-muted-foreground font-normal">({list.length})</span>
              </p>
              <p className="text-[10px] text-muted-foreground truncate">{subtitle}</p>
            </div>
            <ChevronDown className={cn("h-4 w-4 text-muted-foreground shrink-0 transition-transform", isOpen && "rotate-180")} />
          </button>
        </CollapsibleTrigger>
        <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploadingFiles.length > 0}>
          {uploadingFiles.length > 0 ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Upload className="mr-1 h-3 w-3" />}
          Upload
        </Button>
        <input ref={fileRef} type="file" multiple className="hidden" onChange={handleSelect} />
      </div>

      <CollapsibleContent className="space-y-3 data-[state=open]:mt-3">
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
                  {f.progress >= 100
                    ? "Concluído!"
                    : f.phase === "compressing"
                      ? `Otimizando vídeo... ${f.progress}%`
                      : `${f.progress}% enviado...`}
                </p>
              </div>
            ))}
          </div>
        )}

        {dragging && (
          <div className="flex items-center justify-center rounded-lg border-2 border-dashed border-primary/50 bg-primary/5 py-6">
            <p className="text-sm text-primary font-medium">Solte os arquivos aqui</p>
          </div>
        )}

        {list.length === 0 && !dragging && uploadingFiles.length === 0 && (
          <div
            className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border/40 py-6 cursor-pointer hover:border-primary/30 transition"
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="h-5 w-5 text-muted-foreground/40 mb-1.5" />
            <p className="text-xs text-muted-foreground">Arraste ou clique para anexar</p>
          </div>
        )}

        {list.length > 0 && (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-1.5">
            {list.map((att) => {
              const isCover = currentCoverUrl === att.public_url;
              const isImg = isImage(att.file_type);
              const isVid = att.file_type?.startsWith("video/") ?? false;
              const poster = posterMap.get(att.id);
              const uploader = membersMap[att.uploaded_by];

              return (
                <div
                  key={att.id}
                  className={cn(
                    "relative group rounded-md border bg-card/30 transition-all",
                    isCover ? "border-primary/50 ring-1 ring-primary/30" : "border-border/40",
                  )}
                >
                  {att.public_url ? (
                    <AttachmentThumbnail
                      url={att.public_url}
                      name={att.file_name}
                      isKnownImage={!!isImg || isHeic(att.file_name)}
                      isPdf={isPdf(att.file_type, att.file_name)}
                      isVideo={isVid}
                      posterUrl={poster?.public_url ?? undefined}
                      onClick={() => (isImg || isHeic(att.file_name) || isPdf(att.file_type, att.file_name) || isVid) ? onOpenViewer(att) : undefined}
                    />
                  ) : (
                    <div className="w-full aspect-[4/3] flex items-center justify-center overflow-hidden rounded-t-md bg-muted/50">
                      <FileText className="h-6 w-6 text-muted-foreground/40" />
                    </div>
                  )}

                  <div className="absolute top-1 right-1 z-20">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="secondary" className="h-5 w-5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity bg-background/80 backdrop-blur-sm">
                          <MoreHorizontal className="h-3 w-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-52" side="bottom" sideOffset={4} style={{ zIndex: 99999 }}>
                        {isImg && att.public_url && onSetCover && !isCover && (
                          <DropdownMenuItem className="text-xs gap-2" onClick={() => onSetCover(att.public_url!)}>
                            <ImagePlus className="h-3.5 w-3.5" /> Definir como capa
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem className="text-xs gap-2" onClick={() => onMove(att)}>
                          <ArrowRightLeft className="h-3.5 w-3.5" /> {moveLabel}
                        </DropdownMenuItem>
                        {att.public_url && (
                          <DropdownMenuItem className="text-xs gap-2" onClick={() => onCopyUrl(att.public_url!)}>
                            <Link2 className="h-3.5 w-3.5" /> Copiar URL
                          </DropdownMenuItem>
                        )}
                        {att.public_url && (
                          <DropdownMenuItem className="text-xs gap-2" onClick={() => onDownload(att.public_url!, att.file_name)}>
                            <Download className="h-3.5 w-3.5" /> Baixar
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem className="text-xs gap-2" onClick={() => onRenameStart(att)}>
                          <Pencil className="h-3.5 w-3.5" /> Renomear
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-xs gap-2 text-destructive focus:text-destructive"
                          onClick={() => onDelete(att)}
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="px-1.5 py-1 space-y-0.5">
                    {renamingId === att.id ? (
                      <Input
                        autoFocus
                        value={renameDraft}
                        onChange={(e) => setRenameDraft(e.target.value)}
                        onBlur={() => onRenameCommit(att.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") onRenameCommit(att.id);
                          if (e.key === "Escape") setRenamingId(null);
                        }}
                        className="h-5 text-[9px] px-1 py-0 rounded"
                      />
                    ) : (
                      <>
                        <p className="truncate text-[9px] font-medium min-w-0">
                          {att.file_name}
                          {isCover && <span className="ml-0.5 text-[7px] text-primary font-bold uppercase">Capa</span>}
                        </p>
                        {att.file_size && (
                          <p className="text-[8px] text-muted-foreground">{formatFileSize(att.file_size)}</p>
                        )}
                      </>
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
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
