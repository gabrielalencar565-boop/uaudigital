import { useState, useMemo } from "react";
import {
  Calendar, Star, Users, Coffee, Presentation, Repeat, Cake,
  Heart, Trophy, Target, Flag, Bell, Clock, Gift, Music, 
  Megaphone, BookOpen, Lightbulb, Rocket, Sparkles,
  PartyPopper, Handshake, GraduationCap, Brain, Mic,
  Camera, Video, Monitor, Palette, PenTool, 
  MessageCircle, Mail, Phone, Globe, Map,
  Building2, Briefcase, Award, Crown, Gem, 
  Flame, Zap, Sun, Moon, CloudSun,
  Smile, ThumbsUp, HeartHandshake, UserCheck, UsersRound,
  CalendarDays, CalendarCheck, CalendarHeart, Clipboard,
  FileText, BarChart3, PieChart, TrendingUp,
  ShieldCheck, Lock, Key, Settings,
  type LucideIcon,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type IconOption = {
  id: string;
  icon: LucideIcon;
  label: string;
  tags: string[];
};

export const ALL_ICON_OPTIONS: IconOption[] = [
  { id: "calendar", icon: Calendar, label: "Calendário", tags: ["data", "agenda", "evento", "calendar"] },
  { id: "calendar-days", icon: CalendarDays, label: "Dias", tags: ["data", "agenda", "dias", "calendar"] },
  { id: "calendar-check", icon: CalendarCheck, label: "Confirmado", tags: ["data", "check", "confirmado", "calendar"] },
  { id: "calendar-heart", icon: CalendarHeart, label: "Favorito", tags: ["data", "favorito", "coração", "calendar"] },
  { id: "star", icon: Star, label: "Estrela", tags: ["destaque", "favorito", "star", "estrela"] },
  { id: "users", icon: Users, label: "Reunião", tags: ["equipe", "time", "reunião", "meeting", "grupo", "pessoas"] },
  { id: "users-round", icon: UsersRound, label: "Grupo", tags: ["equipe", "time", "grupo", "pessoas"] },
  { id: "coffee", icon: Coffee, label: "Café", tags: ["pausa", "café", "coffee", "break", "descanso"] },
  { id: "presentation", icon: Presentation, label: "Apresentação", tags: ["slide", "apresentação", "palestra", "presentation"] },
  { id: "repeat", icon: Repeat, label: "Recorrente", tags: ["repetir", "recorrente", "loop", "mensal"] },
  { id: "cake", icon: Cake, label: "Comemoração", tags: ["aniversário", "bolo", "festa", "birthday", "comemoração"] },
  { id: "heart", icon: Heart, label: "Coração", tags: ["amor", "saúde", "coração", "heart", "bem-estar"] },
  { id: "trophy", icon: Trophy, label: "Troféu", tags: ["prêmio", "conquista", "troféu", "vitória", "trophy"] },
  { id: "target", icon: Target, label: "Meta", tags: ["meta", "objetivo", "alvo", "target", "goal"] },
  { id: "flag", icon: Flag, label: "Bandeira", tags: ["marco", "milestone", "bandeira", "flag"] },
  { id: "bell", icon: Bell, label: "Sino", tags: ["notificação", "lembrete", "alerta", "sino", "bell"] },
  { id: "clock", icon: Clock, label: "Relógio", tags: ["horário", "tempo", "prazo", "clock", "time"] },
  { id: "gift", icon: Gift, label: "Presente", tags: ["presente", "gift", "surpresa", "brinde"] },
  { id: "music", icon: Music, label: "Música", tags: ["música", "som", "music", "áudio"] },
  { id: "megaphone", icon: Megaphone, label: "Megafone", tags: ["anúncio", "comunicado", "megafone", "megaphone"] },
  { id: "book-open", icon: BookOpen, label: "Livro", tags: ["estudo", "livro", "leitura", "book", "aprendizado"] },
  { id: "lightbulb", icon: Lightbulb, label: "Ideia", tags: ["ideia", "criatividade", "inspiração", "lightbulb", "inovação"] },
  { id: "rocket", icon: Rocket, label: "Foguete", tags: ["lançamento", "início", "rocket", "foguete", "startup"] },
  { id: "sparkles", icon: Sparkles, label: "Brilho", tags: ["novidade", "brilho", "sparkles", "especial", "magia"] },
  { id: "party-popper", icon: PartyPopper, label: "Festa", tags: ["festa", "comemoração", "party", "celebração"] },
  { id: "handshake", icon: Handshake, label: "Aperto de mão", tags: ["parceria", "acordo", "handshake", "negócio", "contrato"] },
  { id: "graduation-cap", icon: GraduationCap, label: "Formatura", tags: ["formatura", "educação", "graduação", "estudo", "treinamento"] },
  { id: "brain", icon: Brain, label: "Cérebro", tags: ["brainstorm", "pensar", "estratégia", "brain", "mente"] },
  { id: "mic", icon: Mic, label: "Microfone", tags: ["podcast", "fala", "microfone", "gravação", "entrevista"] },
  { id: "camera", icon: Camera, label: "Câmera", tags: ["foto", "câmera", "imagem", "fotografia"] },
  { id: "video", icon: Video, label: "Vídeo", tags: ["vídeo", "gravação", "video", "filmagem"] },
  { id: "monitor", icon: Monitor, label: "Monitor", tags: ["computador", "tela", "monitor", "tecnologia", "webinar"] },
  { id: "palette", icon: Palette, label: "Paleta", tags: ["design", "arte", "cor", "paleta", "criativo"] },
  { id: "pen-tool", icon: PenTool, label: "Caneta", tags: ["design", "criar", "editar", "caneta", "ilustração"] },
  { id: "message-circle", icon: MessageCircle, label: "Chat", tags: ["mensagem", "chat", "conversa", "comunicação"] },
  { id: "mail", icon: Mail, label: "Email", tags: ["email", "correio", "carta", "mail"] },
  { id: "phone", icon: Phone, label: "Telefone", tags: ["ligação", "telefone", "chamada", "phone"] },
  { id: "globe", icon: Globe, label: "Globo", tags: ["global", "mundo", "internet", "web", "globo"] },
  { id: "map", icon: Map, label: "Mapa", tags: ["localização", "mapa", "viagem", "map"] },
  { id: "building-2", icon: Building2, label: "Empresa", tags: ["empresa", "escritório", "prédio", "building", "corporativo"] },
  { id: "briefcase", icon: Briefcase, label: "Maleta", tags: ["trabalho", "negócio", "maleta", "briefcase", "profissional"] },
  { id: "award", icon: Award, label: "Prêmio", tags: ["prêmio", "medalha", "reconhecimento", "award"] },
  { id: "crown", icon: Crown, label: "Coroa", tags: ["rei", "rainha", "líder", "crown", "VIP"] },
  { id: "gem", icon: Gem, label: "Diamante", tags: ["precioso", "diamante", "gem", "valor", "premium"] },
  { id: "flame", icon: Flame, label: "Chama", tags: ["urgente", "quente", "fogo", "flame", "energia"] },
  { id: "zap", icon: Zap, label: "Raio", tags: ["rápido", "energia", "raio", "zap", "elétrico"] },
  { id: "sun", icon: Sun, label: "Sol", tags: ["dia", "sol", "manhã", "sun", "verão"] },
  { id: "moon", icon: Moon, label: "Lua", tags: ["noite", "lua", "moon", "noturno"] },
  { id: "cloud-sun", icon: CloudSun, label: "Clima", tags: ["tempo", "clima", "nuvem", "weather"] },
  { id: "smile", icon: Smile, label: "Sorriso", tags: ["feliz", "sorriso", "smile", "alegria", "humor"] },
  { id: "thumbs-up", icon: ThumbsUp, label: "Joinha", tags: ["aprovado", "legal", "joinha", "curtir", "like"] },
  { id: "heart-handshake", icon: HeartHandshake, label: "Cuidado", tags: ["cuidado", "empatia", "voluntário", "social"] },
  { id: "user-check", icon: UserCheck, label: "1:1", tags: ["one on one", "individual", "pessoa", "feedback", "1:1"] },
  { id: "clipboard", icon: Clipboard, label: "Checklist", tags: ["lista", "checklist", "tarefas", "clipboard"] },
  { id: "file-text", icon: FileText, label: "Documento", tags: ["documento", "arquivo", "relatório", "file", "report"] },
  { id: "bar-chart-3", icon: BarChart3, label: "Gráfico", tags: ["dados", "métricas", "gráfico", "chart", "analytics"] },
  { id: "pie-chart", icon: PieChart, label: "Pizza", tags: ["dados", "estatística", "gráfico pizza", "pie"] },
  { id: "trending-up", icon: TrendingUp, label: "Crescimento", tags: ["crescimento", "alta", "tendência", "trending"] },
  { id: "shield-check", icon: ShieldCheck, label: "Segurança", tags: ["segurança", "proteção", "shield", "verificado"] },
  { id: "lock", icon: Lock, label: "Cadeado", tags: ["privado", "seguro", "cadeado", "lock"] },
  { id: "key", icon: Key, label: "Chave", tags: ["acesso", "chave", "key", "permissão"] },
  { id: "settings", icon: Settings, label: "Config", tags: ["configuração", "ajustes", "settings", "engrenagem"] },
];

export function getIconById(iconId: string): LucideIcon {
  return ALL_ICON_OPTIONS.find((o) => o.id === iconId)?.icon ?? Calendar;
}

interface IconPickerProps {
  value: string;
  onChange: (iconId: string) => void;
  color?: string;
}

export function IconPicker({ value, onChange, color = "currentColor" }: IconPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const SelectedIcon = getIconById(value);

  const filtered = useMemo(() => {
    if (!search.trim()) return ALL_ICON_OPTIONS;
    const q = search.toLowerCase().trim();
    return ALL_ICON_OPTIONS.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        o.id.includes(q) ||
        o.tags.some((t) => t.includes(q))
    );
  }, [search]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "h-10 px-3 rounded-xl border border-border flex items-center gap-2 hover:bg-muted/50 transition-colors"
          )}
        >
          <SelectedIcon className="h-4 w-4" style={{ color }} />
          <span className="text-sm text-muted-foreground">
            {ALL_ICON_OPTIONS.find((o) => o.id === value)?.label ?? "Ícone"}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <div className="p-3 border-b border-border">
          <Input
            placeholder="Buscar ícone... ex: reunião, café"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 text-sm"
            autoFocus
          />
        </div>
        <ScrollArea className="h-[240px]">
          <div className="grid grid-cols-6 gap-1 p-2">
            {filtered.map((opt) => {
              const IconComp = opt.icon;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    onChange(opt.id);
                    setOpen(false);
                    setSearch("");
                  }}
                  className={cn(
                    "h-9 w-9 rounded-lg flex items-center justify-center border transition-all",
                    value === opt.id
                      ? "ring-2 ring-offset-1 ring-primary border-primary bg-primary/10"
                      : "border-transparent hover:bg-muted/60"
                  )}
                  title={opt.label}
                >
                  <IconComp className="h-4 w-4" />
                </button>
              );
            })}
            {filtered.length === 0 && (
              <p className="col-span-6 text-xs text-muted-foreground text-center py-4">
                Nenhum ícone encontrado
              </p>
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
