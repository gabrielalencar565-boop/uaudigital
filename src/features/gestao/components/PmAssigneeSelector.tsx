import { useState } from "react";
import { Search, Check } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

function initials(n: string) {
  return n.split(" ").filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase() ?? "").join("");
}

interface Props {
  selectedIds: string[];
  membersMap: Record<string, { name: string; avatar?: string }>;
  members: { id: string; name: string }[];
  onToggle: (memberId: string) => void;
  children?: React.ReactNode;
}

export function PmAssigneeSelector({ selectedIds, membersMap, members, onToggle, children }: Props) {
  const [search, setSearch] = useState("");

  const filtered = members.filter(m =>
    m.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Popover>
      <PopoverTrigger asChild>
        {children ?? (
          <button className="flex items-center gap-1.5 cursor-pointer hover:opacity-80 transition min-h-[28px]">
            {selectedIds.length > 0 ? (
              <div className="flex items-center -space-x-1.5">
                {selectedIds.slice(0, 4).map(id => {
                  const m = membersMap[id];
                  if (!m) return null;
                  return (
                    <Avatar key={id} className="h-6 w-6 border-2 border-background">
                      <AvatarImage src={m.avatar} />
                      <AvatarFallback className="text-[8px] bg-primary/20 text-primary">{initials(m.name)}</AvatarFallback>
                    </Avatar>
                  );
                })}
                {selectedIds.length > 4 && (
                  <span className="text-[10px] ml-1.5 text-muted-foreground">+{selectedIds.length - 4}</span>
                )}
              </div>
            ) : (
              <span className="text-xs text-muted-foreground">Selecionar...</span>
            )}
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0 rounded-xl z-[150]" align="start" side="bottom" sideOffset={4}>
        <div className="p-2.5 border-b border-border/20">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar membro..."
              className="h-9 pl-9 text-xs bg-muted/40 border-border/20 rounded-lg"
            />
          </div>
        </div>
        <div className="py-1 max-h-[320px] overflow-y-auto">
          <p className="px-3 py-2 text-[10px] text-muted-foreground/60 uppercase tracking-wider font-bold">Membros da equipe</p>
          {filtered.map(m => {
            const isSelected = selectedIds.includes(m.id);
            const memberInfo = membersMap[m.id];
            return (
              <button
                key={m.id}
                className={cn(
                  "flex items-center gap-3 w-full px-3 py-2.5 text-sm hover:bg-muted/50 transition text-left rounded-lg mx-0",
                  isSelected && "bg-primary/8"
                )}
                onClick={() => onToggle(m.id)}
              >
                <Avatar className="h-8 w-8 shrink-0 ring-2 ring-background">
                  <AvatarImage src={memberInfo?.avatar} />
                  <AvatarFallback className="text-[9px] font-bold bg-primary/15 text-primary">{initials(m.name)}</AvatarFallback>
                </Avatar>
                <span className="flex-1 truncate font-medium">{m.name}</span>
                {isSelected && (
                  <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center shrink-0">
                    <Check className="h-3 w-3 text-primary-foreground" />
                  </div>
                )}
              </button>
            );
          })}
          {filtered.length === 0 && (
            <p className="text-xs text-muted-foreground/50 text-center py-6">Nenhum membro encontrado</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
