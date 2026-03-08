import { cn } from "@/lib/utils";
import { useAppSettings } from "@/features/data/queries";

export function WorkspaceDropdown() {
  const appSettingsQ = useAppSettings();
  const logoUrl = appSettingsQ.data?.logo_url;
  const logoShape = appSettingsQ.data?.logo_shape ?? "square";

  return (
    <div className="flex items-center">
      {logoUrl ? (
        <img
          src={logoUrl}
          alt="Logo"
          className={cn(
            "h-8 w-auto max-w-[120px] object-contain",
            logoShape === "circle" ? "rounded-full" : "rounded-xl"
          )}
        />
      ) : (
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10">
          <span className="text-sm font-bold text-primary">U</span>
        </div>
      )}
    </div>
  );
}
