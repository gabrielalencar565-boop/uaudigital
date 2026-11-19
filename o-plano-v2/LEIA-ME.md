# o plano. — landing page (versão 2, editorial e interativa)

Alternativa à versão em `o-plano/`. Mesmo conteúdo e mesmas regras, com outro conceito visual:
hero em tela cheia com a foto dos 3, conversa ilustrativa com cliente, calendário "No improviso × Com o plano." que se organiza sozinho,
jornada do público (Atração → Autoridade → Conversão), módulos com painel fixo que acompanha a rolagem (desktop),
bônus em leque, oferta com borda animada e CTA final com "o plano." gigante em movimento.

## O que trocar antes de publicar
1. `script.js` → bloco `CONFIG`: link da Kiwify, preços, data, garantia e vídeo (com vídeo, aparece o botão "Ver apresentação" no hero).
2. Pixel da Meta: cole no `<head>` do `index.html` ("COLE O PIXEL DA META AQUI"). O `InitiateCheckout` já dispara no clique de compra.
3. Imagens em `img/`: `mockup-aula.webp` (16:10), `bonus-raio-x.webp`, `bonus-5-minutos.webp`, `bonus-1-pagina.webp`, `bonus-ebook.webp` (3:4),
   `depoimento-1/2/3.webp` (foto 1:1 de quem deu o depoimento), `og-o-plano.jpg` (1200x630).
4. Textos entre colchetes: `[BIO]`, tempo de acesso, depoimentos, formas de pagamento. Módulos são SUGESTÃO.
5. Os exemplos do calendário e da conversa são ilustrativos (não são depoimentos); ajuste se quiser.
