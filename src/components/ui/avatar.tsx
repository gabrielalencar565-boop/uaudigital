import * as React from "react";
import * as AvatarPrimitive from "@radix-ui/react-avatar";

import { cn } from "@/lib/utils";
import { normalizeAvatarUrl, withAvatarCacheBuster } from "@/lib/avatar-url";
import { isAvatarCached } from "@/lib/avatar-preloader";

type AvatarStatus = "idle" | "loading" | "loaded" | "error";

const AvatarStatusContext = React.createContext<AvatarStatus>("idle");

const Avatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>
>(({ className, ...props }, ref) => {
  const [status, setStatus] = React.useState<AvatarStatus>("idle");

  return (
    <AvatarStatusContext.Provider value={status}>
      <AvatarPrimitive.Root
        ref={ref}
        className={cn("relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full", className)}
        {...props}
        data-avatar-status={status}
      />
    </AvatarStatusContext.Provider>
  );
});
Avatar.displayName = AvatarPrimitive.Root.displayName;

// We need a way for AvatarImage to set status on the parent Avatar context.
// Using a separate inner context for the setter.
const AvatarSetStatusContext = React.createContext<React.Dispatch<React.SetStateAction<AvatarStatus>> | null>(null);

// Rewrap Avatar to provide both contexts
const AvatarWrapper = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>
>(({ className, ...props }, ref) => {
  const [status, setStatus] = React.useState<AvatarStatus>("idle");

  return (
    <AvatarSetStatusContext.Provider value={setStatus}>
      <AvatarStatusContext.Provider value={status}>
        <AvatarPrimitive.Root
          ref={ref}
          className={cn("relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full", className)}
          {...props}
        />
      </AvatarStatusContext.Provider>
    </AvatarSetStatusContext.Provider>
  );
});
AvatarWrapper.displayName = "Avatar";

/**
 * Custom AvatarImage that bypasses Radix's internal `new Image()` pre-check.
 * Communicates loading status to parent Avatar via context so AvatarFallback
 * can show a skeleton during loading instead of initials.
 */
const AvatarImage = React.forwardRef<
  HTMLImageElement,
  React.ImgHTMLAttributes<HTMLImageElement> & { onLoadingStatusChange?: (status: string) => void }
>(({ className, src, onError, onLoadingStatusChange, ...props }, ref) => {
  const setParentStatus = React.useContext(AvatarSetStatusContext);

  const [resolvedSrc, setResolvedSrc] = React.useState<string | undefined>(() =>
    normalizeAvatarUrl(typeof src === "string" ? src : undefined)
  );
  const [status, setStatus] = React.useState<AvatarStatus>(
    resolvedSrc ? "loading" : "error"
  );
  const retriesRef = React.useRef(0);

  // Sync status to parent context
  React.useEffect(() => {
    setParentStatus?.(status);
  }, [status, setParentStatus]);

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

  if (status === "error" || !resolvedSrc) {
    return null;
  }

  return (
    <img
      ref={ref}
      src={resolvedSrc}
      onError={handleError}
      onLoad={() => setStatus("loaded")}
      className={cn(
        "absolute inset-0 z-10 h-full w-full object-cover transition-opacity duration-200",
        status === "loaded" ? "opacity-100" : "opacity-0",
        className
      )}
      referrerPolicy="no-referrer"
      draggable={false}
      {...props}
    />
  );
});
AvatarImage.displayName = "AvatarImage";

/**
 * AvatarFallback that is aware of loading status:
 * - During "loading": shows a skeleton pulse (no initials)
 * - During "error" or "idle" with no src: shows children (initials)
 */
const AvatarFallback = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Fallback>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>
>(({ className, children, ...props }, ref) => {
  const status = React.useContext(AvatarStatusContext);
  const isLoading = status === "loading";

  return (
    <AvatarPrimitive.Fallback
      ref={ref}
      delayMs={0}
      className={cn(
        "absolute inset-0 z-0 flex h-full w-full items-center justify-center rounded-full bg-muted",
        isLoading && "animate-pulse",
        className
      )}
      {...props}
    >
      {isLoading ? null : children}
    </AvatarPrimitive.Fallback>
  );
});
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName;

export { AvatarWrapper as Avatar, AvatarImage, AvatarFallback };
