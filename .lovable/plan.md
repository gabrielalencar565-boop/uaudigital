## Objetivo
Adicionar uma opção no header da seção de anexos para baixar todos os arquivos anexados de uma só vez.

## Arquivo alvo
`src/features/gestao/components/PmAttachmentsSection.tsx`

## Implementação

### 1. Adicionar botão no header
No header existente (linha ~283-298), ao lado do botão "Upload", adicionar um segundo botão "Baixar todos" com ícone de download (variant outline, size sm). O botão deve:
- Aparecer apenas quando `attachments.length > 0`
- Ser desabilitado durante o download

### 2. Implementar `handleDownloadAll`
Criar função assíncrona `handleDownloadAll` que:
- Filtra anexos que possuem `public_url`
- Se nenhum anexo tiver URL pública, mostra toast "Nenhum anexo disponível para download"
- Itera sobre os anexos filtrados
- Para cada um, faz `fetch(url)` → `blob()` → cria blob URL → dispara download via anchor tag
- Adiciona um pequeno `await new Promise(r => setTimeout(r, 150))` entre downloads para evitar bloqueio do navegador
- Mostra toast "Baixando X anexos..." no início
- Mostra toast "Download concluído!" ao final
- Usa try/catch: se algum arquivo falhar, continua com os demais e avisa no final quantos falharam

### 3. Estilo
Manter consistência visual com o botão "Upload" existente — mesmo tamanho, variant outline, ícone `Download` do lucide-react.

## Por que não ZIP?
Não há biblioteca de compactação instalada. Download sequencial individual é mais leve, não requer instalação de dependências, e atende ao requisito do usuário de "baixar todos de uma vez".