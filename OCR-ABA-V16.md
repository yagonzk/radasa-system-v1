# Radasa System — Aba OCR v16

## O que foi adicionado

- Nova opção **OCR** no menu lateral esquerdo, logo abaixo de **Romaneios**.
- Nova rota `/ocr`.
- Área de arrastar e soltar arquivos PDF ou ZIP.
- ZIPs são abertos no navegador e todos os PDFs internos entram automaticamente na fila.
- Cada página é renderizada em alta resolução com alvo de **500 DPI** (com limite de memória por página).
- A imagem é convertida para preto/branco de alto contraste antes do reconhecimento.
- OCR em português com Tesseract.js, PSM de coluna única e preservação de espaços.
- O PDF de saída mantém a página visual tratada e recebe uma camada invisível de texto OCR pesquisável.
- PDFs com várias páginas são reconstruídos em um único PDF OCR.
- Lotes são processados de forma sequencial para evitar picos de memória.
- Um arquivo gera download direto em PDF; vários arquivos geram um ZIP OCR.
- O processamento da aba OCR é local no navegador: o documento não é enviado ao backend para essa conversão.

## Arquivos principais

- `client/src/pages/OCR.tsx`
- `client/src/lib/ocrPdf.ts`
- `client/src/lib/zipFiles.ts`
- `client/src/components/Layout.tsx`
- `client/src/App.tsx`

## Compatibilidade

A implementação não adiciona dependências npm novas. Ela reutiliza `pdfjs-dist` e `tesseract.js`, que já fazem parte do projeto, e usa APIs nativas do navegador para leitura de ZIPs deflate/store.
