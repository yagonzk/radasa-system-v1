import { z } from "zod";

const booleanFromString = z
  .enum(["true", "false"])
  .default("false")
  .transform((value) => value === "true");

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.string().min(1, "DATABASE_URL é obrigatória"),
  CLIENT_ORIGIN: z.string().default("http://localhost:3000"),
  JWT_SECRET: z.string().min(32, "JWT_SECRET deve ter pelo menos 32 caracteres"),
  JWT_EXPIRES_IN: z.string().default("8h"),
  AUTH_REQUIRED: booleanFromString,
  LOG_LEVEL: z.string().default("info"),
  ANTT_CIOT_ENVIRONMENT: z.enum(["homologacao", "producao"]).default("homologacao"),
  ANTT_CIOT_BASE_URL: z.string().url().default("https://appservices-hml.antt.gov.br/pefServices"),
  ANTT_CIOT_ENABLE_NETWORK: booleanFromString,
  ANTT_CIOT_TIMEOUT_MS: z.coerce.number().int().positive().default(60000),
  ANTT_CIOT_PATH_TRANSPORTER: z.string().default("ConsultarSituacaoTransportador"),
  ANTT_CIOT_PATH_FLEET: z.string().default("ConsultarFrotaTransportador"),
  ANTT_CIOT_PATH_DECLARE: z.string().default("DeclaracaoOperacaoTransporte"),
  ANTT_CIOT_PATH_CANCEL: z.string().default("CancelamentoOperacaoTransporte"),
  ANTT_CIOT_PATH_RECTIFY: z.string().default("RetificacaoOperacaoTransporte"),
  ANTT_CIOT_PATH_CLOSE: z.string().default("EncerramentoOperacaoTransporte"),
  ANTT_CIOT_PATH_QUERY: z.string().default("ConsultarCIOTGerado"),
  ANTT_CIOT_PATH_EXCEPTION: z.string().default("ConsultarExcecao"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const errors = parsed.error.flatten().fieldErrors;
  console.error("Variáveis de ambiente inválidas:", errors);
  console.error(
    "Crie um arquivo .env na raiz do projeto. Você pode copiar o conteúdo de .env.example.",
  );
  throw new Error("Configuração de ambiente inválida");
}

export const env = parsed.data;
