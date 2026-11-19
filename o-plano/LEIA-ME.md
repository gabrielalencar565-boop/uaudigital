# o plano. — landing page de vendas

HTML + CSS + JS puros. Suba a pasta inteira em qualquer hospedagem (na Vercel, aponte o projeto para `o-plano/`).

## O que trocar antes de publicar
1. **`script.js` → bloco `CONFIG`**: link da Kiwify, preços, parcelamento, data, garantia e vídeo. Essa configuração preenche todos os botões e preços da página.
2. **Pixel da Meta**: cole o código base no `<head>` do `index.html`, no comentário "COLE O PIXEL DA META AQUI". O `InitiateCheckout` já dispara no clique de compra.
3. **Imagens em `img/`** (é só salvar com o nome indicado):
   `capa-video.webp`, `mockup-notebook.webp` (16:10), `mockup-celular.webp` (9:19,5), `mockup-aula.webp` (16:10),
   `bonus-raio-x.webp`, `bonus-5-minutos.webp`, `bonus-1-pagina.webp`, `bonus-ebook.webp` (16:10),
   `depoimento-1/2/3.webp` (1:1), `og-o-plano.jpg` (1200x630, prévia do link).
   Enquanto o arquivo não existir, aparece o espaço reservado com rótulo.
4. **Textos entre colchetes** no `index.html` (Ctrl+F por `[`): `[BIO]`, `[TEMPO DE ACESSO…]`, depoimentos, formas de pagamento.
5. **Módulos**: os nomes atuais são uma SUGESTÃO, ajuste ao conteúdo real.

Os parâmetros `utm_*`, `src`, `sck` e `fbclid` da URL são repassados ao checkout automaticamente.
