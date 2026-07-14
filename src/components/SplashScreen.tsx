import { useEffect, useRef, useState } from "react";
import logoVideo from "@/assets/uau-logo.mov.asset.json";

export function SplashScreen({ onFinish }: { onFinish: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [fadingOut, setFadingOut] = useState(false);

  useEffect(() => {
    // Lock scroll while splash is visible
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const v = videoRef.current;
    // Safety fallback: if video takes too long, end after 6s
    const fallback = window.setTimeout(() => handleEnd(), 6000);

    const handleEnd = () => {
      window.clearTimeout(fallback);
      setFadingOut(true);
      window.setTimeout(() => {
        document.body.style.overflow = prevOverflow;
        onFinish();
      }, 500);
    };

    if (v) {
      v.addEventListener("ended", handleEnd);
      v.play().catch(() => handleEnd());
    }

    return () => {
      window.clearTimeout(fallback);
      document.body.style.overflow = prevOverflow;
      v?.removeEventListener("ended", handleEnd);
    };
  }, [onFinish]);

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-white transition-opacity duration-500 ease-out"
      style={{ opacity: fadingOut ? 0 : 1, pointerEvents: "all" }}
    >
      <video
        ref={videoRef}
        src={logoVideo.url}
        autoPlay
        muted
        playsInline
        preload="auto"
        className="w-[min(60vw,520px)] h-auto object-contain select-none"
      />
    </div>
  );
}
