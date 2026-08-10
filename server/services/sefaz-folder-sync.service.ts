import { promises as fs } from "fs";
import path from "path";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { prisma } from "../lib/prisma.js";
import { sefazService } from "./sefaz.service";

type FolderSyncState = {
  enabled: boolean;
  running: boolean;
  folderPath: string;
  certificateCnpj: string;
  lastStartedAt: string | null;
  lastFinishedAt: string | null;
  lastError: string | null;
  filesFound: number;
  filesChecked: number;
  imported: number;
  duplicated: number;
  failed: number;
  totalImportedSinceStart: number;
};

const state: FolderSyncState = {
  enabled: env.SEFAZ_FOLDER_SYNC_ENABLED,
  running: false,
  folderPath: env.SEFAZ_FOLDER_SYNC_PATH,
  certificateCnpj: env.SEFAZ_FOLDER_SYNC_CNPJ,
  lastStartedAt: null,
  lastFinishedAt: null,
  lastError: null,
  filesFound: 0,
  filesChecked: 0,
  imported: 0,
  duplicated: 0,
  failed: 0,
  totalImportedSinceStart: 0,
};

const knownFiles = new Map<string, number>();

function digits(value: string) {
  return value.replace(/\D/g, "");
}

async function listNfeFiles(root: string): Promise<string[]> {
  const result: string[] = [];
  const pending = [root];

  while (pending.length) {
    const current = pending.pop()!;
    let entries;
    try {
      entries = await fs.readdir(current, { withFileTypes: true });
    } catch (error) {
      throw new Error(
        `Não foi possível acessar a pasta monitorada: ${current}. ${
          error instanceof Error ? error.message : ""
        }`,
      );
    }

    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        pending.push(fullPath);
        continue;
      }

      // Import only complete NF-e files. Ignore summaries and distribution logs.
      if (
        entry.isFile() &&
        entry.name.toLowerCase().endsWith("-nfe.xml") &&
        !entry.name.toLowerCase().endsWith("-resnfe.xml")
      ) {
        result.push(fullPath);
      }
    }
  }

  return result.sort();
}

async function resolveCertificate() {
  const cnpj = digits(state.certificateCnpj);
  if (!cnpj) {
    throw new Error(
      "SEFAZ_FOLDER_SYNC_CNPJ não foi configurado no arquivo .env.",
    );
  }

  const certificate = await prisma.sefazCertificate.findFirst({
    where: { cnpj, active: true },
    orderBy: { createdAt: "desc" },
  });

  if (!certificate) {
    throw new Error(
      `Nenhum certificado ativo foi localizado para o CNPJ ${cnpj}.`,
    );
  }

  return certificate;
}

async function isStableFile(filePath: string) {
  const first = await fs.stat(filePath);
  await new Promise((resolve) =>
    setTimeout(resolve, env.SEFAZ_FOLDER_SYNC_FILE_STABILITY_MS),
  );
  const second = await fs.stat(filePath);
  return first.size === second.size && first.mtimeMs === second.mtimeMs;
}

export const sefazFolderSyncService = {
  status() {
    return { ...state };
  },

  async scan() {
    if (!state.enabled) {
      return { ...state, lastError: "Sincronização por pasta está desativada." };
    }

    if (state.running) {
      return { ...state };
    }

    state.running = true;
    state.lastStartedAt = new Date().toISOString();
    state.lastError = null;
    state.filesFound = 0;
    state.filesChecked = 0;
    state.imported = 0;
    state.duplicated = 0;
    state.failed = 0;

    try {
      const certificate = await resolveCertificate();
      const files = await listNfeFiles(state.folderPath);
      state.filesFound = files.length;

      const candidates: string[] = [];
      for (const filePath of files) {
        const stat = await fs.stat(filePath);
        const signature = stat.size + stat.mtimeMs;
        if (knownFiles.get(filePath) === signature) continue;
        candidates.push(filePath);
      }

      const limited = candidates.slice(0, env.SEFAZ_FOLDER_SYNC_BATCH_SIZE);

      for (const filePath of limited) {
        state.filesChecked += 1;
        try {
          if (!(await isStableFile(filePath))) {
            continue;
          }

          const stat = await fs.stat(filePath);
          const xml = await fs.readFile(filePath, "utf8");
          const result = await sefazService.importXmlText(
            certificate.id,
            path.basename(filePath),
            xml,
          );

          knownFiles.set(filePath, stat.size + stat.mtimeMs);

          if (result.status === "imported") {
            state.imported += 1;
            state.totalImportedSinceStart += 1;
          } else {
            state.duplicated += 1;
          }
        } catch (error) {
          state.failed += 1;
          logger.warn(
            {
              filePath,
              error: error instanceof Error ? error.message : String(error),
            },
            "Falha ao importar XML da pasta do SSAgro",
          );
        }
      }

      state.lastFinishedAt = new Date().toISOString();
      logger.info(
        {
          folder: state.folderPath,
          found: state.filesFound,
          checked: state.filesChecked,
          imported: state.imported,
          duplicated: state.duplicated,
          failed: state.failed,
        },
        "Sincronização da pasta SSAgro concluída",
      );
    } catch (error) {
      state.lastError =
        error instanceof Error ? error.message : "Erro desconhecido.";
      state.lastFinishedAt = new Date().toISOString();
      logger.error({ error: state.lastError }, "Falha na sincronização SSAgro");
    } finally {
      state.running = false;
    }

    return { ...state };
  },

  async initializeKnownFiles() {
    if (!state.enabled || !env.SEFAZ_FOLDER_SYNC_SKIP_EXISTING_ON_START) {
      return;
    }

    try {
      const files = await listNfeFiles(state.folderPath);
      for (const filePath of files) {
        const stat = await fs.stat(filePath);
        knownFiles.set(filePath, stat.size + stat.mtimeMs);
      }
      logger.info(
        { files: files.length },
        "Arquivos antigos da pasta SSAgro marcados como conhecidos",
      );
    } catch (error) {
      logger.warn(
        { error: error instanceof Error ? error.message : String(error) },
        "Não foi possível inicializar os arquivos conhecidos do SSAgro",
      );
    }
  },
};
