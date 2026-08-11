import { useState } from "react";
import { CheckCircle2, ChevronDown, ChevronUp, Loader2, X, FileVideo } from "lucide-react";
import { useGlobalUploads, removeGlobalUpload } from "@/lib/upload-tray-store";

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function GlobalUploadTray() {
  const items = useGlobalUploads();
  const [collapsed, setCollapsed] = useState(false);

  if (items.length === 0) return null;

  const uploadingCount = items.filter((i) => i.status === "uploading").length;
  const headerLabel = uploadingCount > 0
    ? `Enviando ${uploadingCount} ${uploadingCount === 1 ? "arquivo" : "arquivos"}`
    : `${items.length} ${items.length === 1 ? "envio concluído" : "envios concluídos"}`;

  return (
    <div className="fixed bottom-4 right-4 z-[100] w-80 overflow-hidden rounded-xl border border-border/40 bg-card shadow-2xl">
      <div className="flex items-center justify-between border-b border-border/40 bg-muted/40 px-3 py-2">
        <span className="text-xs font-semibold">{headerLabel}</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="rounded p-1 text-muted-foreground transition hover:bg-accent hover:text-foreground"
            aria-label={collapsed ? "Expandir" : "Recolher"}
          >
            {collapsed ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
          {uploadingCount === 0 && (
            <button
              type="button"
              onClick={() => items.forEach((i) => removeGlobalUpload(i.id))}
              className="rounded p-1 text-muted-foreground transition hover:bg-accent hover:text-foreground"
              aria-label="Fechar"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {!collapsed && (
        <div className="max-h-64 space-y-0.5 overflow-y-auto p-1.5">
          {items.map((item) => (
            <div key={item.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-accent/50">
              <FileVideo className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium">{item.fileName}</p>
                {item.status === "uploading" && (
                  <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${item.progress}%` }}
                    />
                  </div>
                )}
                {item.status === "error" && (
                  <p className="truncate text-[10px] text-destructive">{item.errorMessage ?? "Erro ao enviar"}</p>
                )}
                {item.status !== "uploading" && item.status !== "error" && (
                  <p className="text-[10px] text-muted-foreground">{formatFileSize(item.fileSize)}</p>
                )}
              </div>
              <div className="shrink-0">
                {item.status === "uploading" && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                {item.status === "success" && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                {item.status === "error" && (
                  <button
                    type="button"
                    onClick={() => removeGlobalUpload(item.id)}
                    className="rounded p-0.5 text-muted-foreground transition hover:bg-accent hover:text-foreground"
                    aria-label="Descartar"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
