import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import { extrairTextoGeometricoSiga } from "./sigaPdfGeometry";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

type PositionedText = {
  str?: string;
  width?: number;
  transform?: number[];
  hasEOL?: boolean;
};

export type PdfTextProgress = {
  stage: "extracting" | "ocr-loading" | "ocr";
  page: number;
  totalPages: number;
  progress: number;
};

type ProgressCallback = (progress: PdfTextProgress) => void;

export type PdfTextOptions = {
  /** Usa OCR paralelo, ideal para dezenas/centenas de romaneios. */
  bulk?: boolean;
  /** Ignora a camada de texto e força OCR visual. Usado como retry quando o parser não encontra itens. */
  forceOcr?: boolean;
};

const MIN_SEARCHABLE_CHARACTERS = 120;
const OCR_TARGET_DPI_SCALE = 330 / 72;
const BULK_OCR_TARGET_DPI_SCALE = 330 / 72;
const HIGH_ACCURACY_OCR_TARGET_DPI_SCALE = 400 / 72;
const OCR_MAX_PIXELS = 11_000_000;
const BULK_OCR_MAX_PIXELS = 11_000_000;
const HIGH_ACCURACY_OCR_MAX_PIXELS = 16_000_000;
const BULK_OCR_WORKERS = Math.max(2, Math.min(4, Math.floor((navigator.hardwareConcurrency || 8) / 2)));

type TesseractModule = typeof import("tesseract.js");
type OcrWorker = Awaited<ReturnType<TesseractModule["createWorker"]>>;

const ocrProgressState = {
  callback: null as ProgressCallback | null,
  page: 1,
  totalPages: 1,
};

let sharedOcrWorker: OcrWorker | null = null;
let sharedOcrWorkerPromise: Promise<OcrWorker> | null = null;
let bulkOcrSchedulerPromise: Promise<any> | null = null;

async function getOcrWorker() {
  if (sharedOcrWorker) return sharedOcrWorker;

  if (!sharedOcrWorkerPromise) {
    sharedOcrWorkerPromise = (async () => {
      const { createWorker, PSM } = await import("tesseract.js");
      const worker = await createWorker("por", 1, {
        logger(message) {
          if (message.status !== "recognizing text") return;
          ocrProgressState.callback?.({
            stage: "ocr",
            page: ocrProgressState.page,
            totalPages: ocrProgressState.totalPages,
            progress: Number(message.progress) || 0,
          });
        },
      });
      await worker.setParameters({
        tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
        preserve_interword_spaces: "1",
      });
      return worker;
    })().then((worker) => {
      sharedOcrWorker = worker;
      return worker;
    }).catch((error) => {
      sharedOcrWorkerPromise = null;
      throw error;
    });
  }

  return sharedOcrWorkerPromise;
}


async function getBulkOcrScheduler() {
  if (!bulkOcrSchedulerPromise) {
    bulkOcrSchedulerPromise = (async () => {
      const { createScheduler, createWorker, PSM } = await import("tesseract.js");
      const scheduler = createScheduler();
      const workers = await Promise.all(
        Array.from({ length: BULK_OCR_WORKERS }, async () => {
          const worker = await createWorker("por", 1);
          await worker.setParameters({
            tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
            preserve_interword_spaces: "1",
          });
          scheduler.addWorker(worker);
          return worker;
        }),
      );
      // Mantém uma referência enquanto a página estiver aberta. O scheduler
      // distribui recognize() entre workers reais em vez de enfileirar tudo
      // em um único Tesseract Worker.
      (scheduler as any).__radasaWorkers = workers;
      return scheduler;
    })().catch((error) => {
      bulkOcrSchedulerPromise = null;
      throw error;
    });
  }
  return bulkOcrSchedulerPromise;
}

function pageText(items: PositionedText[]) {
  /**
   * Usa a ORDEM LÓGICA fornecida pelo próprio PDF.js e o marcador `hasEOL`.
   * Não reordena itens por coordenadas X/Y: isso era a principal fonte de
   * corrupção deste relatório, pois pequenos desvios de baseline faziam
   * campos da mesma linha serem separados ou linhas vizinhas serem misturadas.
   *
   * Colocamos um espaço entre TextItems. Se o PDF vier "um glifo por item",
   * o backend já possui repairGlyphSpacedText() e compact parser; se vier
   * "uma palavra por item", os campos permanecem legíveis normalmente.
   */
  const lines: string[] = [];
  let current = "";

  for (const item of items) {
    const value = String(item.str ?? "");
    if (value) {
      if (current && !/\s$/.test(current) && !/^\s/.test(value)) current += " ";
      current += value;
    }

    if (item.hasEOL) {
      const line = current.trim();
      if (line) lines.push(line);
      current = "";
    }
  }

  const tail = current.trim();
  if (tail) lines.push(tail);
  return lines.join("\n");
}

function collapseRepeatedBlocks(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";

  const tokens = trimmed.split(/\s+/).filter(Boolean);
  if (tokens.length < 2) return trimmed;

  const collapsed: string[] = [];
  for (let index = 0; index < tokens.length;) {
    let consumed = false;
    for (let blockSize = Math.floor((tokens.length - index) / 2); blockSize >= 1; blockSize -= 1) {
      let repeated = true;
      for (let offset = 0; offset < blockSize; offset += 1) {
        if (tokens[index + offset] !== tokens[index + blockSize + offset]) {
          repeated = false;
          break;
        }
      }
      if (!repeated) continue;

      collapsed.push(...tokens.slice(index, index + blockSize));
      index += blockSize * 2;
      consumed = true;
      break;
    }

    if (!consumed) {
      collapsed.push(tokens[index]);
      index += 1;
    }
  }

  return collapsed.join(" ");
}

function normalizePdfText(value: string) {
  // IMPORTANTE: não deduplicar tokens do conteúdo do romaneio.
  // Repetições como "0,00 0,00", "00", "11" e outras sequências são dados
  // legítimos das colunas e dos códigos do SIGA.
  return String(value ?? "")
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trim();
}

function compactDigitalRomaneioText(value: string) {
  /**
   * Para um ROMANEIO DE FRETE digital, a estrutura do documento é fixa e a
   * camada textual é mais confiável que OCR. Remover espaços dentro de cada
   * linha torna a interpretação independente de como cada navegador/PDF.js
   * decidiu fragmentar palavras ou glifos. As quebras físicas de linha são
   * preservadas.
   */
  return value
    .split("\n")
    .map((line) => line.replace(/\s+/g, "").trim())
    .filter(Boolean)
    .join("\n");
}

function extractDigitalHeaderMetadata(text: string) {
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  const selected: string[] = [];

  for (const line of lines.slice(0, 30)) {
    const compact = line
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");

    if (
      compact.includes("TRANSPORTADORA") ||
      compact.includes("PLACAVEICULO") ||
      compact.includes("CODVEICULO") ||
      compact.includes("CODIGOVEICULO")
    ) {
      selected.push(line);
    }
  }

  return selected.join("\n");
}

function searchableCharacters(text: string) {
  return text.replace(/\s/g, "").length;
}

function tokenStats(text: string) {
  const tokens = text.match(/[A-Za-z0-9À-ÿ]+/g) ?? [];
  if (!tokens.length) {
    return { ratio: 0, averageLength: 0 };
  }

  const singleCharTokens = tokens.filter((token) => token.length === 1).length;
  const totalLength = tokens.reduce((sum, token) => sum + token.length, 0);
  return {
    ratio: singleCharTokens / tokens.length,
    averageLength: totalLength / tokens.length,
  };
}

function looksLikeRomaneioDigitalText(text: string) {
  /**
   * Para relatórios SIGA/FATRU41 com camada de texto, a camada digital é a
   * fonte de verdade. Não exigimos que uma linha de produto já esteja
   * reconhecível aqui, porque justamente a fragmentação do PDF.js pode inserir
   * espaços entre todos os caracteres. Exigir o regex de produto neste ponto
   * fazia um PDF digital perfeito cair desnecessariamente no OCR.
   */
  const compact = text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, "");

  return (
    compact.includes("ROMANEIODEFRETE") &&
    compact.includes("SIGA/FATRU41") &&
    compact.includes("TRANSPORTADORA") &&
    compact.includes("CLIENTE")
  );
}

function looksLikeSigaRomaneioHeader(text: string) {
  const compact = text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, "");
  return compact.includes("ROMANEIODEFRETE") && compact.includes("SIGA/FATRU41");
}

function countSigaProductCandidates(text: string) {
  const compact = text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, "");
  return compact.match(/\d{5,8}\d{2}\/\d{2}\/\d{2}[0-9OQIL]{2}\d{4,10}-/g)?.length ?? 0;
}

function needsOcr(text: string) {
  if (looksLikeRomaneioDigitalText(text) && countSigaProductCandidates(text) > 0) return false;

  // Alguns PDFs do SIGA têm uma camada de texto parcial: cabeçalho e totais
  // existem, mas CLIENTE/produtos estão apenas na imagem. Antes isso parecia
  // um PDF pesquisável e o parser recebia zero linhas. Nesses casos o OCR é
  // obrigatório já na primeira leitura.
  if (looksLikeSigaRomaneioHeader(text)) {
    const compact = text.replace(/\s+/g, "").toUpperCase();
    if (!compact.includes("CLIENTE") || countSigaProductCandidates(text) === 0) return true;
  }

  if (searchableCharacters(text) < MIN_SEARCHABLE_CHARACTERS) return true;
  const { ratio, averageLength } = tokenStats(text);
  return ratio >= 0.65 && averageLength <= 2.5;
}

async function renderPageForOcr(page: any, bulk = false, highAccuracy = false) {
  const baseViewport = page.getViewport({ scale: 1 });
  const pixelLimit = highAccuracy
    ? HIGH_ACCURACY_OCR_MAX_PIXELS
    : bulk ? BULK_OCR_MAX_PIXELS : OCR_MAX_PIXELS;
  const targetScale = highAccuracy
    ? HIGH_ACCURACY_OCR_TARGET_DPI_SCALE
    : bulk ? BULK_OCR_TARGET_DPI_SCALE : OCR_TARGET_DPI_SCALE;
  const maxScale = Math.sqrt(
    pixelLimit / Math.max(1, baseViewport.width * baseViewport.height),
  );
  const scale = Math.min(targetScale, maxScale);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);

  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("O navegador não conseguiu preparar o PDF para OCR.");

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvas, canvasContext: context, viewport }).promise;
  return canvas;
}

/**
 * Extrai primeiro a camada de texto do PDF. Páginas sem texto suficiente são
 * renderizadas entre 330 e 400 DPI e reconhecidas no próprio navegador,
 * mantendo o backend livre de executáveis e processamento pesado.
 */
export async function extrairTextoPdf(file: File, onProgress?: ProgressCallback, options: PdfTextOptions = {}) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const loadingTask = getDocument({ data: bytes });
  const pdfDocument = await loadingTask.promise;
  const pages: string[] = [];
  let currentOcrPage = 1;

  try {
    for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
      onProgress?.({
        stage: "extracting",
        page: pageNumber,
        totalPages: pdfDocument.numPages,
        progress: 0,
      });

      const page = await pdfDocument.getPage(pageNumber);
      const content = await page.getTextContent();

      // Caminho determinístico para o relatório SIGA: usa X/Y dos TextItems e
      // ignora completamente a ordem lógica/hasEOL do PDF.js. Esse é o formato
      // usado pelos romaneios enviados pelo usuário e evita que diferenças entre
      // Chrome/build do PDF.js façam o parser receber zero linhas.
      const sigaGeometricText = extrairTextoGeometricoSiga(content.items as PositionedText[]);
      const digitalText = normalizePdfText(
        sigaGeometricText ?? pageText(content.items as PositionedText[]),
      );
      const fragmentedText = needsOcr(digitalText);
      const forceOcr = options.forceOcr === true;

      if (!forceOcr && sigaGeometricText) {
        pages.push(digitalText);
        page.cleanup();
        continue;
      }

      if (!forceOcr && !fragmentedText && searchableCharacters(digitalText) >= MIN_SEARCHABLE_CHARACTERS) {
        pages.push(digitalText);
        page.cleanup();
        continue;
      }

      currentOcrPage = pageNumber;
      onProgress?.({
        stage: "ocr-loading",
        page: pageNumber,
        totalPages: pdfDocument.numPages,
        progress: 0,
      });

      const canvas = await renderPageForOcr(page, options.bulk === true, forceOcr);
      let recognized: any;
      if (options.bulk) {
        const scheduler = await getBulkOcrScheduler();
        recognized = await scheduler.addJob("recognize", canvas);
      } else {
        const ocrWorker = await getOcrWorker();
        ocrProgressState.callback = onProgress ?? null;
        ocrProgressState.page = currentOcrPage;
        ocrProgressState.totalPages = pdfDocument.numPages;
        recognized = await ocrWorker.recognize(canvas);
      }
      const ocrText = normalizePdfText(recognized.data.text);
      const digitalHeader = extractDigitalHeaderMetadata(digitalText);
      const preferredText = forceOcr || fragmentedText ? ocrText : (
        searchableCharacters(ocrText) >= searchableCharacters(digitalText)
          ? ocrText
          : digitalText
      );

      // Mesmo quando o corpo precisa de OCR, a camada digital costuma preservar
      // melhor a linha de TRANSPORTADORA / Cód. Veículo / PLACA. Mantemos apenas
      // essas linhas digitais junto do OCR para não duplicar produtos.
      pages.push(
        digitalHeader && !preferredText.includes(digitalHeader)
          ? `${digitalHeader}\n${preferredText}`
          : preferredText,
      );
      canvas.width = 1;
      canvas.height = 1;
      page.cleanup();
    }
  } finally {
    ocrProgressState.callback = null;
    await loadingTask.destroy();
  }

  const text = pages.join("\n\n").trim();
  if (!text) {
    throw new Error(
      "O PDF não possui texto legível, mesmo após o OCR. Confira se a página está nítida.",
    );
  }
  return text;
}
