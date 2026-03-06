import { useState } from "react";
import { Search } from "lucide-react";
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
      <PopoverContent className="w-72 p-0" align="start">
        <div className="p-2 border-b border-border/30">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Busque ou insira o e-mail..."
              className="h-8 pl-8 text-xs bg-muted/50 border-0"
            />
          </div>
        </div>
        <div className="py-1 max-h-64 overflow-y-auto">
          <p className="px-3 py-1.5 text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Responsáveis</p>
          {filtered.map(m => {
            const isSelected = selectedIds.includes(m.id);
            const memberInfo = membersMap[m.id];
            return (
              <button
                key={m.id}
                className={cn(
                  "flex items-center gap-3 w-full px-3 py-2 text-sm hover:bg-accent transition text-left",
                  isSelected && "bg-accent/50"
                )}
                onClick={() => onToggle(m.id)}
              >
                <Avatar className="h-7 w-7 shrink-0">
                  <AvatarImage src={memberInfo?.avatar} />
                  <AvatarFallback className="text-[9px] bg-primary/20 text-primary">{initials(m.name)}</AvatarFallback>
                </Avatar>
                <span className="flex-1 truncate">{m.name}</span>
                {isSelected && (
                  <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
                )}
              </button>
            );
          })}
          {filtered.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">Nenhum membro encontrado</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
