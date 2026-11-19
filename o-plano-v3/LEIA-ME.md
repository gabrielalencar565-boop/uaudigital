# o plano. — versão 3 (estrutura de página de oferta longa)

Direção visual "Noite": tudo em preto com brilho roxo, mesma identidade da `o-plano-v2` (degradê roxo, lilás, Bricolage Grotesque,
marca do O como separador). Estrutura enxuta, sem repetições: faixa com prazo, topo com vídeo, faixa com as etapas, depoimentos em vídeo
de clientes da UAU (o curso ainda não tem alunos), o que você leva (curso, ferramentas e bônus num lugar só), método em 6 etapas com a
tela da plataforma, quem ensina, para quem é, oferta, perguntas e chamada final.

HTML + CSS + JS puros. Na Vercel, aponte o projeto para `o-plano-v3/`.

## O que trocar antes de publicar
1. **`script.js` → bloco `CONFIG`**: link da Kiwify, preços, data, garantia, vídeo de vendas (`videoEmbedUrl`) e
   `deadlineISO` (ex.: `2026-11-30T23:59:00-03:00`), que liga o contador da faixa do topo.
2. **Pixel da Meta**: cole no `<head>` do `index.html` (comentário "COLE O PIXEL DA META AQUI"). O `InitiateCheckout` já dispara no clique.
3. **Depoimentos**: são os 4 vídeos de clientes do site da UAU (`video/`). Quando o curso tiver alunos, troque ou some os depoimentos deles.
4. **Textos entre colchetes** (Ctrl+F por `[`): bios, cargo do Ayrton, tempo de acesso e formas de pagamento.
5. As telas da plataforma na seção do método são ilustrativas (cliente de exemplo); a legenda já avisa isso.

## Modo de edição
Igual ao da v2: abra a página com `?editar` no fim do endereço. Veja `../o-plano-v2/COMO-EDITAR.md`.
Ao terminar, baixe o `edicoes.js` e substitua o desta pasta.

Os parâmetros `utm_*`, `src`, `sck` e `fbclid` da URL são repassados ao checkout automaticamente.
