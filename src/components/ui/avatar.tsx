import * as React from "react";
import * as AvatarPrimitive from "@radix-ui/react-avatar";

import { cn } from "@/lib/utils";
import { normalizeAvatarUrl, withAvatarCacheBuster } from "@/lib/avatar-url";

type AvatarImageStatus = "idle" | "loading" | "loaded" | "error";

type AvatarStateContextValue = {
  hasImage: boolean;
  setHasImage: React.Dispatch<React.SetStateAction<boolean>>;
  imageStatus: AvatarImageStatus;
  setImageStatus: React.Dispatch<React.SetStateAction<AvatarImageStatus>>;
};

const AvatarStateContext = React.createContext<AvatarStateContextValue | null>(null);

const Avatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>
>(({ className, ...props }, ref) => {
  const [hasImage, setHasImage] = React.useState(false);
  const [imageStatus, setImageStatus] = React.useState<AvatarImageStatus>("idle");

  const contextValue = React.useMemo(
    () => ({ hasImage, setHasImage, imageStatus, setImageStatus }),
    [hasImage, imageStatus]
  );

  return (
    <AvatarStateContext.Provider value={contextValue}>
      <AvatarPrimitive.Root
        ref={ref}
        className={cn("relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full", className)}
        {...props}
      />
    </AvatarStateContext.Provider>
  );
});
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
  React.ImgHTMLAttributes<HTMLImageElement> & {
    onLoadingStatusChange?: (status: AvatarImageStatus) => void;
  }
>(({ className, src, onError, onLoadingStatusChange, style, ...props }, ref) => {
  const avatarState = React.useContext(AvatarStateContext);
  const [resolvedSrc, setResolvedSrc] = React.useState<string | undefined>(() =>
    normalizeAvatarUrl(typeof src === "string" ? src : undefined)
  );
  const [status, setStatus] = React.useState<AvatarImageStatus>(resolvedSrc ? "loading" : "error");
  const retriesRef = React.useRef(0);

  const updateStatus = React.useCallback(
    (nextStatus: AvatarImageStatus) => {
      setStatus(nextStatus);
      avatarState?.setImageStatus(nextStatus);
      onLoadingStatusChange?.(nextStatus);
    },
    [avatarState, onLoadingStatusChange]
  );

  React.useEffect(() => {
    retriesRef.current = 0;
    const url = normalizeAvatarUrl(typeof src === "string" ? src : undefined);
    setResolvedSrc(url);
    avatarState?.setHasImage(!!url);
    updateStatus(url ? "loading" : "error");
  }, [src, avatarState, updateStatus]);

  const handleError: React.ReactEventHandler<HTMLImageElement> = (event) => {
    if (resolvedSrc && retriesRef.current < 2) {
      retriesRef.current += 1;
      setResolvedSrc(withAvatarCacheBuster(resolvedSrc));
      updateStatus("loading");
      return;
    }
    updateStatus("error");
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
      onLoad={() => updateStatus("loaded")}
      className={cn("aspect-square h-full w-full object-cover", className)}
      referrerPolicy="no-referrer"
      draggable={false}
      style={
        status === "loaded"
          ? style
          : {
              position: "absolute",
              opacity: 0,
              pointerEvents: "none",
              ...style,
            }
      }
      {...props}
    />
  );
});
AvatarImage.displayName = "AvatarImage";

const AvatarFallback = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Fallback>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>
>(({ className, ...props }, ref) => {
  const avatarState = React.useContext(AvatarStateContext);
  const shouldShowFallback = !avatarState?.hasImage || avatarState.imageStatus !== "loaded";

  if (!shouldShowFallback) {
    return null;
  }

  return (
    <AvatarPrimitive.Fallback
      ref={ref}
      className={cn("flex h-full w-full items-center justify-center rounded-full bg-muted", className)}
      {...props}
    />
  );
});
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName;

export { Avatar, AvatarImage, AvatarFallback };
