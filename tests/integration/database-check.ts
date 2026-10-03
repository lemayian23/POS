import { prisma } from "../../src/lib/prisma.js";

async function main() {
  try {
    const result = await prisma.$queryRaw<
      Array<{ current_database: string }>
    >`SELECT current_database()`;

    console.log("Database connection successful:");
    console.log(result);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("Database connection failed:");
  console.error(error);
  process.exit(1);
});