import { useTheme } from "next-themes";
import { useAppSettings } from "@/features/data/queries";

export function WorkspaceDropdown() {
  const { resolvedTheme } = useTheme();
  const appSettingsQ = useAppSettings();
  const lightLogo = appSettingsQ.data?.sidebar_logo_url;
  const darkLogo = appSettingsQ.data?.sidebar_logo_dark_url;
  const workspaceName = appSettingsQ.data?.workspace_name ?? "";

  const logoUrl = resolvedTheme === "dark" ? (darkLogo ?? lightLogo) : lightLogo;

  return (
    <div className="flex items-center gap-3">
      {logoUrl ? (
        <img
          src={logoUrl}
          alt="Logo"
          className="h-10 w-auto max-w-[200px] object-contain"
        />
      ) : (
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
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
