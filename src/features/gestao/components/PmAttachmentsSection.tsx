import { useRef, useState, useCallback, useEffect } from "react";
import { format } from "date-fns";
import { Upload, FileText, Download, MoreHorizontal, Link2, ImagePlus, GripVertical, Trash2, Loader2, Pencil, ArrowRightLeft, Target, Rocket, ChevronDown, Play, FileVideo, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { useUploadPmAttachment, useUploadPmAttachmentResumable } from "../hooks/use-pm-data";
import type { PmAttachment } from "../pm-types";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { toStorageRenderUrl } from "@/lib/storage-image-url";
import { PmImageViewer } from "./PmImageViewer";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { addGlobalUpload, updateGlobalUpload, removeGlobalUpload } from "@/lib/upload-tray-store";
import { AvatarCropDialog } from "@/features/meu-painel/components/AvatarCropDialog";
import { FEED_FORMAT, VERTICAL_FORMAT, type InstagramFormat } from "@/features/calendario/calendar-types";
import { fastTranscodeVideo } from "@/lib/fast-video-transcode";

import { copyToLinkedTasks, deleteSameFileRows, storagePathStillUsed, type AttachmentRowLike } from "../lib/attachment-sync";

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
export async function renderVideoPoster(file: File, targetWidth = 260): Promise<Blob> {
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

// Custom drag MIME type marking "this drag is an existing attachment card being moved
// between category sections", so a section's drop zone (built for OS file uploads) can
// tell that apart from a real file coming from outside the browser.
const ATTACHMENT_DRAG_MIME = "application/x-pm-attachment-id";

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

// Fallback caps tried in order after MAX_VIDEO_LONG_EDGE, only if a prior attempt throws
// (see downscaleVideoWithFallback below). Lower caps mean fewer/smaller decoded frames held
// in the WASM heap at once, which is what actually crashes on 4K sources — not the encoder
// settings — so this is the lever that turns a failed compression into a successful one.
const FALLBACK_VIDEO_LONG_EDGES = [1280, 854];

/** Re-encodes a local video file so its long edge is at most `maxEdge` px — runs entirely
 * client-side via ffmpeg.wasm (no server involved). Throws on failure; caller falls back to a
 * smaller cap (see downscaleVideoWithFallback) rather than giving up on compression outright. */
async function downscaleVideo(file: File, maxEdge: number, onProgress?: (pct: number) => void): Promise<File> {
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
      "-vf", `scale='min(${maxEdge},iw)':'min(${maxEdge},ih)':force_original_aspect_ratio=decrease:force_divisible_by=2`,
      // "ultrafast" trades a somewhat larger output file for meaningfully less encoding
      // time — worth it since this runs synchronously in the browser via WASM (much slower
      // than native ffmpeg) and blocks the upload. Doesn't touch the resolution cap above,
      // which is the part that actually fixed the old WhatsApp in-app playback failure.
      // rc-lookahead=0/ref=1 disable libx264's multi-frame lookahead buffer, which is the
      // single biggest driver of peak memory on a 4K source (each held frame is tens of MB) —
      // this is what was actually crashing the WASM heap on large vertical 4K exports, the
      // same failure mode already root-caused for the poster-frame extraction below.
      "-c:v", "libx264", "-preset", "ultrafast", "-crf", "26",
      "-x264-params", "rc-lookahead=0:ref=1",
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

/** Reads a video's pixel dimensions via the browser's own (hardware-accelerated) decoder —
 * no ffmpeg/WASM involved, resolves in milliseconds. Returns null if the browser can't read
 * metadata for this file at all (e.g. a codec it doesn't support), so the caller can fall
 * back to attempting compression anyway rather than assuming anything about the source. */
function probeVideoDimensions(file: File): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    const url = URL.createObjectURL(file);
    const finish = (result: { width: number; height: number } | null) => {
      URL.revokeObjectURL(url);
      resolve(result);
    };
    video.onloadedmetadata = () => finish(video.videoWidth && video.videoHeight ? { width: video.videoWidth, height: video.videoHeight } : null);
    video.onerror = () => finish(null);
    video.src = url;
  });
}

/** Tries downscaleVideo at MAX_VIDEO_LONG_EDGE, then at progressively smaller caps in
 * FALLBACK_VIDEO_LONG_EDGES if it throws — a 4K source that OOMs the WASM heap at 1920 will
 * often succeed at 1280 or 854, since fewer/smaller frames need to be held at once. Only
 * throws (letting the caller fall back to the uncompressed original) once every cap has
 * failed. */
export async function downscaleVideoWithFallback(file: File, onProgress?: (pct: number) => void): Promise<File> {
  // The resolution cap is what actually fixed the old WhatsApp in-app playback failure (see
  // downscaleVideo's comment) — a source already inside it has nothing left for the slow
  // WASM re-encode to fix, so skip straight to upload instead of making every attachment,
  // however small, pay for a full decode+encode pass.
  const dims = await probeVideoDimensions(file);
  if (dims && Math.max(dims.width, dims.height) <= MAX_VIDEO_LONG_EDGE) {
    onProgress?.(100);
    return file;
  }

  // Browser's own hardware encoder first (seconds instead of minutes); ffmpeg.wasm below stays as the fallback
  if (dims) {
    const fast = await fastTranscodeVideo(file, { kind: "max-edge", maxEdge: MAX_VIDEO_LONG_EDGE }, dims, onProgress);
    if (fast) return fast;
  }

  const caps = [MAX_VIDEO_LONG_EDGE, ...FALLBACK_VIDEO_LONG_EDGES];
  let lastErr: unknown;
  for (const cap of caps) {
    try {
      return await downscaleVideo(file, cap, onProgress);
    } catch (err) {
      lastErr = err;
      console.error(`[video-transcode] falha ao comprimir em ${cap}px, tentando cap menor`, err);
    }
  }
  throw lastErr;
}

// Output widths tried in order when fitting a video to a vertical format; both keep the exact 9:16 shape (1080x1920,
// then 720x1280 for sources that run the WASM heap out of memory at full size).
const FIT_FALLBACK_WIDTHS = [1080, 720];

/** Re-frames a video to a vertical Instagram format (Stories/Reels, 1080x1920) with NO letterbox bars: the largest
 * 9:16 region is cropped from the center of each frame and scaled to exactly the target size (1080x1920). A video that
 * is already 9:16 and no bigger than the target is returned untouched. Runs client-side in ffmpeg.wasm like downscaleVideo; throws if
 * the browser can't read or re-encode the file — callers must NOT fall back to the original, since that is exactly
 * what would be published with bars. */
export async function fitVideoToFormat(file: File, format: InstagramFormat, onProgress?: (pct: number) => void): Promise<File> {
  const dims = await probeVideoDimensions(file);
  if (!dims) {
    throw new Error(`Não consegui ler este vídeo no navegador para ajustá-lo a ${format.width}x${format.height}. Exporte em MP4 (H.264) e tente de novo.`);
  }
  const sameAspect = Math.abs(dims.width / dims.height - format.aspect) <= 0.01;
  if (sameAspect && dims.width <= format.width) {
    onProgress?.(100);
    return file;
  }

  // largest centered region with the target aspect ratio (even dimensions, as H.264 needs)
  const even = (n: number) => Math.max(2, Math.floor(n / 2) * 2);
  const wider = dims.width / dims.height > format.aspect;
  const cropH = wider ? even(dims.height) : even(dims.width / format.aspect);
  const cropW = wider ? even(dims.height * format.aspect) : even(dims.width);

  // Browser's own hardware encoder first; ffmpeg.wasm below stays as the fallback
  const fast = await fastTranscodeVideo(file, { kind: "cover", width: format.width, height: format.height }, dims, onProgress);
  if (fast) return fast;

  const { fetchFile } = await import("@ffmpeg/util");
  let lastErr: unknown;
  for (const targetW of FIT_FALLBACK_WIDTHS.filter((w) => w <= format.width)) {
    // always the exact standard size (1080x1920 — or 720x1280 in the low-memory retry), even when the source is smaller
    const outW = even(targetW);
    const outH = even(outW / format.aspect);
    const ffmpeg = await loadFfmpeg();
    const ext = file.name.match(/\.[^.]+$/)?.[0] || ".mp4";
    const inputName = `fit-input${ext}`;
    const outputName = "fit-output.mp4";
    const onFfmpegProgress = ({ progress }: { progress: number }) => {
      if (Number.isFinite(progress)) onProgress?.(Math.max(0, Math.min(99, Math.round(progress * 100))));
    };
    ffmpeg.on("progress", onFfmpegProgress);
    try {
      await ffmpeg.writeFile(inputName, await fetchFile(file));
      await runFfmpeg(ffmpeg, [
        "-i", inputName,
        "-vf", `crop=${cropW}:${cropH},scale=${outW}:${outH}:flags=lanczos,setsar=1,format=yuv420p`,
        "-c:v", "libx264", "-preset", "ultrafast", "-crf", "24",
        "-x264-params", "rc-lookahead=0:ref=1",
        "-c:a", "aac", "-b:a", "128k",
        "-movflags", "+faststart",
        outputName,
      ]);
      const data = (await ffmpeg.readFile(outputName)) as Uint8Array;
      onProgress?.(100);
      return new File([new Blob([data], { type: "video/mp4" })], `${file.name.replace(/\.[^.]+$/, "")}.mp4`, { type: "video/mp4" });
    } catch (err) {
      lastErr = err;
      console.error(`[video-fit] falha ao ajustar para ${outW}x${outH}`, err);
    } finally {
      ffmpeg.off("progress", onFfmpegProgress);
      await ffmpeg.deleteFile(inputName).catch(() => {});
      await ffmpeg.deleteFile(outputName).catch(() => {});
    }
  }
  console.error("[video-fit] todas as tentativas falharam", lastErr);
  throw new Error(`Não foi possível ajustar o vídeo para ${format.width}x${format.height} neste navegador (pode ser falta de memória). Use um vídeo menor ou exporte já em 9:16.`);
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
  /** usado no nome do .zip de "Baixar todos" */
  taskTitle?: string;
  attachments: PmAttachment[];
  membersMap: Record<string, { name: string; avatar?: string }>;
  onSetCover?: (url: string) => void;
  currentCoverUrl?: string | null;
  // Quando definido, toda imagem anexada na categoria "Final" passa por um recorte nesse formato antes de subir:
  // 1080x1350 pra Carrossel/Post/Foto, 1080x1920 pra Reels/Stories (ver getInstagramFormat e PmTaskDetailDialog.tsx).
  cropFormat?: InstagramFormat | null;
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
          <img src={toStorageRenderUrl(posterUrl)} alt={name} className="h-full w-full object-cover transition group-hover:scale-105" />
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
        src={convertedUrl ?? toStorageRenderUrl(url)}
        alt={name}
        className="w-full h-full object-cover transition group-hover:scale-105"
        onError={() => setFailed(true)}
      />
    </div>
  );
}

export function PmAttachmentsSection({ taskId, taskTitle, attachments, membersMap, onSetCover, currentCoverUrl, cropFormat }: Props) {
  const upload = useUploadPmAttachment();
  const uploadResumable = useUploadPmAttachmentResumable();
  const queryClient = useQueryClient();
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [viewerImages, setViewerImages] = useState<{ url: string; name: string }[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  // qual seção está baixando tudo agora ("material" ou "final"); null = nenhuma
  const [downloadingAll, setDownloadingAll] = useState<AttachmentCategory | null>(null);
  const [duplicateConflict, setDuplicateConflict] = useState<{ file: File; category: AttachmentCategory; existing: PmAttachment; resolve: () => void; reason: "name" | "video" } | null>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const replaceTarget = useRef<PmAttachment | null>(null);
  const [cropRequest, setCropRequest] = useState<{ src: string; file: File } | null>(null);
  const cropResolveRef = useRef<((file: File) => void) | null>(null);

  // Abre o diálogo de recorte e devolve uma Promise que só resolve quando o usuário
  // confirma (imagem recortada) ou cancela (imagem original, sem cortar) — performUpload
  // aguarda isso antes de seguir pro upload de verdade.
  const requestFeedCrop = useCallback((file: File): Promise<File> => {
    return new Promise((resolve) => {
      cropResolveRef.current = resolve;
      setCropRequest({ src: URL.createObjectURL(file), file });
    });
  }, []);

  const handleFeedCropConfirm = useCallback((blob: Blob) => {
    if (cropRequest) URL.revokeObjectURL(cropRequest.src);
    const original = cropRequest?.file;
    const croppedFile = new File(
      [blob],
      `${(original?.name ?? "foto").replace(/\.[^.]+$/, "")}.webp`,
      { type: "image/webp" },
    );
    setCropRequest(null);
    cropResolveRef.current?.(croppedFile);
    cropResolveRef.current = null;
  }, [cropRequest]);

  const handleFeedCropCancel = useCallback(() => {
    if (cropRequest) {
      URL.revokeObjectURL(cropRequest.src);
      cropResolveRef.current?.(cropRequest.file);
    }
    setCropRequest(null);
    cropResolveRef.current = null;
  }, [cropRequest]);

  const performUpload = useCallback(async (rawFile: File, category: AttachmentCategory) => {
    const file = cropFormat && category === "final" && rawFile.type.startsWith("image/")
      ? await requestFeedCrop(rawFile)
      : rawFile;
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

    let uploaded = false;
    // ids que já existiam: o que aparecer a mais depois do envio (arquivo e miniatura) é o que vai para as outras etapas do post
    const { data: preRows } = await sb.from("pm_attachments").select("id").eq("task_id", taskId).eq("category", category);
    const beforeIds = new Set<string>((preRows ?? []).map((r: { id: string }) => r.id));
    try {
      let fileToUpload = file;
      let compressionFailed = false;

      if (isVideo && cropFormat?.aspect === VERTICAL_FORMAT.aspect && category === "final") {
        // Reels/Stories: the final video must be exactly the Instagram vertical format — no bars. A failure here
        // aborts the upload (caught below) instead of sending the original, which would be published with bars.
        applyProgress(0, "compressing");
        fileToUpload = await fitVideoToFormat(file, cropFormat, (pct) => applyProgress(pct, "compressing"));
        applyProgress(0, "uploading");
      } else if (isVideo) {
        try {
          applyProgress(0, "compressing");
          fileToUpload = await downscaleVideoWithFallback(file, (pct) => applyProgress(pct, "compressing"));
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
        // a cropped feed/story photo keeps its uncropped original linked, so it can be re-framed later ("Ajustar")
        await upload.mutateAsync({ task_id: taskId, file, category, ...(file !== rawFile && file.type.startsWith("image/") ? { original: rawFile } : {}) });
      }
      if (interval) clearInterval(interval);
      applyProgress(100);
      updateGlobalUpload(globalId, { status: "success" });
      setTimeout(() => {
        setUploadingFiles(prev => prev.filter(f => !(f.name === file.name && f.category === category)));
        removeGlobalUpload(globalId);
      }, 800);
      toast.success("Arquivo anexado!");
      uploaded = true;
      if (compressionFailed) {
        toast.warning(`"${file.name}" foi enviado sem compressão e pode não tocar corretamente no WhatsApp/Instagram. Se for um vídeo do iPhone, tente reexportar em "Mais compatível" (Ajustes > Câmera > Formatos) e reenviar.`, { duration: 12000 });
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
            toast.warning(`Não consegui gerar uma miniatura automática pra "${file.name}". Defina uma capa manualmente pra ele aparecer no Cronograma.`, { duration: 10000 });
          }
        }
      }

      // Conteúdo final: o arquivo novo vale para todas as etapas do mesmo post (design, revisão, PDF…)
      if (category === "final") {
        const { data: fresh } = await sb.from("pm_attachments").select("*").eq("task_id", taskId).eq("category", "final").order("created_at", { ascending: false }).limit(10);
        const newRows = ((fresh ?? []) as AttachmentRowLike[]).filter((r) => !beforeIds.has(r.id));
        if (newRows.length > 0 && (await copyToLinkedTasks(newRows, taskId)) > 0) {
          queryClient.invalidateQueries({ queryKey: ["pm_attachments"] });
          queryClient.invalidateQueries({ queryKey: ["pm_attachments_for_calendar"] });
        }
      }
    } catch (err: any) {
      if (interval) clearInterval(interval);
      setUploadingFiles(prev => prev.filter(f => !(f.name === file.name && f.category === category)));
      updateGlobalUpload(globalId, { status: "error", errorMessage: err?.message ?? "Erro ao enviar arquivo" });
      toast.error(err?.message ?? "Erro ao enviar arquivo");
    }
    return uploaded;
  }, [taskId, upload, uploadResumable, cropFormat, requestFeedCrop]);

  // Attaching a file whose name matches one already here is ambiguous — could be an
  // updated version meant to replace it, or a genuinely different file that happens to
  // share a name. Ask instead of silently doing either.
  const doUpload = useCallback((file: File, category: AttachmentCategory): Promise<void> => {
    if (file.size > 1024 * 1024 * 1024) { toast.error("Arquivo muito grande (máx 1GB)"); return Promise.resolve(); }
    const existing = attachments.find(a => a.category === category && a.file_name.toLowerCase() === file.name.toLowerCase());
    if (existing) return new Promise<void>((resolve) => setDuplicateConflict({ file, category, existing, resolve, reason: "name" }));
    // um post normalmente tem um vídeo final só: um segundo vídeo costuma ser a versão nova do primeiro, com outro nome
    if (category === "final" && file.type.startsWith("video/")) {
      const currentVideo = attachments
        .filter(a => a.category === "final" && a.file_type?.startsWith("video/"))
        .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0];
      if (currentVideo) return new Promise<void>((resolve) => setDuplicateConflict({ file, category, existing: currentVideo, resolve, reason: "video" }));
    }
    return performUpload(file, category).then(() => undefined);
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
    await deleteWithPoster(existing);
    await performUpload(file, category);
    resolve();
  };

  const resolveDuplicateKeepBoth = async () => {
    if (!duplicateConflict) return;
    const { file, category, resolve, reason } = duplicateConflict;
    setDuplicateConflict(null);
    // "mesmo nome" precisa de um nome novo; "segundo vídeo" já tem nome diferente e segue como está
    const toSend = reason === "video" ? file : new File([file], nextAvailableName(file.name, category), { type: file.type });
    await performUpload(toSend, category);
    resolve();
  };

  const resolveDuplicateCancel = () => {
    if (!duplicateConflict) return;
    duplicateConflict.resolve();
    setDuplicateConflict(null);
  };

  // Apagar um vídeo leva junto a miniatura dele (arquivo "<nome>-poster.jpg"): sem isso ela ficava para trás e, no
  // Cronograma, o card podia continuar mostrando o quadro do vídeo antigo.
  const deleteWithPoster = async (att: PmAttachment) => {
    const posterName = `${att.file_name.replace(/\.[^.]+$/, "")}-poster.jpg`;
    const poster = att.file_type?.startsWith("video/")
      ? attachments.find(a => a.id !== att.id && a.category === att.category && a.file_name === posterName && a.file_type?.startsWith("image/"))
      : undefined;
    await handleDeleteAttachment(att);
    if (poster) await handleDeleteAttachment(poster, true);
  };

  // "Substituir arquivo": sobe o novo (qualquer nome), só depois apaga o antigo e coloca o novo na mesma posição.
  const replaceAttachment = async (att: PmAttachment, file: File) => {
    const category = (att.category ?? "material") as AttachmentCategory;
    const before = new Set(attachments.map(a => a.id));
    if (file.size > 1024 * 1024 * 1024) { toast.error("Arquivo muito grande (máx 1GB)"); return; }
    const ok = await performUpload(file, category);
    if (!ok) return; // o antigo só sai se o novo subiu
    const { data } = await sb.from("pm_attachments").select("id, file_name").eq("task_id", taskId).eq("category", category).order("created_at", { ascending: false }).limit(10);
    const fresh = (data ?? []).find((r: { id: string; file_name: string }) => !before.has(r.id) && !/-poster\.jpg$/i.test(r.file_name));
    await deleteWithPoster(att);
    if (fresh && typeof att.order_index === "number") {
      await sb.from("pm_attachments").update({ order_index: att.order_index }).eq("id", fresh.id);
      queryClient.invalidateQueries({ queryKey: ["pm_attachments"] });
      queryClient.invalidateQueries({ queryKey: ["pm_attachments_for_calendar"] });
    }
    toast.success("Arquivo substituído");
  };

  const handleDeleteAttachment = async (att: PmAttachment, quiet = false) => {
    try {
      // The DB row is what actually makes the attachment disappear from the UI — delete it
      // first and let the UI update immediately. Storage/Drive cleanup are best-effort side
      // effects (an external API round-trip each) that don't need to block that; a failure
      // here just leaves an orphaned file behind rather than making every delete wait on it.
      //
      // .select() matters here: the RLS policy only allows the uploader or an admin to
      // delete a given attachment, and a DELETE blocked by RLS returns success with zero
      // rows affected rather than an error — without checking that, this would report
      // "Anexo excluído!" and refetch the exact same row right back.
      const { data, error } = await sb.from("pm_attachments").delete().eq("id", att.id).select("id");
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error("Você não tem permissão para excluir este anexo. Só quem enviou ou um admin pode.");
      }
      // Conteúdo final: apagar numa etapa apaga o mesmo arquivo das outras etapas do post (as cópias feitas quando a etapa avançou)
      const alsoRemoved = await deleteSameFileRows(att as unknown as AttachmentRowLike);
      queryClient.invalidateQueries({ queryKey: ["pm_attachments"] });
      queryClient.invalidateQueries({ queryKey: ["pm_attachments_for_calendar"] });
      queryClient.invalidateQueries({ queryKey: ["cover_candidates"] });
      if (!quiet) toast.success(alsoRemoved > 0 ? "Arquivo excluído de todas as etapas do post" : "Anexo excluído!");

      // o arquivo no armazenamento só sai quando nenhuma outra linha (cópia em outra etapa) ainda usa ele
      storagePathStillUsed(att.storage_path).then((used) => {
        if (used) return;
        supabase.storage.from("pm-attachments").remove([att.storage_path]).then(({ error: storageErr }) => {
          if (storageErr) console.warn("Storage delete error:", storageErr);
        });
      });
      if (att.drive_file_id) {
        supabase.functions.invoke("drive-delete", { body: { drive_file_id: att.drive_file_id, attachment_id: att.id } }).then(({ error: driveErr }) => {
          if (driveErr) console.warn("Drive delete error:", driveErr);
        });
      }
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao excluir anexo");
    }
  };

  const handleMoveCategory = async (att: PmAttachment, target: AttachmentCategory) => {
    try {
      // A video's auto-generated poster (see renderVideoPoster) is matched to it by
      // file name *and category* — see videoPosterMap below — so leaving the poster
      // behind in the old category would silently break that video's thumbnail here.
      const posterName = `${att.file_name.replace(/\.[^.]+$/, "")}-poster.jpg`;
      const pairedPosterIds = attachments
        .filter((a) => a.category === att.category && a.file_name === posterName && a.file_type?.startsWith("image/"))
        .map((a) => a.id);
      await sb.from("pm_attachments").update({ category: target }).in("id", [att.id, ...pairedPosterIds]);
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

  const handleDownload = (url: string, fileName: string) => {
    // fetch+blob (needed so the browser respects `download` with the right file name for a
    // cross-origin URL) gives zero visual feedback until the whole file is in memory — for a
    // large video that reads as "nothing happened" for several seconds. toast.promise covers
    // that gap instead of leaving the click looking like it did nothing.
    const download = async () => {
      const res = await fetch(url);
      if (!res.ok) throw new Error("Erro ao baixar arquivo");
      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(blobUrl);
    };
    toast.promise(download(), {
      loading: `Baixando ${fileName}...`,
      success: "Download concluído!",
      error: "Erro ao baixar arquivo",
    });
  };

  // Baixa todos os arquivos de uma seção (Materiais de Produção ou Conteúdo final), os mesmos que aparecem nela, num único .zip.
  // Com um arquivo só, baixa o próprio arquivo.
  const handleDownloadAll = async (items: PmAttachment[], category: AttachmentCategory) => {
    const downloadable = items.filter(a => !!a.public_url);
    if (downloadable.length === 0) {
      toast.error("Nenhum anexo disponível para download");
      return;
    }
    if (downloadable.length === 1) {
      handleDownload(downloadable[0].public_url!, downloadable[0].file_name);
      return;
    }
    setDownloadingAll(category);
    const toastId = toast.loading(`Preparando o zip com ${downloadable.length} arquivos...`);
    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      const usedNames = new Map<string, number>();
      let failed = 0;
      for (let i = 0; i < downloadable.length; i++) {
        const att = downloadable[i];
        try {
          const res = await fetch(att.public_url!);
          if (!res.ok) throw new Error(String(res.status));
          const blob = await res.blob();
          // dois arquivos com o mesmo nome não podem se sobrescrever dentro do zip: o segundo vira "nome (2).ext"
          const dot = att.file_name.lastIndexOf(".");
          const base = dot > 0 ? att.file_name.slice(0, dot) : att.file_name;
          const ext = dot > 0 ? att.file_name.slice(dot) : "";
          const key = att.file_name.toLowerCase();
          const n = (usedNames.get(key) ?? 0) + 1;
          usedNames.set(key, n);
          zip.file(n === 1 ? att.file_name : `${base} (${n})${ext}`, blob);
        } catch {
          failed++;
        }
        toast.loading(`Preparando o zip... ${i + 1} de ${downloadable.length}`, { id: toastId });
      }
      if (failed === downloadable.length) throw new Error("nenhum arquivo pôde ser baixado");
      // fotos e vídeos já são comprimidos: guardar sem recomprimir deixa o zip muito mais rápido
      const out = await zip.generateAsync({ type: "blob", compression: "STORE" });
      const label = category === "final" ? "Conteudo final" : "Materiais de producao";
      const safeTitle = (taskTitle ?? "anexos").replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 80) || "anexos";
      const blobUrl = window.URL.createObjectURL(out);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `${safeTitle} - ${label}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.setTimeout(() => window.URL.revokeObjectURL(blobUrl), 10_000);
      if (failed > 0) {
        toast.warning(`Zip pronto, mas ${failed} arquivo${failed > 1 ? "s" : ""} não ${failed > 1 ? "entraram" : "entrou"}.`, { id: toastId });
      } else {
        toast.success("Zip pronto!", { id: toastId });
      }
    } catch (e) {
      toast.error("Não foi possível gerar o zip", { id: toastId });
    } finally {
      setDownloadingAll(null);
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
      <div className="divide-y divide-border/30 [&>*]:py-4 [&>*:first-child]:pt-0 [&>*:last-child]:pb-0">
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
        onDelete={deleteWithPoster}
        onReplace={(att) => { replaceTarget.current = att; replaceInputRef.current?.click(); }}
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
        onDownloadAll={() => handleDownloadAll(materials, "material")}
        downloadingAll={downloadingAll === "material"}
        downloadAllDisabled={downloadingAll !== null}
        allAttachments={attachments}
        onMoveCategory={handleMoveCategory}
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
        onDelete={deleteWithPoster}
        onReplace={(att) => { replaceTarget.current = att; replaceInputRef.current?.click(); }}
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
        onDownloadAll={() => handleDownloadAll(finals, "final")}
        downloadingAll={downloadingAll === "final"}
        downloadAllDisabled={downloadingAll !== null}
        allAttachments={attachments}
        onMoveCategory={handleMoveCategory}
      />
      </div>

      <PmImageViewer
        open={viewerOpen}
        onClose={() => setViewerOpen(false)}
        initialIndex={viewerIndex}
        images={viewerImages}
      />

      <input
        ref={replaceInputRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          const att = replaceTarget.current;
          e.target.value = "";
          replaceTarget.current = null;
          if (file && att) void replaceAttachment(att, file);
        }}
      />

      <AlertDialog open={!!duplicateConflict} onOpenChange={(v) => { if (!v) resolveDuplicateCancel(); }}>
        <AlertDialogContent className="z-[200]">
          <AlertDialogHeader>
            <AlertDialogTitle>{duplicateConflict?.reason === "video" ? "Já existe um vídeo no Conteúdo final" : "Já existe um arquivo com esse nome"}</AlertDialogTitle>
            <AlertDialogDescription>
              {duplicateConflict?.reason === "video"
                ? `"${duplicateConflict.existing.file_name}" já é o vídeo final deste post. Quer substituí-lo por "${duplicateConflict.file.name}" (o antigo é apagado de tudo, inclusive do Drive) ou manter os dois?`
                : `"${duplicateConflict?.file.name}" já está anexado aqui. Quer substituir o arquivo existente ou manter os dois?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={resolveDuplicateCancel}>Cancelar</AlertDialogCancel>
            <Button variant="outline" onClick={resolveDuplicateKeepBoth}>Manter os dois</Button>
            <AlertDialogAction onClick={resolveDuplicateReplace}>Substituir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AvatarCropDialog
        open={!!cropRequest}
        imageSrc={cropRequest?.src ?? ""}
        title={`Ajustar foto pro ${(cropFormat ?? FEED_FORMAT).label}`}
        aspect={(cropFormat ?? FEED_FORMAT).aspect}
        cropShape="rect"
        outputWidth={(cropFormat ?? FEED_FORMAT).width}
        outputHeight={(cropFormat ?? FEED_FORMAT).height}
        onConfirm={handleFeedCropConfirm}
        onCancel={handleFeedCropCancel}
      />
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
  onReplace: (att: PmAttachment) => void;
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
  /** baixa todos os arquivos desta seção */
  onDownloadAll: () => void;
  downloadingAll: boolean;
  downloadAllDisabled: boolean;
  allAttachments: PmAttachment[];
  // Raw mover (unlike onMove, which is pre-bound to always send *away* from this section,
  // for the "..." menu action) — dropping a card here needs to send it *to* this section's
  // own category instead, regardless of where it came from.
  onMoveCategory: (att: PmAttachment, target: AttachmentCategory) => void;
}

function CategorySection(props: CategorySectionProps) {
  const {
    category, title, subtitle, icon, accentClass, list, posterMap, uploadingFiles, onUpload, onDelete, onReplace,
    onRenameStart, onRenameCommit, renamingId, renameDraft, setRenameDraft, setRenamingId,
    onCopyUrl, onDownload, onSetCover, currentCoverUrl, membersMap, onMove, moveLabel, onOpenViewer, onDownloadAll, downloadingAll, downloadAllDisabled, allAttachments, onMoveCategory,
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
    // Dragging an existing card from the other category section onto this one — see
    // draggable/onDragStart below — moves it instead of trying to "upload" it again.
    const draggedId = e.dataTransfer.getData(ATTACHMENT_DRAG_MIME);
    if (draggedId) {
      const dragged = allAttachments.find((a) => a.id === draggedId);
      if (dragged && (dragged.category ?? "material") !== category) onMoveCategory(dragged, category);
      return;
    }
    if (e.dataTransfer.files.length > 0) {
      for (const file of Array.from(e.dataTransfer.files)) await onUpload(file);
    }
  };

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      className={cn("relative", dragging && "rounded-xl ring-1 ring-primary/40")}
      onDrop={handleDrop}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false); }}
    >
      <div className="flex items-center gap-2">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            title={subtitle}
            className="group/h flex min-w-0 flex-1 items-center gap-2 rounded-md py-1 text-left transition hover:opacity-90"
          >
            <span className={cn("h-2 w-2 shrink-0 rounded-full", category === "final" ? "bg-emerald-500" : "bg-amber-500")} />
            <span className="truncate text-sm font-medium">{title}</span>
            <span className="text-sm text-muted-foreground">{list.length}</span>
            <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 text-muted-foreground/60 transition-transform", isOpen && "rotate-180")} />
          </button>
        </CollapsibleTrigger>
        {list.length > 0 && (
          <Button size="icon" variant="outline" className="h-8 w-8" onClick={onDownloadAll} disabled={downloadAllDisabled} title="Baixar todos" aria-label={`Baixar todos de ${title}`}>
            {downloadingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          </Button>
        )}
        <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => fileRef.current?.click()} disabled={uploadingFiles.length > 0} title="Upload" aria-label={`Enviar arquivos para ${title}`}>
          {uploadingFiles.length > 0 ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
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
            className="flex h-[70px] cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-border/60 text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="h-4 w-4" />
            <p className="text-xs">Arraste ou clique para anexar</p>
          </div>
        )}

        {list.length > 0 && (
          <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-5">
            {list.map((att) => {
              const isCover = currentCoverUrl === att.public_url;
              const isImg = isImage(att.file_type);
              const isVid = att.file_type?.startsWith("video/") ?? false;
              const poster = posterMap.get(att.id);
              const uploader = membersMap[att.uploaded_by];

              return (
                <div
                  key={att.id}
                  draggable={renamingId !== att.id}
                  onDragStart={(e) => {
                    e.dataTransfer.setData(ATTACHMENT_DRAG_MIME, att.id);
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  className={cn(
                    "group relative aspect-square overflow-hidden rounded-xl bg-muted/40 transition-all",
                    isCover && "ring-2 ring-primary/60",
                  )}
                >
                  {/* a miniatura preenche o quadrado inteiro */}
                  <div className="h-full w-full [&>*]:!aspect-auto [&>*]:!h-full [&>*]:!rounded-none">
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
                      <div className="flex h-full w-full items-center justify-center">
                        <FileText className="h-6 w-6 text-muted-foreground/40" />
                      </div>
                    )}
                  </div>

                  {isCover && (
                    <span className="pointer-events-none absolute left-1.5 top-1.5 rounded-full bg-primary px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-primary-foreground">Capa</span>
                  )}

                  <div className="absolute right-1.5 top-1.5 z-20">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="secondary" className="h-6 w-6 bg-background/80 opacity-100 backdrop-blur-sm transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
                          <MoreHorizontal className="h-3.5 w-3.5" />
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
                        <DropdownMenuItem className="text-xs gap-2" onClick={() => onReplace(att)}>
                          <RefreshCw className="h-3.5 w-3.5" /> Substituir arquivo
                        </DropdownMenuItem>
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

                  {/* nome, tamanho, data e quem enviou: só ao passar o mouse (ou enquanto renomeia) */}
                  <div
                    className={cn(
                      "pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/85 via-black/50 to-transparent px-2 pb-1.5 pt-6 text-white transition-opacity",
                      renamingId === att.id ? "pointer-events-auto opacity-100" : "opacity-0 group-hover:opacity-100",
                    )}
                  >
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
                        className="h-6 rounded bg-background/90 px-1 py-0 text-[10px] text-foreground"
                      />
                    ) : (
                      <p className="truncate text-[10px] font-medium">{att.file_name}</p>
                    )}
                    <div className="mt-0.5 flex items-center gap-1 text-[9px] text-white/75">
                      <span className="truncate">
                        {att.file_size ? `${formatFileSize(att.file_size)} · ` : ""}
                        {format(new Date(att.created_at), "dd/MM 'às' HH:mm")}
                      </span>
                      {uploader && (
                        <Avatar className="ml-auto h-4 w-4 shrink-0 border border-white/30">
                          <AvatarImage src={uploader.avatar} />
                          <AvatarFallback className="bg-primary/20 text-[6px] text-white">
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
