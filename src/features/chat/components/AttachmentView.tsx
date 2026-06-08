import { useEffect, useState } from "react";
import { File as FileIcon, Download } from "lucide-react";
import { getSignedAttachmentUrl } from "../chat-api";
import type { ChatAttachmentRow } from "../types";

export function AttachmentView({ att }: { att: ChatAttachmentRow }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    getSignedAttachmentUrl(att.storage_path).then((u) => {
      if (active) setUrl(u);
    });
    return () => {
      active = false;
    };
  }, [att.storage_path]);

  const mime = att.mime_type ?? "";
  if (!url) {
    return <div className="text-xs text-muted-foreground italic">Carregando anexo…</div>;
  }
  if (mime.startsWith("image/")) {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="block">
        <img src={url} alt={att.file_name} className="max-h-64 max-w-xs rounded-lg border border-border" />
      </a>
    );
  }
  if (mime.startsWith("video/")) {
    return <video src={url} controls className="max-h-64 max-w-xs rounded-lg" />;
  }
  if (mime.startsWith("audio/")) {
    return <audio src={url} controls className="w-full max-w-xs" />;
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs hover:bg-muted"
    >
      <FileIcon className="h-4 w-4 shrink-0" />
      <span className="truncate max-w-[200px]">{att.file_name}</span>
      <Download className="h-3.5 w-3.5 ml-auto opacity-60" />
    </a>
  );
}
