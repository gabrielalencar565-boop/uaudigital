import { useRef, useState, type KeyboardEvent, type ChangeEvent } from "react";
import { Paperclip, Send, Smile, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { sendChatMessage } from "../chat-api";
import type { ChatMessage } from "../types";

const EMOJIS = ["😀","😂","😍","🥳","👏","🔥","💪","🚀","❤️","🙌","👍","🎉","✅","💡","⚡","🤔","😅","🙏"];

interface Props {
  conversationId: string;
  senderId: string;
  replyTo: ChatMessage | null;
  onClearReply: () => void;
  typingHook?: () => void;
}

export function MessageComposer({ conversationId, senderId, replyTo, onClearReply, typingHook }: Props) {
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const send = async () => {
    if (sending) return;
    const content = text.trim();
    if (!content && files.length === 0) return;
    setSending(true);
    try {
      await sendChatMessage({
        conversationId,
        senderId,
        content,
        replyToId: replyTo?.id ?? null,
        files,
      });
      setText("");
      setFiles([]);
      onClearReply();
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao enviar mensagem");
    } finally {
      setSending(false);
    }
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    const list = Array.from(e.target.files ?? []);
    const max = 50 * 1024 * 1024;
    const valid = list.filter((f) => {
      if (f.size > max) {
        toast.error(`${f.name} excede 50MB`);
        return false;
      }
      return true;
    });
    setFiles((prev) => [...prev, ...valid]);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="border-t border-border/40 bg-background p-3 space-y-2">
      {replyTo && (
        <div className="flex items-start gap-2 rounded-md border-l-2 border-primary bg-muted/50 px-2 py-1.5 text-xs">
          <div className="flex-1 min-w-0">
            <div className="font-semibold">Respondendo</div>
            <div className="truncate text-muted-foreground">{replyTo.content ?? "(anexo)"}</div>
          </div>
          <Button size="icon" variant="ghost" className="h-5 w-5" onClick={onClearReply}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}
      {files.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {files.map((f, i) => (
            <div key={i} className="flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-xs">
              <span className="max-w-[120px] truncate">{f.name}</span>
              <button onClick={() => setFiles((p) => p.filter((_, idx) => idx !== i))}>
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-end gap-1.5">
        <input ref={fileRef} type="file" multiple className="hidden" onChange={onFile} />
        <Button size="icon" variant="ghost" className="h-9 w-9" onClick={() => fileRef.current?.click()}>
          <Paperclip className="h-4 w-4" />
        </Button>
        <Popover>
          <PopoverTrigger asChild>
            <Button size="icon" variant="ghost" className="h-9 w-9">
              <Smile className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-2" align="start">
            <div className="grid grid-cols-6 gap-1">
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  className="text-xl rounded hover:bg-muted p-1"
                  onClick={() => setText((t) => t + e)}
                >
                  {e}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
        <Textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            typingHook?.();
          }}
          onKeyDown={onKey}
          placeholder="Digite uma mensagem..."
          rows={1}
          className="min-h-[40px] max-h-32 resize-none flex-1"
        />
        <Button size="icon" className="h-9 w-9" onClick={send} disabled={sending}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
