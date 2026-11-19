# Como editar a landing page do o plano.

A página tem só 3 arquivos e uma pasta de imagens:

| Arquivo | Para que serve |
| --- | --- |
| `index.html` | **Todos os textos** da página |
| `script.js` | **Preço, link da Kiwify, data, garantia e vídeo** (bloco `CONFIG` logo no começo) |
| `style.css` | Cores, fontes e layout (não precisa mexer para trocar texto ou imagem) |
| `img/` | **Todas as imagens** |

Para editar, abra os arquivos num editor de texto. O VS Code é gratuito: https://code.visualstudio.com
Para ver o resultado, dê dois cliques no `index.html` e ele abre no navegador.

---

## 1. Preço, link de compra, data e garantia

Abra `script.js`. Logo no início tem isto:

```js
const CONFIG = {
  checkoutUrl: "[LINK KIWIFY]",
  installments: "[12x de R$ X]",
  cashPrice: "[PREÇO DE ABERTURA]",
  normalPrice: "[PREÇO NORMAL]",
  deadline: "[DATA]",
  guarantee: "[7 DIAS]",
  videoEmbedUrl: "",
```

Troque **só o que está entre aspas**. Exemplo:

```js
  checkoutUrl: "https://pay.kiwify.com.br/abc123",
  installments: "12x de R$ 19,70",
  cashPrice: "R$ 197",
```

Esses valores aparecem sozinhos em **todos** os lugares da página: capa, oferta, CTA final e barra fixa do celular.
O vídeo é opcional. Com um link de embed do YouTube (ex.: `https://www.youtube-nocookie.com/embed/ID_DO_VIDEO`), aparece o botão "Ver apresentação" na capa.

## 2. Textos

Abra `index.html`. Para achar qualquer texto, use **Ctrl+F** (no Mac, **Cmd+F**) e digite um pedaço da frase que você vê na página.
Troque o texto **entre as tags**, sem apagar o que está entre `<` e `>`.

```html
<h1 ...>Pare de postar no improviso. Planeje o mês do seu cliente <em>com estratégia.</em></h1>
```

- O que está dentro de `<em>...</em>` nos títulos é a parte destacada em roxo.
- `<b>...</b>` e `<strong>...</strong>` deixam o texto em negrito.

A página é dividida em blocos com comentários, para você se localizar:

| Comentário no `index.html` | Seção |
| --- | --- |
| `1. HERO (capa)` | Capa: logo, título, texto e botão |
| `FAIXA` | Faixa com palavras passando |
| `2. DOR` | "Você trabalha o mês inteiro…", lista de dores e conversa ilustrativa |
| `3. ANTES × DEPOIS` | Calendário "No improviso × Com o plano." (cada post tem `data-m` = texto no improviso e `data-p` = texto com o plano) |
| `4. A JORNADA + O QUE É` | Atração, Autoridade, Conversão e "Ao terminar, você vai conseguir" |
| `5. MÓDULOS` | Módulos do curso (cada `<li class="step">`; troque também `data-title`, que aparece no painel) |
| `6. PARA QUEM É` | É para você / Não é para você |
| `7. BÔNUS` | Os 4 bônus |
| `8. QUEM ENSINA` | Seu texto e `[BIO]` |
| `9. DEPOIMENTOS` | Depoimentos (**use só depoimentos reais**) |
| `10. OFERTA` | Lista do que está incluso e garantia |
| `11. FAQ` | Perguntas frequentes |
| `12. CTA FINAL` | Chamada final |

**O que ainda falta preencher:** procure por `[` com Ctrl+F. Faltam `[BIO]`, o tempo de acesso, os depoimentos e as formas de pagamento. Os nomes dos módulos são uma sugestão: confira com o curso real.

## 3. Imagens

O jeito mais fácil: **salve a nova imagem na pasta `img/` com o mesmo nome do arquivo que ela substitui.** Não precisa mexer no código.
Enquanto uma imagem não existe, a página mostra um espaço listrado com o tamanho esperado.

| Arquivo em `img/` | Onde aparece | Formato ideal |
| --- | --- | --- |
| `capa-pessoas.webp` | Foto dos 3 na capa (computador). **Fundo transparente** (PNG ou WebP recortado). O círculo roxo e o "P" atrás são feitos no código. | 1400 × 841 |
| `capa-pessoas-mobile.webp` | Mesma foto, menor, para o celular | 900 × 541 |
| `gabriel.webp` | Quem ensina | 800 × 1000 (vertical 4:5) |
| `mockup-aula.webp` | Print da aula no painel dos módulos | 1440 × 900 (16:10) |
| `bonus-raio-x.webp` | Bônus 1 | 600 × 680 |
| `bonus-5-minutos.webp` | Bônus 2 | 600 × 680 |
| `bonus-1-pagina.webp` | Bônus 3 | 600 × 680 |
| `bonus-ebook.webp` | Bônus 4 | 600 × 680 |
| `depoimento-1.webp`, `-2`, `-3` | Foto redonda de quem deu o depoimento | 200 × 200 |
| `og-o-plano.jpg` | Prévia quando o link é enviado no WhatsApp ou no Instagram | 1200 × 630 |

**Dicas:**
- Pode usar `.jpg` ou `.png`. Nesse caso, troque a extensão no `index.html` (Ctrl+F pelo nome do arquivo, ex.: `bonus-ebook.webp` → `bonus-ebook.jpg`).
- Para a página carregar rápido, deixe cada imagem com menos de 300 KB. Dá para converter e comprimir de graça em https://squoosh.app
- Sempre que trocar uma foto, atualize o texto do `alt="..."` dela no `index.html` (ele descreve a imagem para quem usa leitor de tela).

## 4. Pixel da Meta

No `index.html`, procure `COLE O PIXEL DA META AQUI` e cole o código do seu Pixel no lugar dessa linha.
O evento de clique no botão de compra (InitiateCheckout) já está pronto.

## 5. Publicar

Envie a pasta inteira (os 3 arquivos + `img/`) para a sua hospedagem: Vercel, Netlify, Hostinger etc.
Na Vercel, dá para arrastar a pasta em https://vercel.com/new
