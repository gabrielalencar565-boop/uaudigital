// Fast path for re-encoding a local video: uses the browser's own (hardware-accelerated) encoder through
// WebCodecs instead of ffmpeg.wasm, which runs single-threaded and takes minutes on a long clip. Every
// caller keeps ffmpeg.wasm as the fallback — this returns null (never throws) whenever the browser can't
// do the job, or the result doesn't look right, so a failure here never blocks an upload.
import { ALL_FORMATS, BlobSource, BufferTarget, Conversion, Input, Mp4OutputFormat, Output } from "mediabunny";

const even = (n: number) => Math.max(2, Math.round(n / 2) * 2);

export type FastTranscodeTarget =
  // exact output size, center-cropped (Reels/Stories, no bars)
  | { kind: "cover"; width: number; height: number }
  // keep the shape, long edge at most `maxEdge`
  | { kind: "max-edge"; maxEdge: number };

function readDimensions(file: Blob): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    const url = URL.createObjectURL(file);
    const finish = (r: { width: number; height: number } | null) => {
      URL.revokeObjectURL(url);
      resolve(r);
    };
    video.onloadedmetadata = () => finish(video.videoWidth && video.videoHeight ? { width: video.videoWidth, height: video.videoHeight } : null);
    video.onerror = () => finish(null);
    video.src = url;
  });
}

export function canTryFastTranscode(): boolean {
  return typeof VideoEncoder !== "undefined" && typeof VideoDecoder !== "undefined";
}

/** Returns the re-encoded MP4, or null when the fast path can't be used (caller falls back to ffmpeg.wasm). */
export async function fastTranscodeVideo(
  file: File,
  target: FastTranscodeTarget,
  sourceDims: { width: number; height: number },
  onProgress?: (pct: number) => void,
): Promise<File | null> {
  if (!canTryFastTranscode()) return null;
  try {
    let width: number;
    let height: number;
    if (target.kind === "cover") {
      width = even(target.width);
      height = even(target.height);
    } else {
      const scale = Math.min(1, target.maxEdge / Math.max(sourceDims.width, sourceDims.height));
      width = even(sourceDims.width * scale);
      height = even(sourceDims.height * scale);
    }

    const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
    const output = new Output({ format: new Mp4OutputFormat({ fastStart: "in-memory" }), target: new BufferTarget() });
    const conversion = await Conversion.init({
      input,
      output,
      showWarnings: false,
      video: {
        width,
        height,
        fit: target.kind === "cover" ? "cover" : "fill",
        codec: "avc",
        // ~5 Mbps at 1080x1920, scaled by size — in line with what the ffmpeg path (crf 24-26) produced
        bitrate: Math.round(Math.min(8_000_000, Math.max(1_500_000, width * height * 2.4))),
      },
      audio: { codec: "aac" },
    });

    // An audio track the browser can't decode/encode would silently produce a mute video: treat as failure
    const lostTrack = conversion.discardedTracks.some((d) => d.reason !== "discarded_by_user");
    if (!conversion.isValid || lostTrack) {
      await conversion.cancel().catch(() => {});
      return null;
    }

    if (onProgress) conversion.onProgress = (p) => onProgress(Math.max(0, Math.min(99, Math.round(p * 100))));
    await conversion.execute();

    const buffer = (output.target as BufferTarget).buffer;
    if (!buffer || buffer.byteLength < 1024) return null;
    const out = new File([buffer], `${file.name.replace(/\.[^.]+$/, "")}.mp4`, { type: "video/mp4" });

    // Sanity check before trusting it: the browser must be able to open the result at the expected size
    const dims = await readDimensions(out);
    if (!dims || Math.abs(dims.width - width) > 2 || Math.abs(dims.height - height) > 2) return null;
    onProgress?.(100);
    return out;
  } catch (err) {
    console.warn("[video-fast-transcode] indisponível, usando ffmpeg", err);
    return null;
  }
}
