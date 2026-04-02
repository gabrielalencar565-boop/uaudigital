

## Plano: Menu de opções ao clicar na foto do perfil

Ao clicar na foto no diálogo "Editar perfil", em vez de abrir direto o seletor de arquivo, exibir um pequeno menu com 2 opções:

1. **Alterar** — abre o seletor de arquivo para escolher uma nova foto
2. **Ajustar** — abre o `AvatarCropDialog` com a foto atual para reposicionar/zoom (só aparece se já tiver foto)

### Implementação

**Arquivo: `src/features/meu-painel/components/EditProfileDialog.tsx`**

- Substituir o `onClick` direto no botão do avatar por um `Popover` (já existe no projeto como `@/components/ui/popover`)
- Dentro do `PopoverContent`, renderizar 2 botões:
  - **Alterar foto** (ícone `ImagePlus`) → dispara `fileInputRef.current?.click()` e fecha o popover
  - **Ajustar foto** (ícone `Crop`) → abre o `AvatarCropDialog` usando a URL atual (`avatarPreview ?? avatarUrl`) e fecha o popover. Esse botão fica desabilitado/oculto se não houver foto
- O `AvatarCropDialog` precisa aceitar tanto um blob URL quanto uma URL remota (já funciona pois usa `crossOrigin="anonymous"`)

**Arquivo: `src/pages/Index.tsx`** (tela de onboarding)

- Aplicar a mesma lógica: após selecionar a primeira foto, o clique no avatar mostra as 2 opções (Alterar / Ajustar)
- Antes de ter foto, clique abre direto o file picker

### Detalhes técnicos

- Usar `Popover` + `PopoverTrigger` + `PopoverContent` do shadcn
- Estado `popoverOpen` controlado para fechar ao selecionar opção
- Importar ícones `ImagePlus` e `Crop` do lucide-react
- Para "Ajustar", passar a URL atual como `imageSrc` para o `AvatarCropDialog` — funciona tanto com blob URLs locais quanto URLs do storage

