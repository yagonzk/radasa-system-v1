import { useMemo, useRef, useState } from "react";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { processarPdfParaOcr, type OcrPdfProgress } from "@/lib/ocrPdf";
import { createZip, readZipEntries } from "@/lib/zipFiles";
import {
  CheckCircle2,
  Download,
  FileArchive,
  FileCheck2,
  FileText,
  LoaderCircle,
  ScanText,
  Trash2,
  UploadCloud,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

type OcrStatus = "waiting" | "processing" | "ready" | "error";

type OcrQueueItem = {
  id: string;
  file: File;
  sourcePath: string;
  outputName: string;
  status: OcrStatus;
  progress: number;
  progressLabel: string;
  output?: Blob;
  pages?: number;
  textLength?: number;
  error?: string;
};

function stripExtension(name: string) {
  return name.replace(/\.[^.]+$/, "");
}

function outputPdfName(sourcePath: string) {
  const normalized = sourcePath.replace(/\\/g, "/");
  const slash = normalized.lastIndexOf("/");
  const folder = slash >= 0 ? normalized.slice(0, slash + 1) : "";
  const fileName = slash >= 0 ? normalized.slice(slash + 1) : normalized;
  return `${folder}${stripExtension(fileName)}_OCR.pdf`;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function progressPercent(progress: OcrPdfProgress) {
  const total = Math.max(1, progress.totalPages);
  const pageBase = Math.max(0, progress.page - 1) / total;
  let pagePart = 0;
  if (progress.stage === "preparing") pagePart = 0.02;
  if (progress.stage === "rendering") pagePart = 0.05 + progress.progress * 0.2;
  if (progress.stage === "recognizing") pagePart = 0.25 + progress.progress * 0.68;
  if (progress.stage === "assembling") return 96 + progress.progress * 4;
  return Math.min(95, (pageBase + pagePart / total) * 100);
}

function progressLabel(progress: OcrPdfProgress) {
  const page = `página ${progress.page}/${progress.totalPages}`;
  if (progress.stage === "preparing") return "Preparando PDF...";
  if (progress.stage === "rendering") return `Melhorando nitidez da ${page}...`;
  if (progress.stage === "recognizing") return `OCR da ${page}: ${Math.round(progress.progress * 100)}%`;
  return "Montando PDF pesquisável...";
}

function triggerDownload(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name.split("/").pop() || name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2_000);
}

export default function OCR() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<OcrQueueItem[]>([]);
  const [processing, setProcessing] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [sourceZipName, setSourceZipName] = useState<string | null>(null);

  const readyItems = useMemo(() => items.filter((item) => item.status === "ready" && item.output), [items]);
  const errorCount = useMemo(() => items.filter((item) => item.status === "error").length, [items]);

  const updateItem = (id: string, patch: Partial<OcrQueueItem>) => {
    setItems((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item));
  };

  const processQueue = async (queue: OcrQueueItem[]) => {
    if (!queue.length) return;
    setProcessing(true);

    try {
      for (const item of queue) {
        updateItem(item.id, {
          status: "processing",
          progress: 1,
          progressLabel: "Preparando PDF...",
          error: undefined,
        });

        try {
          const result = await processarPdfParaOcr(item.file, (progress) => {
            updateItem(item.id, {
              status: "processing",
              progress: progressPercent(progress),
              progressLabel: progressLabel(progress),
            });
          });

          updateItem(item.id, {
            status: "ready",
            progress: 100,
            progressLabel: "OCR concluído",
            output: result.blob,
            pages: result.pages,
            textLength: result.text.length,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Falha ao processar o PDF.";
          updateItem(item.id, {
            status: "error",
            progress: 0,
            progressLabel: "Falha no OCR",
            error: message,
          });
        }
      }
    } finally {
      setProcessing(false);
    }
  };

  const prepareFiles = async (files: File[]) => {
    if (processing) {
      toast.warning("Aguarde o lote atual terminar antes de enviar novos arquivos.");
      return;
    }

    const queue: OcrQueueItem[] = [];
    let zipName: string | null = null;

    try {
      for (const file of files) {
        const lower = file.name.toLowerCase();
        if (lower.endsWith(".pdf") || file.type === "application/pdf") {
          queue.push({
            id: crypto.randomUUID(),
            file,
            sourcePath: file.name,
            outputName: outputPdfName(file.name),
            status: "waiting",
            progress: 0,
            progressLabel: "Na fila",
          });
          continue;
        }

        if (lower.endsWith(".zip") || /zip/i.test(file.type)) {
          zipName = files.length === 1 ? file.name : null;
          const entries = await readZipEntries(file);
          const pdfEntries = entries.filter((entry) => entry.name.toLowerCase().endsWith(".pdf"));
          for (const entry of pdfEntries) {
            const entryFile = new File([entry.bytes], entry.name.split("/").pop() || "arquivo.pdf", {
              type: "application/pdf",
            });
            queue.push({
              id: crypto.randomUUID(),
              file: entryFile,
              sourcePath: entry.name,
              outputName: outputPdfName(entry.name),
              status: "waiting",
              progress: 0,
              progressLabel: "Na fila",
            });
          }
          continue;
        }
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível abrir o ZIP.");
      return;
    }

    if (!queue.length) {
      toast.error("Nenhum PDF foi encontrado. Envie arquivos .pdf ou um .zip contendo PDFs.");
      return;
    }

    setSourceZipName(zipName);
    setItems(queue);
    toast.success(`${queue.length} PDF${queue.length === 1 ? "" : "s"} preparado${queue.length === 1 ? "" : "s"} para OCR.`);
    await processQueue(queue);
  };

  const handleInput = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files ?? []);
    event.target.value = "";
    await prepareFiles(selected);
  };

  const downloadAll = async () => {
    const available = items.filter((item) => item.status === "ready" && item.output);
    if (!available.length) return;

    if (available.length === 1) {
      triggerDownload(available[0].output!, available[0].outputName);
      return;
    }

    const entries = await Promise.all(available.map(async (item) => ({
      name: item.outputName,
      bytes: new Uint8Array(await item.output!.arrayBuffer()),
    })));
    const zip = createZip(entries);
    const baseName = sourceZipName ? stripExtension(sourceZipName) : "PDFs";
    triggerDownload(new Blob([zip], { type: "application/zip" }), `${baseName}_OCR.zip`);
  };

  const clear = () => {
    if (processing) return;
    setItems([]);
    setSourceZipName(null);
  };

  return (
    <Layout>
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <ScanText className="h-5 w-5" />
              </div>
              <h1 className="font-display text-2xl font-bold tracking-tight">OCR</h1>
            </div>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Transforme PDFs fracos ou parcialmente legíveis em PDFs nítidos, pesquisáveis e prontos para leitura automática.
            </p>
          </div>

          {items.length > 0 && !processing && (
            <Button variant="outline" size="sm" onClick={clear}>
              <Trash2 className="mr-2 h-4 w-4" />
              Limpar
            </Button>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="rounded-lg bg-primary/10 p-2 text-primary"><FileText className="h-5 w-5" /></div>
              <div><p className="text-xs text-muted-foreground">ARQUIVOS</p><p className="text-xl font-bold">{items.length}</p></div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-600"><FileCheck2 className="h-5 w-5" /></div>
              <div><p className="text-xs text-muted-foreground">PRONTOS</p><p className="text-xl font-bold">{readyItems.length}</p></div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="rounded-lg bg-muted p-2 text-muted-foreground"><ScanText className="h-5 w-5" /></div>
              <div><p className="text-xs text-muted-foreground">QUALIDADE</p><p className="text-xl font-bold">500 DPI</p></div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Enviar PDF ou ZIP</CardTitle>
            <CardDescription>
              O processamento acontece no próprio navegador. PDFs dentro de ZIP são extraídos e processados automaticamente, um por vez.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,.zip,application/pdf,application/zip"
              multiple
              className="hidden"
              onChange={handleInput}
            />
            <button
              type="button"
              disabled={processing}
              onClick={() => inputRef.current?.click()}
              onDragEnter={(event) => { event.preventDefault(); if (!processing) setDragging(true); }}
              onDragOver={(event) => { event.preventDefault(); if (!processing) setDragging(true); }}
              onDragLeave={(event) => { event.preventDefault(); setDragging(false); }}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                if (!processing) void prepareFiles(Array.from(event.dataTransfer.files));
              }}
              className={`flex min-h-52 w-full flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition ${
                dragging ? "border-primary bg-primary/5" : "border-border bg-muted/20 hover:border-primary/50 hover:bg-muted/40"
              } ${processing ? "cursor-not-allowed opacity-70" : "cursor-pointer"}`}
            >
              {processing ? (
                <LoaderCircle className="mb-4 h-10 w-10 animate-spin text-primary" />
              ) : (
                <UploadCloud className="mb-4 h-10 w-10 text-primary" />
              )}
              <span className="text-base font-semibold">
                {processing ? "OCR em andamento" : "Arraste seus PDFs ou ZIP para cá"}
              </span>
              <span className="mt-1 text-sm text-muted-foreground">
                {processing ? "O lote é processado sequencialmente para manter a máxima qualidade." : "ou clique para selecionar os arquivos"}
              </span>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <Badge variant="secondary">PDF pesquisável</Badge>
                <Badge variant="secondary">Contraste reforçado</Badge>
                <Badge variant="secondary">PDF + ZIP</Badge>
              </div>
            </button>
          </CardContent>
        </Card>

        {items.length > 0 && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div>
                <CardTitle className="text-base">Processamento</CardTitle>
                <CardDescription>
                  {processing ? "Não feche esta página até o OCR terminar." : errorCount ? `${errorCount} arquivo(s) apresentaram erro.` : "Todos os arquivos concluídos."}
                </CardDescription>
              </div>
              {readyItems.length > 0 && !processing && (
                <Button onClick={() => void downloadAll()}>
                  {readyItems.length > 1 ? <FileArchive className="mr-2 h-4 w-4" /> : <Download className="mr-2 h-4 w-4" />}
                  {readyItems.length > 1 ? "Baixar ZIP OCR" : "Baixar PDF OCR"}
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              {items.map((item) => (
                <div key={item.id} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                        {item.status === "processing" && <LoaderCircle className="h-5 w-5 animate-spin text-primary" />}
                        {item.status === "ready" && <CheckCircle2 className="h-5 w-5 text-emerald-600" />}
                        {item.status === "error" && <XCircle className="h-5 w-5 text-destructive" />}
                        {item.status === "waiting" && <FileText className="h-5 w-5 text-muted-foreground" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold" title={item.sourcePath}>{item.sourcePath}</p>
                        <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                          <span>{formatBytes(item.file.size)}</span>
                          {item.pages ? <span>{item.pages} página{item.pages === 1 ? "" : "s"}</span> : null}
                          {item.status === "ready" ? <span>Camada OCR pesquisável</span> : null}
                        </div>
                      </div>
                    </div>

                    {item.status === "ready" && item.output && (
                      <Button variant="outline" size="sm" onClick={() => triggerDownload(item.output!, item.outputName)}>
                        <Download className="mr-2 h-4 w-4" />
                        Baixar
                      </Button>
                    )}
                  </div>

                  {(item.status === "processing" || item.status === "waiting") && (
                    <div className="mt-3 space-y-1.5">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{item.progressLabel}</span>
                        <span>{Math.round(item.progress)}%</span>
                      </div>
                      <Progress value={item.progress} />
                    </div>
                  )}

                  {item.status === "error" && item.error && (
                    <p className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{item.error}</p>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
