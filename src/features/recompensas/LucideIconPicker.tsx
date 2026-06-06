import { useState, useMemo } from "react";
import { icons, HelpCircle, type LucideIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

// Curated set of Lucide icons useful for rewards/levels/criteria.
// Stored as PascalCase names (lucide-react's `icons` map keys).
export const REWARD_ICON_NAMES: string[] = [
  "Gift", "Trophy", "Award", "Crown", "Medal", "Star", "Sparkles", "Gem",
  "Heart", "ThumbsUp", "PartyPopper", "Cake", "Coffee", "Pizza", "Ticket",
  "Rocket", "Flame", "Zap", "Target", "Flag", "Bell", "BellRing",
  "Coins", "DollarSign", "Banknote", "CreditCard", "ShoppingBag", "ShoppingCart",
  "Plane", "Car", "Bike", "Map", "MapPin", "Compass", "Globe",
  "BookOpen", "GraduationCap", "Brain", "Lightbulb", "PenTool", "Palette",
  "Camera", "Video", "Music", "Headphones", "Mic", "Film",
  "Calendar", "CalendarCheck", "CalendarHeart", "Clock", "Hourglass",
  "Users", "User", "UserCheck", "UsersRound", "HeartHandshake", "Handshake",
  "Briefcase", "Building2", "Home", "Laptop", "Monitor", "Smartphone",
  "CheckCircle2", "CheckCheck", "Check", "ShieldCheck", "Shield", "Lock",
  "AlertTriangle", "AlertCircle", "XCircle", "Ban", "Skull",
  "TrendingUp", "BarChart3", "PieChart", "Activity", "LineChart",
  "FolderCheck", "Folder", "FileText", "Clipboard", "ListChecks",
  "Smile", "Laugh", "Sun", "Moon", "CloudSun", "Umbrella",
  "Dumbbell", "Trees", "Leaf", "Flower2", "Crown as CrownIcon".replace(" as CrownIcon", ""),
];

// De-duplicate
const UNIQUE_ICON_NAMES = Array.from(new Set(REWARD_ICON_NAMES));

export function getLucideIcon(name?: string | null): LucideIcon {
  if (!name) return HelpCircle;
  const Comp = (icons as Record<string, LucideIcon>)[name];
  return Comp ?? HelpCircle;
}

export function DynamicLucideIcon({
  name,
  className,
  fallback,
}: {
  name?: string | null;
  className?: string;
  fallback?: LucideIcon;
}) {
  const Comp = name ? (icons as Record<string, LucideIcon>)[name] ?? fallback ?? HelpCircle : fallback ?? HelpCircle;
  return <Comp className={className} />;
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
          <Selected className="h-4 w-4 text-primary" />
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
