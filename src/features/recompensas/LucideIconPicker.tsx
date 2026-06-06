import { useState, useMemo } from "react";
import { icons, HelpCircle, type LucideIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

// Curated set of Lucide icons (estilo iOS/SF Symbols — traços finos e arredondados).
export const REWARD_ICON_NAMES: string[] = [
  // Recompensas & conquistas
  "Gift", "Trophy", "Award", "Crown", "Medal", "Star", "Sparkles", "Gem", "Diamond",
  "PartyPopper", "Cake", "Confetti", "Ribbon",
  // Reações
  "Heart", "HeartHandshake", "ThumbsUp", "ThumbsDown", "Smile", "Laugh", "Frown",
  // Comidas & bebidas
  "Coffee", "Pizza", "Beer", "Wine", "IceCream", "Cookie", "Apple", "Utensils",
  // Energia & destaque
  "Rocket", "Flame", "Zap", "Target", "Flag", "Bell", "BellRing", "Bookmark",
  // Dinheiro & loja
  "Coins", "DollarSign", "Banknote", "CreditCard", "Wallet", "PiggyBank",
  "ShoppingBag", "ShoppingCart", "Tag", "Tags", "Ticket", "Receipt",
  // Viagem & lugares
  "Plane", "Car", "Bike", "Bus", "Train", "Ship",
  "Map", "MapPin", "Compass", "Globe", "Mountain", "TreePalm",
  // Estudo & criatividade
  "BookOpen", "Book", "GraduationCap", "Brain", "Lightbulb",
  "PenTool", "Pencil", "Palette", "Paintbrush", "Scissors", "Ruler",
  // Mídia
  "Camera", "Video", "Image", "Music", "Music2", "Headphones", "Mic", "Film", "Radio", "Tv",
  // Tempo
  "Calendar", "CalendarCheck", "CalendarHeart", "Clock", "Hourglass", "Timer", "AlarmClock",
  // Pessoas & trabalho
  "Users", "User", "UserCheck", "UsersRound", "Handshake", "MessageCircle", "MessageSquare", "Mail",
  "Briefcase", "Building2", "Home", "Store",
  // Dispositivos
  "Laptop", "Monitor", "Smartphone", "Tablet", "Watch", "Keyboard", "Mouse",
  // Sucesso & segurança
  "CheckCircle2", "CheckCheck", "Check", "BadgeCheck", "ShieldCheck", "Shield", "Lock", "KeyRound",
  // Atenção & penalidades
  "AlertTriangle", "AlertCircle", "XCircle", "X", "Ban", "Skull", "Bug", "TriangleAlert",
  // Métricas
  "TrendingUp", "TrendingDown", "BarChart3", "BarChart4", "PieChart", "Activity", "LineChart", "Gauge",
  // Organização
  "FolderCheck", "Folder", "FileText", "FileCheck2", "Clipboard", "ClipboardCheck", "ListChecks", "ListTodo", "CheckSquare",
  // Natureza & clima
  "Sun", "Moon", "CloudSun", "Cloud", "Umbrella", "Rainbow", "Snowflake",
  "Trees", "Leaf", "Flower2", "Sprout",
  // Esporte & saúde
  "Dumbbell", "Bike as BikeIcon".replace(" as BikeIcon", ""), "HeartPulse", "Footprints", "Trophy as TrophyIcon".replace(" as TrophyIcon", ""),
  // Estrelas / favoritos
  "Pin", "PinOff", "Eye", "EyeOff", "Search",
];

// De-duplicate and keep only icons that actually exist in lucide-react
const UNIQUE_ICON_NAMES = Array.from(new Set(REWARD_ICON_NAMES)).filter(
  (n) => (icons as Record<string, LucideIcon>)[n] !== undefined,
);

export function getLucideIcon(name?: string | null): LucideIcon {
  if (!name) return HelpCircle;
  const Comp = (icons as Record<string, LucideIcon>)[name];
  return Comp ?? HelpCircle;
}

export function DynamicLucideIcon({
  name,
  className,
  fallback,
  strokeWidth = 1.6,
}: {
  name?: string | null;
  className?: string;
  fallback?: LucideIcon;
  strokeWidth?: number;
}) {
  const Comp = name ? (icons as Record<string, LucideIcon>)[name] ?? fallback ?? HelpCircle : fallback ?? HelpCircle;
  return <Comp className={className} strokeWidth={strokeWidth} absoluteStrokeWidth />;
}

interface LucideIconPickerProps {
  value?: string | null;
  onChange: (name: string) => void;
  placeholder?: string;
}

export function LucideIconPicker({ value, onChange, placeholder = "Escolher ícone" }: LucideIconPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const Selected = getLucideIcon(value);

  const filtered = useMemo(() => {
    if (!search.trim()) return UNIQUE_ICON_NAMES;
    const q = search.toLowerCase().trim();
    return UNIQUE_ICON_NAMES.filter((n) => n.toLowerCase().includes(q));
  }, [search]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="h-10 px-3 rounded-md border border-input bg-background flex items-center gap-2 hover:bg-muted/50 transition-colors w-full"
        >
          <Selected className="h-4 w-4 text-primary" strokeWidth={1.6} absoluteStrokeWidth />
          <span className="text-sm text-muted-foreground truncate">
            {value || placeholder}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <div className="p-3 border-b border-border">
          <Input
            placeholder="Buscar ícone... ex: Trophy, Gift"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 text-sm"
            autoFocus
          />
        </div>
        <ScrollArea className="h-[240px]">
          <div className="grid grid-cols-6 gap-1 p-2">
            {filtered.map((name) => {
              const IconComp = getLucideIcon(name);
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => {
                    onChange(name);
                    setOpen(false);
                    setSearch("");
                  }}
                  className={cn(
                    "h-9 w-9 rounded-lg flex items-center justify-center border transition-all",
                    value === name
                      ? "ring-2 ring-offset-1 ring-primary border-primary bg-primary/10"
                      : "border-transparent hover:bg-muted/60"
                  )}
                  title={name}
                >
                  <IconComp className="h-4 w-4" strokeWidth={1.6} absoluteStrokeWidth />
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
