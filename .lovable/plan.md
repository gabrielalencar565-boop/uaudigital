

## Problema
O editor de descrição/legenda (SmartCaptionEditor) não possui correção ortográfica em tempo real. O usuário precisa de um sistema tipo Word que destaque erros e ofereça sugestões.

## Desafio técnico
O SmartCaptionEditor usa `contentEditable` com `document.execCommand`. Adicionar underlining de erros ortográficos diretamente no HTML do contentEditable é complexo — inserir `<span>` para destacar erros pode quebrar o cursor, conflitar com formatação existente e causar problemas de sincronização.

## Solução
Criar uma **camada de overlay** sobre o editor que renderiza os sublinhados ondulados vermelhos sem modificar o HTML do contentEditable. Isso preserva 100% do comportamento atual do editor.

### Arquitetura

```text
┌─────────────────────────────────┐
│  SmartCaptionEditor (existing)  │
│  ┌───────────────────────────┐  │
│  │ contentEditable div       │  │  ← texto real, sem alteração
│  │ (position: relative)      │  │
│  └───────────────────────────┘  │
│  ┌───────────────────────────┐  │
│  │ SpellCheckOverlay         │  │  ← camada de SVG/CSS com 
│  │ (position: absolute,      │  │     underlining ondulado
│  │  pointer-events: none)    │  │
│  └───────────────────────────┘  │
│  ┌───────────────────────────┐  │
│  │ SuggestionPopover         │  │  ← popover ao clicar em erro
│  └───────────────────────────┘  │
└─────────────────────────────────┘
```

### Componentes a criar/modificar

1. **`src/features/gestao/hooks/use-spellcheck.ts`** — Hook customizado
   - Recebe o texto plain-text extraído do editor
   - Debounce de 500ms
   - Chama a API do LanguageTool (`POST https://api.languagetool.org/v2/check`)
   - Retorna array de `SpellError[]` com `{ offset, length, message, suggestions[], rule }`
   - Cache inteligente: só re-verifica trechos alterados quando possível

2. **`src/features/gestao/components/SpellCheckOverlay.tsx`** — Overlay visual
   - Recebe `editorRef` e lista de erros
   - Usa `Range` API para localizar cada erro no DOM do editor
   - Renderiza `<div>` posicionado absolutamente com `border-bottom: 2px wavy red` sobre cada palavra
   - `pointer-events: none` para não interferir na edição
   - Recalcula posições on scroll/resize

3. **`src/features/gestao/components/SpellSuggestionPopover.tsx`** — Popover de sugestões
   - Aparece ao clicar com botão direito ou clique normal sobre uma palavra com erro
   - Mostra: mensagem do erro, lista de sugestões, botão "Ignorar"
   - "Corrigir tudo" quando há múltiplos erros do mesmo tipo
   - Ao selecionar sugestão, substitui o texto no editor e re-trigger spellcheck

4. **Modificar `SmartCaptionEditor.tsx`**
   - Integrar o hook `useSpellcheck` passando o texto plain-text
   - Adicionar `SpellCheckOverlay` como filho posicionado
   - Detectar clique em palavra com erro para abrir `SpellSuggestionPopover`
   - Indicador visual discreto no status bar: "🔴 3 erros" ou "✅ Sem erros"

### Fluxo de dados

1. Usuário digita → `handleInput` dispara (já existente)
2. Após debounce de 500ms → extrai texto puro do editor
3. `POST` para LanguageTool com `{ text, language: "pt-BR" }`
4. Resposta retorna `matches[]` com offset/length/sugestões
5. Overlay renderiza sublinhados nas posições corretas
6. Clique em erro → popover com sugestões
7. Selecionar sugestão → substitui texto via Range API → re-check

### API LanguageTool (gratuita, sem chave)

```
POST https://api.languagetool.org/v2/check
Content-Type: application/x-www-form-urlencoded

text=Ola%20mundo&language=pt-BR
```

### CSS do sublinhado ondulado

```css
.spell-error-underline {
  position: absolute;
  pointer-events: none;
  border-bottom: 2px wavy #ef4444;
  z-index: 1;
}
```

### Performance
- Debounce de 500ms evita chamadas excessivas
- Cache do último texto verificado — não re-envia se texto não mudou
- Erros "ignorados" ficam em estado local (não re-aparecem)
- Overlay recalcula posições apenas quando erros ou scroll mudam

### Experiência do usuário
- Sublinhado vermelho ondulado aparece suavemente (fade-in)
- Cursor nunca é afetado (overlay é separado do contentEditable)
- Popover fecha automaticamente ao continuar digitando
- Status bar mostra contagem de erros
- Botão "Corrigir tudo" para aplicar todas as sugestões de uma vez

## Arquivos

| Ação | Arquivo |
|------|---------|
| Criar | `src/features/gestao/hooks/use-spellcheck.ts` |
| Criar | `src/features/gestao/components/SpellCheckOverlay.tsx` |
| Criar | `src/features/gestao/components/SpellSuggestionPopover.tsx` |
| Editar | `src/features/gestao/components/SmartCaptionEditor.tsx` |

Sem necessidade de migration, edge function ou chave de API.

