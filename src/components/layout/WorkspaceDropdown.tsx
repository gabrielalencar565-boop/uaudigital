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
          className="h-10 w-auto max-w-[56px] object-contain"
        />
      ) : (
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
          <span className="text-base font-bold text-primary">U</span>
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
