/**
 * Bootstrap SUPER_ADMIN script.
 *
 * Usage:
 *   npx tsx scripts/bootstrap-admin.ts
 *
 * Promotes the first registered user to SUPER_ADMIN
 * if no SUPER_ADMIN currently exists.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const existingSuperAdmin = await prisma.user.findFirst({
    where: { role: "SUPER_ADMIN" },
    select: { id: true, email: true, username: true },
  });

  if (existingSuperAdmin) {
    console.log(
      `SUPER_ADMIN already exists: ${existingSuperAdmin.email} (${existingSuperAdmin.username})`
    );
    return;
  }

  const firstUser = await prisma.user.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true, email: true, username: true },
  });

  if (!firstUser) {
    console.log("No users exist yet. Register a user first.");
    return;
  }

  await prisma.user.update({
    where: { id: firstUser.id },
    data: { role: "SUPER_ADMIN" },
  });

  console.log(
    `Promoted ${firstUser.email} (${firstUser.username}) to SUPER_ADMIN`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
