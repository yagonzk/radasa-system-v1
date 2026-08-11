import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export type OcrPdfStage = "preparing" | "rendering" | "recognizing" | "assembling";

export interface OcrPdfProgress {
  stage: OcrPdfStage;
  page: number;
  totalPages: number;
  progress: number;
}

export interface OcrPdfResult {
  blob: Blob;
  text: string;
  pages: number;
}

type ProgressCallback = (progress: OcrPdfProgress) => void;

type OcrLine = {
  text: string;
  bbox: { x0: number; y0: number; x1: number; y1: number };
};

type PdfPageImage = {
  jpeg: Uint8Array;
  widthPx: number;
  heightPx: number;
  widthPt: number;
  heightPt: number;
  lines: OcrLine[];
};

const TARGET_DPI = 500;
const TARGET_SCALE = TARGET_DPI / 72;
const MAX_PAGE_PIXELS = 26_000_000;
const textEncoder = new TextEncoder();

let progressTarget: ProgressCallback | null = null;
let progressPage = 1;
let progressTotalPages = 1;
let workerPromise: Promise<any> | null = null;

async function getWorker() {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker, PSM } = await import("tesseract.js");
      const worker = await createWorker("por", 1, {
        logger(message) {
          if (message.status !== "recognizing text") return;
          progressTarget?.({
            stage: "recognizing",
            page: progressPage,
            totalPages: progressTotalPages,
            progress: Number(message.progress) || 0,
          });
        },
      });
      await worker.setParameters({
        tessedit_pageseg_mode: (PSM as any).SINGLE_COLUMN ?? "4",
        preserve_interword_spaces: "1",
        user_defined_dpi: String(TARGET_DPI),
      });
      return worker;
    })().catch((error) => {
      workerPromise = null;
      throw error;
    });
  }
  return workerPromise;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function otsuThreshold(histogram: Uint32Array, total: number) {
  let sum = 0;
  for (let i = 0; i < 256; i += 1) sum += i * histogram[i];

  let sumBackground = 0;
  let weightBackground = 0;
  let maxVariance = -1;
  let threshold = 190;

  for (let i = 0; i < 256; i += 1) {
    weightBackground += histogram[i];
    if (!weightBackground) continue;
    const weightForeground = total - weightBackground;
    if (!weightForeground) break;

    sumBackground += i * histogram[i];
    const meanBackground = sumBackground / weightBackground;
    const meanForeground = (sum - sumBackground) / weightForeground;
    const variance = weightBackground * weightForeground * (meanBackground - meanForeground) ** 2;

    if (variance > maxVariance) {
      maxVariance = variance;
      threshold = i;
    }
  }

  return threshold;
}

/**
 * Converte a página para preto/branco de alto contraste. Relatórios SIGA
 * costumam ter letras cinza muito finas; elevar levemente o limiar após Otsu
 * mantém esses traços e elimina o fundo acinzentado.
 */
function enhanceDocumentCanvas(canvas: HTMLCanvasElement) {
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Não foi possível preparar a imagem para OCR.");

  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  const data = image.data;
  const histogram = new Uint32Array(256);

  for (let i = 0; i < data.length; i += 4) {
    const grey = Math.round(data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
    histogram[grey] += 1;
  }

  const rawThreshold = otsuThreshold(histogram, canvas.width * canvas.height);
  const threshold = clamp(rawThreshold + 32, 150, 225);

  for (let i = 0; i < data.length; i += 4) {
    const grey = Math.round(data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
    const value = grey <= threshold ? 0 : 255;
    data[i] = value;
    data[i + 1] = value;
    data[i + 2] = value;
    data[i + 3] = 255;
  }

  context.putImageData(image, 0, 0);
}

async function renderPage(page: any, pageNumber: number, totalPages: number, onProgress?: ProgressCallback) {
  const baseViewport = page.getViewport({ scale: 1 });
  const basePixels = Math.max(1, baseViewport.width * baseViewport.height);
  const maxScale = Math.sqrt(MAX_PAGE_PIXELS / basePixels);
  const scale = Math.min(TARGET_SCALE, maxScale);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.ceil(viewport.width));
  canvas.height = Math.max(1, Math.ceil(viewport.height));

  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("O navegador não conseguiu renderizar o PDF.");

  onProgress?.({ stage: "rendering", page: pageNumber, totalPages, progress: 0.15 });
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvas, canvasContext: context, viewport }).promise;
  onProgress?.({ stage: "rendering", page: pageNumber, totalPages, progress: 0.7 });

  enhanceDocumentCanvas(canvas);
  onProgress?.({ stage: "rendering", page: pageNumber, totalPages, progress: 1 });

  return {
    canvas,
    widthPt: Number(baseViewport.width),
    heightPt: Number(baseViewport.height),
  };
}

function canvasToJpeg(canvas: HTMLCanvasElement) {
  return new Promise<Uint8Array>((resolve, reject) => {
    canvas.toBlob(async (blob) => {
      if (!blob) {
        reject(new Error("Não foi possível gerar a página tratada do PDF."));
        return;
      }
      resolve(new Uint8Array(await blob.arrayBuffer()));
    }, "image/jpeg", 0.9);
  });
}

function collectLines(blocks: any[] | null | undefined): OcrLine[] {
  if (!blocks?.length) return [];
  const lines: OcrLine[] = [];
  for (const block of blocks) {
    for (const paragraph of block?.paragraphs ?? []) {
      for (const line of paragraph?.lines ?? []) {
        const text = String(line?.text ?? "").replace(/\s+/g, " ").trim();
        const bbox = line?.bbox;
        if (!text || !bbox) continue;
        lines.push({
          text,
          bbox: {
            x0: Number(bbox.x0) || 0,
            y0: Number(bbox.y0) || 0,
            x1: Number(bbox.x1) || 0,
            y1: Number(bbox.y1) || 0,
          },
        });
      }
    }
  }
  return lines;
}

function asciiForPdf(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[–—]/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[^\x20-\x7E]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapePdfText(value: string) {
  return asciiForPdf(value)
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function numberForPdf(value: number) {
  return Number.isFinite(value) ? Number(value.toFixed(3)).toString() : "0";
}

function concatBytes(parts: Uint8Array[]) {
  const total = parts.reduce((sum, part) => sum + part.byteLength, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.byteLength;
  }
  return output;
}

function streamObject(dictionary: string, stream: Uint8Array) {
  return concatBytes([
    textEncoder.encode(`<< ${dictionary} /Length ${stream.byteLength} >>\nstream\n`),
    stream,
    textEncoder.encode("\nendstream"),
  ]);
}

function createPageContent(page: PdfPageImage, imageName: string) {
  const sx = page.widthPt / page.widthPx;
  const sy = page.heightPt / page.heightPx;
  const commands: string[] = [
    "q",
    `${numberForPdf(page.widthPt)} 0 0 ${numberForPdf(page.heightPt)} 0 0 cm`,
    `/${imageName} Do`,
    "Q",
    "BT",
    "3 Tr",
  ];

  for (const line of page.lines) {
    const text = escapePdfText(line.text);
    if (!text) continue;
    const boxHeight = Math.max(1, line.bbox.y1 - line.bbox.y0);
    const fontSize = clamp(boxHeight * sy * 0.82, 2.5, 30);
    const x = clamp(line.bbox.x0 * sx, 0, page.widthPt);
    const y = clamp(page.heightPt - line.bbox.y1 * sy + fontSize * 0.12, 0, page.heightPt);
    commands.push(`/F1 ${numberForPdf(fontSize)} Tf`);
    commands.push(`1 0 0 1 ${numberForPdf(x)} ${numberForPdf(y)} Tm`);
    commands.push(`(${text}) Tj`);
  }

  commands.push("ET");
  return textEncoder.encode(`${commands.join("\n")}\n`);
}

/**
 * PDF simples e compatível: cada página contém a imagem tratada + uma camada
 * de texto invisível, posicionada pelas linhas reconhecidas pelo Tesseract.
 */
function buildSearchablePdf(pages: PdfPageImage[]) {
  const objects = new Map<number, Uint8Array>();
  const pageObjectNumbers: number[] = [];

  objects.set(1, textEncoder.encode("<< /Type /Catalog /Pages 2 0 R >>"));
  objects.set(3, textEncoder.encode("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"));

  pages.forEach((page, index) => {
    const imageObject = 4 + index * 3;
    const contentObject = imageObject + 1;
    const pageObject = imageObject + 2;
    const imageName = `Im${index + 1}`;
    pageObjectNumbers.push(pageObject);

    objects.set(
      imageObject,
      streamObject(
        `/Type /XObject /Subtype /Image /Width ${page.widthPx} /Height ${page.heightPx} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode`,
        page.jpeg,
      ),
    );

    const pageContent = createPageContent(page, imageName);
    objects.set(contentObject, streamObject("", pageContent));
    objects.set(
      pageObject,
      textEncoder.encode(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${numberForPdf(page.widthPt)} ${numberForPdf(page.heightPt)}] ` +
        `/Resources << /Font << /F1 3 0 R >> /XObject << /${imageName} ${imageObject} 0 R >> >> ` +
        `/Contents ${contentObject} 0 R >>`,
      ),
    );
  });

  objects.set(
    2,
    textEncoder.encode(`<< /Type /Pages /Count ${pages.length} /Kids [${pageObjectNumbers.map((number) => `${number} 0 R`).join(" ")}] >>`),
  );

  const maxObject = 3 + pages.length * 3;
  const header = textEncoder.encode("%PDF-1.4\n%RADASA-OCR\n");
  const chunks: Uint8Array[] = [header];
  const offsets = new Array<number>(maxObject + 1).fill(0);
  let offset = header.byteLength;

  for (let objectNumber = 1; objectNumber <= maxObject; objectNumber += 1) {
    const body = objects.get(objectNumber);
    if (!body) throw new Error(`Falha ao montar o PDF OCR (objeto ${objectNumber}).`);
    const prefix = textEncoder.encode(`${objectNumber} 0 obj\n`);
    const suffix = textEncoder.encode("\nendobj\n");
    offsets[objectNumber] = offset;
    chunks.push(prefix, body, suffix);
    offset += prefix.byteLength + body.byteLength + suffix.byteLength;
  }

  const xrefOffset = offset;
  const xrefLines = [
    "xref",
    `0 ${maxObject + 1}`,
    "0000000000 65535 f ",
  ];
  for (let objectNumber = 1; objectNumber <= maxObject; objectNumber += 1) {
    xrefLines.push(`${String(offsets[objectNumber]).padStart(10, "0")} 00000 n `);
  }
  const trailer = `${xrefLines.join("\n")}\ntrailer\n<< /Size ${maxObject + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  chunks.push(textEncoder.encode(trailer));

  return concatBytes(chunks);
}

/**
 * Renderiza o PDF em alta resolução, reforça o contraste, roda OCR em todas as
 * páginas e devolve um novo PDF visualmente nítido e pesquisável.
 */
export async function processarPdfParaOcr(file: File, onProgress?: ProgressCallback): Promise<OcrPdfResult> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const loadingTask = getDocument({ data: bytes });
  const pdfDocument = await loadingTask.promise;
  const outputPages: PdfPageImage[] = [];
  const pageTexts: string[] = [];

  onProgress?.({ stage: "preparing", page: 1, totalPages: pdfDocument.numPages, progress: 0 });

  try {
    const worker = await getWorker();
    progressTarget = onProgress ?? null;
    progressTotalPages = pdfDocument.numPages;

    for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
      progressPage = pageNumber;
      const page = await pdfDocument.getPage(pageNumber);
      const rendered = await renderPage(page, pageNumber, pdfDocument.numPages, onProgress);
      const { canvas } = rendered;

      onProgress?.({ stage: "recognizing", page: pageNumber, totalPages: pdfDocument.numPages, progress: 0 });
      const recognized = await worker.recognize(
        canvas,
        { pdfTitle: file.name },
        { text: true, blocks: true },
      );

      const text = String(recognized.data.text ?? "").trim();
      pageTexts.push(text);
      const jpeg = await canvasToJpeg(canvas);
      outputPages.push({
        jpeg,
        widthPx: canvas.width,
        heightPx: canvas.height,
        widthPt: rendered.widthPt,
        heightPt: rendered.heightPt,
        lines: collectLines(recognized.data.blocks),
      });

      canvas.width = 1;
      canvas.height = 1;
      page.cleanup();
    }

    onProgress?.({
      stage: "assembling",
      page: pdfDocument.numPages,
      totalPages: pdfDocument.numPages,
      progress: 0.5,
    });
    const pdfBytes = buildSearchablePdf(outputPages);
    onProgress?.({
      stage: "assembling",
      page: pdfDocument.numPages,
      totalPages: pdfDocument.numPages,
      progress: 1,
    });

    return {
      blob: new Blob([pdfBytes], { type: "application/pdf" }),
      text: pageTexts.join("\n\n").trim(),
      pages: pdfDocument.numPages,
    };
  } finally {
    progressTarget = null;
    await loadingTask.destroy();
  }
}
