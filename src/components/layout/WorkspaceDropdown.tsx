import { useAppSettings } from "@/features/data/queries";

export function WorkspaceDropdown() {
  const appSettingsQ = useAppSettings();
  const sidebarLogoUrl = appSettingsQ.data?.sidebar_logo_url;
  const workspaceName = appSettingsQ.data?.workspace_name ?? "";

  return (
    <div className="flex items-center gap-3">
      {sidebarLogoUrl ? (
        <img
          src={sidebarLogoUrl}
          alt="Logo"
          className="h-14 w-auto max-w-[72px] object-contain"
        />
      ) : (
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
          <span className="text-lg font-bold text-primary">U</span>
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
