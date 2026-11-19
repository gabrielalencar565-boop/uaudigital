# o plano. — versão 3 (estrutura de página de oferta longa)

Mesma identidade visual da `o-plano-v2` (preto, cinza, degradê roxo, rótulos amarelos, Bricolage Grotesque, botão pílula com seta),
organizada na estrutura da página de referência: faixa com prazo, hero centralizado com vídeo, faixa numerada, carrossel de resultados,
resumo em bento ("Tudo que você leva"), 01 Método, 02 Como funciona (linha do tempo), 03 Ferramentas (plataforma por dentro em abas + Briefing),
04 Bônus, oferta com lista de valor e cartão de preço, quem ensina, 05 Para quem é, FAQ e CTA final.

HTML + CSS + JS puros. Na Vercel, aponte o projeto para `o-plano-v3/`.

## O que trocar antes de publicar
1. **`script.js` → bloco `CONFIG`**: link da Kiwify, preços, data, garantia, vídeo de vendas (`videoEmbedUrl`) e
   `deadlineISO` (ex.: `2026-11-30T23:59:00-03:00`), que liga o contador da faixa do topo.
2. **Pixel da Meta**: cole no `<head>` do `index.html` (comentário "COLE O PIXEL DA META AQUI"). O `InitiateCheckout` já dispara no clique.
3. **Resultados de alunos** (carrossel logo depois do vídeo): use SOMENTE resultados reais. Prints em `img/resultado-1a.webp`, `1b`, `1c` … `4c` (9:16)
   e textos entre colchetes no `index.html`. Enquanto a imagem não existir, aparece o espaço listrado.
4. **Textos entre colchetes** (Ctrl+F por `[`): bios, cargo do Ayrton, valores da lista da oferta (`[R$ X]`), tempo de acesso e formas de pagamento.
5. As telas da seção "A Plataforma por dentro" são ilustrativas (cliente de exemplo); a legenda já avisa isso.

## Modo de edição
Igual ao da v2: abra a página com `?editar` no fim do endereço. Veja `../o-plano-v2/COMO-EDITAR.md`.
Ao terminar, baixe o `edicoes.js` e substitua o desta pasta.

Os parâmetros `utm_*`, `src`, `sck` e `fbclid` da URL são repassados ao checkout automaticamente.
