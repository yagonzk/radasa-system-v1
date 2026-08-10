CREATE TYPE "StatusMotorista" AS ENUM ('ATIVO', 'DEMITIDO');

ALTER TABLE "motoristas"
ADD COLUMN "status" "StatusMotorista" NOT NULL DEFAULT 'ATIVO';
