import { useTheme } from "next-themes";
import { AlertTriangle, CheckCircle2, Info, Loader2, XCircle } from "lucide-react";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

// Minimal toasts on the card surface: hairline border, soft shadow and a single tinted icon per type.
const iconClass = "h-[18px] w-[18px]";

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: <CheckCircle2 className={iconClass} />,
        error: <XCircle className={iconClass} />,
        warning: <AlertTriangle className={iconClass} />,
        info: <Info className={iconClass} />,
        loading: <Loader2 className={`${iconClass} animate-spin`} />,
      }}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "flex w-[340px] max-w-[calc(100vw-2rem)] items-center gap-3 rounded-2xl border border-border/60 bg-card px-4 py-3 text-foreground shadow-xl shadow-black/15",
          icon: "flex shrink-0 items-center justify-center",
          content: "min-w-0 flex-1",
          title: "text-[13px] font-medium leading-snug",
          description: "mt-0.5 text-xs font-normal leading-snug text-muted-foreground",
          actionButton: "ml-auto shrink-0 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground transition hover:opacity-90",
          cancelButton: "shrink-0 rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground transition hover:text-foreground",
          closeButton: "rounded-full border border-border/60 bg-card text-muted-foreground",
          info: "[&_[data-icon]]:text-primary",
          success: "[&_[data-icon]]:text-[hsl(var(--success))]",
          warning: "[&_[data-icon]]:text-[hsl(var(--warning))]",
          error: "[&_[data-icon]]:text-destructive",
          loading: "[&_[data-icon]]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
