import { cn } from "@/lib/utils";
import { useAppSettings } from "@/features/data/queries";

export function WorkspaceDropdown() {
  const appSettingsQ = useAppSettings();
  const logoUrl = appSettingsQ.data?.logo_url;
  const logoShape = appSettingsQ.data?.logo_shape ?? "square";
  const workspaceName = appSettingsQ.data?.workspace_name ?? "";

  return (
    <div className="flex items-center gap-2">
      {logoUrl ? (
        <img
          src={logoUrl}
          alt="Logo"
          className="h-8 w-auto max-w-[40px] object-contain"
        />
      ) : (
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10">
          <span className="text-sm font-bold text-primary">U</span>
        </div>
      )}
      {workspaceName && (
        <span className="text-base font-bold tracking-tight text-foreground max-w-[160px] truncate">
          {workspaceName}
        </span>
      )}
    </div>
  );
}
