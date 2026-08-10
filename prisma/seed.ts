import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient, UserRole } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME?.trim() || "Administrador";
  const username = (process.env.ADMIN_USERNAME?.trim() || "admin").toLowerCase();

  if (!email || !password) {
    console.log("ADMIN_EMAIL/ADMIN_PASSWORD não definidos; seed de usuário ignorado.");
    return;
  }

  if (password.length < 8) {
    throw new Error("ADMIN_PASSWORD deve possuir pelo menos 8 caracteres.");
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.user.upsert({
    where: { email },
    update: { name, username, passwordHash, role: UserRole.ADMIN, active: true },
    create: { name, username, email, passwordHash, role: UserRole.ADMIN, active: true },
  });

  console.log(`Usuário administrador preparado: ${email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
