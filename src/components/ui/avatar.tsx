import * as React from "react";
import * as AvatarPrimitive from "@radix-ui/react-avatar";

import { cn } from "@/lib/utils";
import { normalizeAvatarUrl, withAvatarCacheBuster } from "@/lib/avatar-url";

const Avatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Root
    ref={ref}
    className={cn("relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full", className)}
    {...props}
  />
));
Avatar.displayName = AvatarPrimitive.Root.displayName;

/**
 * Custom AvatarImage that bypasses Radix's internal `new Image()` pre-check
 * which can intermittently fail on published/CDN domains, causing avatars to
 * show only fallback initials. Instead we render a native <img> and manage
 * load/error state ourselves while still integrating with the Radix context
 * so that AvatarFallback works correctly.
 */
const AvatarImage = React.forwardRef<
  HTMLImageElement,
  React.ImgHTMLAttributes<HTMLImageElement> & { onLoadingStatusChange?: (status: string) => void }
>(({ className, src, onError, onLoadingStatusChange, ...props }, ref) => {
  const [resolvedSrc, setResolvedSrc] = React.useState<string | undefined>(() =>
    normalizeAvatarUrl(typeof src === "string" ? src : undefined)
  );
  const [status, setStatus] = React.useState<"loading" | "loaded" | "error">(
    resolvedSrc ? "loading" : "error"
  );
  const retriesRef = React.useRef(0);

  React.useEffect(() => {
    retriesRef.current = 0;
    const url = normalizeAvatarUrl(typeof src === "string" ? src : undefined);
    setResolvedSrc(url);
    setStatus(url ? "loading" : "error");
  }, [src]);

  React.useEffect(() => {
    onLoadingStatusChange?.(status);
  }, [status, onLoadingStatusChange]);

  const handleError: React.ReactEventHandler<HTMLImageElement> = (event) => {
    if (resolvedSrc && retriesRef.current < 2) {
      retriesRef.current += 1;
      setResolvedSrc(withAvatarCacheBuster(resolvedSrc));
      setStatus("loading");
      return;
    }
    setStatus("error");
    onError?.(event);
  };

  // When status is error or no src, render nothing so AvatarFallback shows
  if (status === "error" || !resolvedSrc) {
    return null;
  }

  return (
    <img
      ref={ref}
      src={resolvedSrc}
      onError={handleError}
      onLoad={() => setStatus("loaded")}
      className={cn("relative z-10 aspect-square h-full w-full object-cover", className)}
      referrerPolicy="no-referrer"
      draggable={false}
      style={status === "loaded" ? undefined : { position: "absolute", opacity: 0, pointerEvents: "none" }}
      {...props}
    />
  );
});
AvatarImage.displayName = "AvatarImage";

const AvatarFallback = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Fallback>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Fallback
    ref={ref}
    className={cn("relative z-0 flex h-full w-full items-center justify-center rounded-full bg-muted", className)}
    {...props}
  />
));
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName;

export { Avatar, AvatarImage, AvatarFallback };
