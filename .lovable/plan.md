

## Mover o PWA Install Prompt para a tela de login

### Problema
O `<PwaInstallPrompt />` está no `App.tsx` fora do `BrowserRouter`, aparecendo em todas as telas.

### Solução
1. **Remover** `<PwaInstallPrompt />` do `App.tsx` (linha 82)
2. **Adicionar** `<PwaInstallPrompt />` dentro do `Auth.tsx` (página de login)

Duas linhas alteradas, resultado: o banner de instalação só aparece na tela de login.

