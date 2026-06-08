## Objetivo

1. Ampliar o catálogo de sons de notificação (de 6 para ~14 opções).
2. Garantir que, **por padrão**, o som do **Chat** seja diferente do som de **Tarefas/Menções** — a menos que o usuário escolha o mesmo manualmente.

## Mudanças

Tudo concentrado em **`src/lib/notifications.ts`** — nenhum outro arquivo precisa mudar, porque os componentes (`ConfiguracoesPanel`, `NotificationSoundsDialog`) já leem do array `NOTIFICATION_SOUNDS`.

### 1. Novos sons sintetizados (Web Audio, sem novos assets)

Adicionar ao `NOTIFICATION_SOUNDS` os seguintes presets:

| id | label | descrição sonora |
|---|---|---|
| `whistle` | Assobio | sweep ascendente 700→1200 Hz |
| `blip` | Blip retrô | square 660 Hz curto (estilo 8-bit) |
| `knock` | Batida | duas batidas surdas sine 180 Hz |
| `drop` | Gota | sweep descendente 1500→600 Hz com bandpass |
| `coin` | Moeda | C5 → E6 rápido em square (arcade) |
| `pulse` | Pulso | triangle 330 Hz com attack lento |
| `tap` | Toque | noise burst muito curto com bandpass |
| `swoosh` | Swoosh | noise filtrado high-pass com envelope |

Total: **14 opções** (6 atuais + 8 novas).

### 2. Defaults diferentes por categoria

Alterar:

```ts
const DEFAULT_SOUND_BY_CATEGORY: Record<SoundCategory, string> = {
  chat: "pop",     // antes: "default"
  task: "chime",   // antes: "default"
};
```

`getCategorySound()` só usa o default quando o usuário **ainda não escolheu nada** no `localStorage` — então quem já configurou mantém a escolha (mesmo se for igual nas duas categorias).

### Arquivos tocados
- `src/lib/notifications.ts` — adiciona os 8 sons e troca os defaults
