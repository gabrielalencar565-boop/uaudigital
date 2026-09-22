import { useEffect, useRef, useState } from "react";
import { CircleHelp, MousePointerClick, Paperclip, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useSession } from "@/hooks/use-session";
import { supabase } from "@/integrations/supabase/client";
import { ElementPicker, type PickedElementInfo } from "@/features/configuracoes/ElementPicker";

const sb = supabase as any;
const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;

function elementSummary(el: PickedElementInfo) {
  const cls = el.classes[0] ? `.${el.classes[0]}` : "";
  const idPart = el.id ? `#${el.id}` : "";
  return `<${el.tag}${idPart}${cls}>${el.text ? ` ${el.text.slice(0, 40)}` : ""}`;
}

export function ReportProblemDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { user } = useSession();
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [pickerActive, setPickerActive] = useState(false);
  const [selectedElement, setSelectedElement] = useState<PickedElementInfo | null>(null);
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [attachmentPreview, setAttachmentPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!attachmentFile) {
      setAttachmentPreview(null);
      return;
    }
    const url = URL.createObjectURL(attachmentFile);
    setAttachmentPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [attachmentFile]);

  const resetState = () => {
    setDescription("");
    setSelectedElement(null);
    setAttachmentFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleClose = (next: boolean) => {
    if (!next) resetState();
    onOpenChange(next);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Anexe uma imagem (print da tela, por exemplo)");
      return;
    }
    if (file.size > MAX_ATTACHMENT_BYTES) {
      toast.error("Imagem muito grande — o limite é 8MB");
      return;
    }
    setAttachmentFile(file);
  };

  const handleSubmit = async () => {
    if (!user?.id) return;
    const trimmed = description.trim();
    if (!trimmed) {
      toast.error("Descreva o problema antes de enviar");
      return;
    }
    setSubmitting(true);
    try {
      let attachmentUrl: string | null = null;
      if (attachmentFile) {
        const ext = attachmentFile.name.split(".").pop() ?? "png";
        const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
        const { error: uploadErr } = await sb.storage
          .from("problem-report-attachments")
          .upload(path, attachmentFile, { contentType: attachmentFile.type });
        if (uploadErr) throw uploadErr;
        const { data: urlData } = sb.storage.from("problem-report-attachments").getPublicUrl(path);
        attachmentUrl = urlData.publicUrl;
      }

      const { error } = await sb.from("problem_reports").insert({
        user_id: user.id,
        description: trimmed,
        page_context: window.location.href,
        attachment_url: attachmentUrl,
        element_info: selectedElement,
      });
      if (error) throw error;
      toast.success("Problema relatado! A equipe vai dar uma olhada.");
      handleClose(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao enviar relato");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Dialog open={open && !pickerActive} onOpenChange={handleClose}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CircleHelp className="h-5 w-5" />
              Relatar um problema
            </DialogTitle>
            <DialogDescription>
              Encontrou algo estranho ou quebrado? Descreva aqui — sua mensagem chega direto pra equipe.
            </DialogDescription>
          </DialogHeader>

          <Textarea
            autoFocus
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="O que aconteceu? Em qual tela?"
            className="min-h-[120px]"
          />

          {selectedElement && (
            <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-2">
              <MousePointerClick className="h-4 w-4 shrink-0 text-primary" />
              <code className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{elementSummary(selectedElement)}</code>
              <button
                type="button"
                onClick={() => setSelectedElement(null)}
                className="shrink-0 text-muted-foreground transition hover:text-foreground"
                aria-label="Remover elemento selecionado"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {attachmentPreview && (
            <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-2">
              <img src={attachmentPreview} alt="Anexo" className="h-10 w-10 shrink-0 rounded object-cover" />
              <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{attachmentFile?.name}</span>
              <button
                type="button"
                onClick={() => setAttachmentFile(null)}
                className="shrink-0 text-muted-foreground transition hover:text-foreground"
                aria-label="Remover anexo"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
            <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => fileInputRef.current?.click()}>
              <Paperclip className="h-3.5 w-3.5" />
              {attachmentFile ? "Trocar anexo" : "Anexar imagem"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setPickerActive(true)}
            >
              <MousePointerClick className="h-3.5 w-3.5" />
              {selectedElement ? "Selecionar outro elemento" : "Selecionar elemento na tela"}
            </Button>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => handleClose(false)} disabled={submitting}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Enviando..." : "Enviar relato"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ElementPicker
        active={pickerActive}
        onSelect={(info) => {
          setSelectedElement(info);
          setPickerActive(false);
        }}
        onCancel={() => setPickerActive(false)}
      />
    </>
  );
}
