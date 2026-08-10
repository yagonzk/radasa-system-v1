-- Executada após o commit dos novos valores do enum.
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'VISUALIZACAO';
