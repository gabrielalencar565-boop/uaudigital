import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/**
 * Emoji-based icon picker (estilo Apple).
 * Mantém os mesmos nomes exportados (LucideIconPicker / DynamicLucideIcon / getLucideIcon)
 * para compatibilidade com chamadas existentes — agora `value` armazena um emoji.
 */

type EmojiEntry = { emoji: string; keywords: string };

const EMOJIS: EmojiEntry[] = [
  // Recompensas & conquistas
  { emoji: "🎁", keywords: "presente gift recompensa" },
  { emoji: "🏆", keywords: "trofeu trophy vitoria" },
  { emoji: "🥇", keywords: "medalha ouro primeiro" },
  { emoji: "🥈", keywords: "medalha prata" },
  { emoji: "🥉", keywords: "medalha bronze" },
  { emoji: "🎖️", keywords: "medalha militar" },
  { emoji: "👑", keywords: "coroa rei realeza crown" },
  { emoji: "💎", keywords: "diamante gem joia" },
  { emoji: "⭐", keywords: "estrela star favorito" },
  { emoji: "🌟", keywords: "estrela brilhante" },
  { emoji: "✨", keywords: "brilho sparkles magia" },
  { emoji: "🎉", keywords: "festa party confete" },
  { emoji: "🎊", keywords: "confete celebracao" },
  { emoji: "🎈", keywords: "balao festa" },
  { emoji: "🎀", keywords: "laco ribbon presente" },
  { emoji: "🏅", keywords: "medalha esportiva" },

  // Reações
  { emoji: "❤️", keywords: "coracao heart amor" },
  { emoji: "🧡", keywords: "coracao laranja" },
  { emoji: "💛", keywords: "coracao amarelo" },
  { emoji: "💚", keywords: "coracao verde" },
  { emoji: "💙", keywords: "coracao azul" },
  { emoji: "💜", keywords: "coracao roxo" },
  { emoji: "🖤", keywords: "coracao preto" },
  { emoji: "🤍", keywords: "coracao branco" },
  { emoji: "💖", keywords: "coracao brilhante" },
  { emoji: "💝", keywords: "coracao presente" },
  { emoji: "👍", keywords: "joinha like thumbs up" },
  { emoji: "👎", keywords: "thumbs down dislike" },
  { emoji: "👏", keywords: "palmas aplausos" },
  { emoji: "🙌", keywords: "maos celebracao" },
  { emoji: "🤝", keywords: "aperto de maos handshake" },
  { emoji: "🙏", keywords: "obrigado pray" },
  { emoji: "😀", keywords: "feliz smile" },
  { emoji: "😄", keywords: "feliz alegre" },
  { emoji: "😍", keywords: "amor encantado" },
  { emoji: "🤩", keywords: "estrelado uau wow" },
  { emoji: "😎", keywords: "legal cool oculos" },
  { emoji: "🥳", keywords: "festa party" },
  { emoji: "🤔", keywords: "pensando think" },
  { emoji: "😢", keywords: "triste choro" },
  { emoji: "😡", keywords: "raiva angry" },

  // Energia & destaque
  { emoji: "🚀", keywords: "foguete rocket lancamento" },
  { emoji: "🔥", keywords: "fogo fire flame" },
  { emoji: "⚡", keywords: "raio zap energia" },
  { emoji: "💥", keywords: "explosao boom" },
  { emoji: "🎯", keywords: "alvo target meta" },
  { emoji: "🚩", keywords: "bandeira flag" },
  { emoji: "🏁", keywords: "bandeira chegada" },
  { emoji: "🔔", keywords: "sino bell notificacao" },
  { emoji: "🔖", keywords: "marcador bookmark" },

  // Dinheiro & loja
  { emoji: "💰", keywords: "dinheiro saco money" },
  { emoji: "💵", keywords: "dinheiro dolar" },
  { emoji: "💴", keywords: "dinheiro iene" },
  { emoji: "💶", keywords: "dinheiro euro" },
  { emoji: "💷", keywords: "dinheiro libra" },
  { emoji: "🪙", keywords: "moeda coin" },
  { emoji: "💳", keywords: "cartao credito" },
  { emoji: "🧾", keywords: "recibo receipt" },
  { emoji: "🛒", keywords: "carrinho compras" },
  { emoji: "🛍️", keywords: "sacola compras shopping" },
  { emoji: "🏷️", keywords: "etiqueta tag preco" },
  { emoji: "🎫", keywords: "ticket ingresso" },

  // Comida & bebida
  { emoji: "☕", keywords: "cafe coffee" },
  { emoji: "🍕", keywords: "pizza" },
  { emoji: "🍔", keywords: "hamburger burger" },
  { emoji: "🍟", keywords: "batata frita" },
  { emoji: "🌮", keywords: "taco" },
  { emoji: "🍿", keywords: "pipoca popcorn" },
  { emoji: "🍩", keywords: "donut rosquinha" },
  { emoji: "🍪", keywords: "cookie biscoito" },
  { emoji: "🍰", keywords: "bolo cake" },
  { emoji: "🎂", keywords: "bolo aniversario" },
  { emoji: "🍫", keywords: "chocolate" },
  { emoji: "🍦", keywords: "sorvete ice cream" },
  { emoji: "🍎", keywords: "maca apple" },
  { emoji: "🍺", keywords: "cerveja beer" },
  { emoji: "🍷", keywords: "vinho wine" },
  { emoji: "🥂", keywords: "brinde tacas champagne" },
  { emoji: "🍸", keywords: "drink coquetel" },

  // Viagem & lugares
  { emoji: "✈️", keywords: "aviao plane viagem" },
  { emoji: "🚗", keywords: "carro car" },
  { emoji: "🚙", keywords: "suv carro" },
  { emoji: "🚕", keywords: "taxi" },
  { emoji: "🚌", keywords: "onibus bus" },
  { emoji: "🚆", keywords: "trem train" },
  { emoji: "🚢", keywords: "navio ship" },
  { emoji: "🚲", keywords: "bicicleta bike" },
  { emoji: "🛵", keywords: "moto scooter" },
  { emoji: "🗺️", keywords: "mapa map" },
  { emoji: "📍", keywords: "localizacao pin" },
  { emoji: "🧭", keywords: "bussola compass" },
  { emoji: "🌍", keywords: "globo terra mundo" },
  { emoji: "🏝️", keywords: "ilha praia" },
  { emoji: "🏔️", keywords: "montanha mountain" },
  { emoji: "🏖️", keywords: "praia beach" },
  { emoji: "🏠", keywords: "casa home" },
  { emoji: "🏢", keywords: "predio escritorio" },
  { emoji: "🏪", keywords: "loja store" },

  // Estudo & criatividade
  { emoji: "📚", keywords: "livros books estudo" },
  { emoji: "📖", keywords: "livro book leitura" },
  { emoji: "🎓", keywords: "formatura graduacao" },
  { emoji: "🧠", keywords: "cerebro brain mente" },
  { emoji: "💡", keywords: "ideia lampada lightbulb" },
  { emoji: "✏️", keywords: "lapis pencil" },
  { emoji: "✒️", keywords: "caneta pen" },
  { emoji: "📝", keywords: "anotacao nota" },
  { emoji: "🎨", keywords: "paleta arte palette" },
  { emoji: "🖌️", keywords: "pincel brush" },
  { emoji: "✂️", keywords: "tesoura scissors" },
  { emoji: "📐", keywords: "regua ruler" },

  // Mídia
  { emoji: "📷", keywords: "camera foto" },
  { emoji: "📸", keywords: "camera flash" },
  { emoji: "🎥", keywords: "camera video filme" },
  { emoji: "🎬", keywords: "claquete cinema" },
  { emoji: "🎞️", keywords: "filme film" },
  { emoji: "📺", keywords: "tv television" },
  { emoji: "🎵", keywords: "musica nota" },
  { emoji: "🎶", keywords: "musica notas" },
  { emoji: "🎧", keywords: "fones headphones" },
  { emoji: "🎤", keywords: "microfone mic" },
  { emoji: "📻", keywords: "radio" },
  { emoji: "🖼️", keywords: "imagem quadro picture" },

  // Tempo
  { emoji: "📅", keywords: "calendario calendar" },
  { emoji: "📆", keywords: "calendario data" },
  { emoji: "🗓️", keywords: "agenda calendario" },
  { emoji: "⏰", keywords: "despertador alarm clock" },
  { emoji: "⏳", keywords: "ampulheta hourglass" },
  { emoji: "⌛", keywords: "ampulheta tempo" },
  { emoji: "⏱️", keywords: "cronometro timer" },
  { emoji: "🕐", keywords: "relogio clock" },

  // Pessoas & trabalho
  { emoji: "👥", keywords: "pessoas users equipe" },
  { emoji: "👤", keywords: "pessoa user" },
  { emoji: "💼", keywords: "maleta trabalho briefcase" },
  { emoji: "📧", keywords: "email mail" },
  { emoji: "💬", keywords: "balao mensagem chat" },
  { emoji: "📞", keywords: "telefone call" },

  // Dispositivos
  { emoji: "💻", keywords: "laptop notebook" },
  { emoji: "🖥️", keywords: "computador desktop" },
  { emoji: "📱", keywords: "celular smartphone" },
  { emoji: "⌚", keywords: "relogio watch" },
  { emoji: "⌨️", keywords: "teclado keyboard" },
  { emoji: "🖱️", keywords: "mouse" },

  // Sucesso & segurança
  { emoji: "✅", keywords: "check ok feito done" },
  { emoji: "☑️", keywords: "checkbox marcado" },
  { emoji: "✔️", keywords: "check verificado" },
  { emoji: "🛡️", keywords: "escudo shield seguranca" },
  { emoji: "🔒", keywords: "cadeado lock" },
  { emoji: "🔓", keywords: "cadeado aberto unlock" },
  { emoji: "🔑", keywords: "chave key" },

  // Atenção & penalidades
  { emoji: "⚠️", keywords: "aviso warning atencao" },
  { emoji: "❗", keywords: "exclamacao importante" },
  { emoji: "❌", keywords: "x errado cancelar" },
  { emoji: "🚫", keywords: "proibido ban" },
  { emoji: "💀", keywords: "caveira skull" },
  { emoji: "🐛", keywords: "bug inseto" },

  // Métricas
  { emoji: "📈", keywords: "grafico crescimento up" },
  { emoji: "📉", keywords: "grafico queda down" },
  { emoji: "📊", keywords: "grafico barras chart" },
  { emoji: "🎚️", keywords: "controle nivel" },

  // Organização
  { emoji: "📁", keywords: "pasta folder" },
  { emoji: "📂", keywords: "pasta aberta" },
  { emoji: "📄", keywords: "documento arquivo file" },
  { emoji: "📋", keywords: "prancheta clipboard" },
  { emoji: "🗂️", keywords: "organizador divisor" },

  // Natureza & clima
  { emoji: "☀️", keywords: "sol sun" },
  { emoji: "🌙", keywords: "lua moon" },
  { emoji: "⛅", keywords: "nublado parcial" },
  { emoji: "☁️", keywords: "nuvem cloud" },
  { emoji: "🌧️", keywords: "chuva rain" },
  { emoji: "❄️", keywords: "neve snow snowflake" },
  { emoji: "🌈", keywords: "arco iris rainbow" },
  { emoji: "🌱", keywords: "broto seedling crescimento" },
  { emoji: "🌳", keywords: "arvore tree" },
  { emoji: "🍀", keywords: "trevo sorte luck" },
  { emoji: "🌸", keywords: "flor cherry blossom" },
  { emoji: "🌺", keywords: "flor hibiscus" },

  // Esporte & saúde
  { emoji: "🏋️", keywords: "academia dumbbell halter" },
  { emoji: "🏃", keywords: "corrida runner" },
  { emoji: "⚽", keywords: "futebol soccer" },
  { emoji: "🏀", keywords: "basquete basketball" },
  { emoji: "🎾", keywords: "tenis tennis" },
  { emoji: "❤️‍🔥", keywords: "coracao em chamas" },
  { emoji: "👀", keywords: "olhos eyes" },
];

const DEFAULT_EMOJI = "🎁";

export function getLucideIcon(_name?: string | null): never {
  // mantido apenas para compatibilidade de import; não usado.
  return undefined as never;
}

export function DynamicLucideIcon({
  name,
  className,
  fallback: _fallback,
  strokeWidth: _strokeWidth,
}: {
  name?: string | null;
  className?: string;
  fallback?: unknown;
  strokeWidth?: number;
}) {
  const emoji = name && /\p{Extended_Pictographic}/u.test(name) ? name : DEFAULT_EMOJI;
  return (
    <span
      className={cn("inline-flex items-center justify-center leading-none select-none", className)}
      style={{
        fontFamily:
          '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji","Twemoji Mozilla","EmojiOne Color","Android Emoji",sans-serif',
        fontSize: "1.1em",
      }}
      aria-hidden="true"
    >
      {emoji}
    </span>
  );
}

interface LucideIconPickerProps {
  value?: string | null;
  onChange: (emoji: string) => void;
  placeholder?: string;
}

export function LucideIconPicker({ value, onChange, placeholder = "Escolher ícone" }: LucideIconPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const isEmoji = value && /\p{Extended_Pictographic}/u.test(value);

  const filtered = useMemo(() => {
    if (!search.trim()) return EMOJIS;
    const q = search.toLowerCase().trim();
    return EMOJIS.filter((e) => e.keywords.toLowerCase().includes(q) || e.emoji.includes(q));
  }, [search]);

  const emojiFont = {
    fontFamily:
      '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji","Twemoji Mozilla","EmojiOne Color","Android Emoji",sans-serif',
  } as const;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="h-10 px-3 rounded-md border border-input bg-background flex items-center gap-2 hover:bg-muted/50 transition-colors w-full"
        >
          <span className="text-xl leading-none" style={emojiFont}>
            {isEmoji ? value : "🎁"}
          </span>
          <span className="text-sm text-muted-foreground truncate">
            {isEmoji ? "Trocar ícone" : placeholder}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <div className="p-3 border-b border-border">
          <Input
            placeholder="Buscar emoji... ex: trofeu, foguete"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 text-sm"
            autoFocus
          />
        </div>
        <ScrollArea className="h-[280px]">
          <div className="grid grid-cols-8 gap-1 p-2">
            {filtered.map((e) => (
              <button
                key={e.emoji}
                type="button"
                onClick={() => {
                  onChange(e.emoji);
                  setOpen(false);
                  setSearch("");
                }}
                className={cn(
                  "h-9 w-9 rounded-lg flex items-center justify-center text-xl transition-all",
                  value === e.emoji
                    ? "ring-2 ring-offset-1 ring-primary bg-primary/10"
                    : "hover:bg-muted/60",
                )}
                title={e.keywords.split(" ")[0]}
                style={emojiFont}
              >
                {e.emoji}
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="col-span-8 text-xs text-muted-foreground text-center py-4">
                Nenhum emoji encontrado
              </p>
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
