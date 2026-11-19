# Como editar a landing page do o plano.

## Jeito mais fácil: modo de edição (sem mexer em código)

**No link do Claude:** abra a página e clique em **✎ Editar página** (canto inferior esquerdo). Esse botão só aparece para você, que é dono do link.
**Na sua hospedagem ou no computador:** abra a página com `?editar` no fim do endereço, por exemplo `seusite.com.br/?editar`. Quem visita a página normalmente não vê o botão.

No modo de edição:

| O que fazer | Como |
| --- | --- |
| **Mudar um texto** | Clique no texto e escreva. Para negrito, selecione e aperte Ctrl+B (Cmd+B no Mac). |
| **Mudar o tamanho de um texto** | Clique no texto e use a barra **Tamanho do texto** no painel da direita. |
| **Trocar uma imagem** | Clique na imagem e em **Trocar imagem**. Ela é reduzida e otimizada sozinha. |
| **Mudar o tamanho de uma imagem** | Clique na imagem e use a barra **Tamanho da imagem**. Nas fotos dos cards, a barra funciona como **Zoom**. |
| **Largura de um texto ou imagem** | Clique nele e use a barra **Largura** (100% = original). |
| **Mover para os lados ou para cima/baixo** | Barras **Mover para os lados (X)** e **Mover para cima/baixo (Y)**, em pixels. |
| **Afastar ou aproximar** | Barras **Espaço acima** e **Espaço abaixo** (valores negativos aproximam). |
| **Logo, círculo roxo e letra P da capa** | Clique no logo para mover ou mudar a largura. Para o círculo e o P, clique na foto da capa e use os botões **Ajustar círculo roxo** e **Ajustar letra P**. |
| **Painel cobrindo o que você edita** | Clique em **⇆** no painel para mudá-lo de lado. |
| **Mudar a descrição de uma imagem** | Clique na imagem e edite o campo **Descrição** (é lida por leitores de tela e pelo Google). |
| **Preço, parcelamento, data, garantia, link da Kiwify e vídeo** | Clique em **Preço e link** na barra de cima. |
| **Desfazer** | Clique no texto ou na imagem e em **Voltar ao original**. |

**Para guardar:**
- **No link do Claude:** clique em **Salvar**. A alteração já aparece para quem abrir o link.
- **Na sua hospedagem:** clique em **Baixar edicoes.js** e substitua o arquivo `edicoes.js` da pasta da página pelo que você baixou. As imagens trocadas vão dentro desse arquivo.

Depois de subir o novo `edicoes.js`, se a página ainda mostrar a versão antiga, recarregue com Ctrl+Shift+R (no Mac, Cmd+Shift+R) para limpar o cache.

> As palavras do calendário "No improviso × Com o plano." e a faixa "o plano." gigante do final não entram no modo de edição. Para mudá-las, veja a seção 2 abaixo ou peça ao Claude.

---

## Editando direto nos arquivos (opcional)

A página tem estes arquivos e uma pasta de imagens:

| Arquivo | Para que serve |
| --- | --- |
| `index.html` | Todos os textos originais da página |
| `script.js` | Preço, link da Kiwify, data, garantia e vídeo (bloco `CONFIG` logo no começo) |
| `edicoes.js` | O que você mudou no modo de edição (tem prioridade sobre o `index.html` e o `script.js`) |
| `editor.js` | O modo de edição em si (não precisa mexer) |
| `style.css` | Cores, fontes e layout |
| `img/` | Todas as imagens |

Para editar, abra os arquivos num editor de texto. O VS Code é gratuito: https://code.visualstudio.com
Para ver o resultado, dê dois cliques no `index.html` e ele abre no navegador.

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
| `4. O MÉTODO` | As 6 etapas do método e "Ao terminar, você vai conseguir" |
| `5. COMO FUNCIONA` | "Você não só assiste. Você planeja junto." (4 cards) |
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
| `bruna.webp` | Quem ensina (Bruna, já incluída) | 800 × 1000 (vertical 4:5) |
| `ayrton.webp` | Quem ensina (Ayrton, já incluída) | 800 × 1000 (vertical 4:5) |
| `mockup-aula.webp` | Print da aula no painel dos módulos | 1440 × 900 (16:10) |
| `bonus-briefing.webp` | Bônus 1 (Briefing Estratégico) | 600 × 680 |
| `bonus-guia.webp` | Bônus 2 (O Guia do Social Media Estratégico) | 600 × 680 |
| `bonus-precificacao.webp` | Bônus 3 (Aula de Precificação) | 600 × 680 |
| `bonus-plataforma.webp` | Bônus 4 (Plataforma para montar o planejamento) | 600 × 680 |
| `depoimento-1.webp`, `-2`, `-3` | Foto redonda de quem deu o depoimento | 200 × 200 |
| `og-o-plano.jpg` | Prévia quando o link é enviado no WhatsApp ou no Instagram | 1200 × 630 |

**Dicas:**
- Pode usar `.jpg` ou `.png`. Nesse caso, troque a extensão no `index.html` (Ctrl+F pelo nome do arquivo, ex.: `bonus-guia.webp` → `bonus-guia.jpg`).
- Para a página carregar rápido, deixe cada imagem com menos de 300 KB. Dá para converter e comprimir de graça em https://squoosh.app
- Sempre que trocar uma foto, atualize o texto do `alt="..."` dela no `index.html` (ele descreve a imagem para quem usa leitor de tela).

## 4. Pixel da Meta

No `index.html`, procure `COLE O PIXEL DA META AQUI` e cole o código do seu Pixel no lugar dessa linha.
O evento de clique no botão de compra (InitiateCheckout) já está pronto.

## 5. Publicar

Envie a pasta inteira (os 3 arquivos + `img/`) para a sua hospedagem: Vercel, Netlify, Hostinger etc.
Na Vercel, dá para arrastar a pasta em https://vercel.com/new
