import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCreateFaqItem, useDeleteFaqItem, useFaqItems, type FaqItem } from "@/features/ajuda/hooks/use-help-data";

export function FaqSection({ isDeveloper }: { isDeveloper: boolean }) {
  const faqQ = useFaqItems();
  const createFaq = useCreateFaqItem();
  const deleteFaq = useDeleteFaqItem();
  const items = faqQ.data ?? [];

  const [formOpen, setFormOpen] = useState(false);
  const [category, setCategory] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [saving, setSaving] = useState(false);

  const groups = useMemo(() => {
    const map = new Map<string, FaqItem[]>();
    items.forEach((item) => {
      const list = map.get(item.category) ?? [];
      list.push(item);
      map.set(item.category, list);
    });
    return Array.from(map.entries());
  }, [items]);

  const handleCreate = async () => {
    if (!category.trim() || !question.trim() || !answer.trim()) {
      toast.error("Preencha categoria, pergunta e resposta");
      return;
    }
    setSaving(true);
    try {
      await createFaq.mutateAsync({ category: category.trim(), question: question.trim(), answer: answer.trim(), order_index: items.length });
      toast.success("Pergunta adicionada!");
      setCategory("");
      setQuestion("");
      setAnswer("");
      setFormOpen(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao adicionar pergunta");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {isDeveloper && (
        <div className="flex justify-end">
          <Button size="sm" className="gap-1.5" onClick={() => setFormOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> Nova pergunta
          </Button>
        </div>
      )}

      {groups.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/50 p-10 text-center text-sm text-muted-foreground">
          Nenhuma pergunta frequente cadastrada ainda.
        </div>
      ) : (
        groups.map(([groupName, groupItems]) => (
          <div key={groupName} className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{groupName}</h3>
            <Accordion type="single" collapsible className="space-y-2">
              {groupItems.map((item) => (
                <AccordionItem key={item.id} value={item.id} className="rounded-xl border border-border/60 bg-card px-4">
                  <div className="flex items-center gap-3">
                    <AccordionTrigger className="flex-1 gap-3 text-left text-sm font-medium">{item.question}</AccordionTrigger>
                    {isDeveloper && (
                      <button
                        type="button"
                        onClick={() => deleteFaq.mutate(item.id)}
                        className="shrink-0 text-muted-foreground transition hover:text-destructive"
                        aria-label="Remover pergunta"
                        title="Remover"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <AccordionContent className="whitespace-pre-line text-sm text-muted-foreground">{item.answer}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        ))
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nova pergunta frequente</DialogTitle>
            <DialogDescription>Aparece pra todo mundo na Central de Ajuda, agrupada pela categoria.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Categoria</Label>
              <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Ex: Conta e notificações" />
            </div>
            <div className="space-y-1.5">
              <Label>Pergunta</Label>
              <Input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Ex: Como convido alguém da equipe?" />
            </div>
            <div className="space-y-1.5">
              <Label>Resposta</Label>
              <Textarea value={answer} onChange={(e) => setAnswer(e.target.value)} className="min-h-[100px]" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={saving}>{saving ? "Salvando..." : "Adicionar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
