import { buildApp } from "./app/build-app.js";
import { env } from "./config/env.js";
import { prisma } from "./lib/prisma.js";

async function start() {
  const app = await buildApp();

  try {
    await app.listen({
      host: env.HOST,
      port: env.PORT,
    });

    app.log.info(`Web POS API running on http://${env.HOST}:${env.PORT}`);
  } catch (error) {
    app.log.error(error);
    await prisma.$disconnect();
    process.exit(1);
  }

  const shutdown = async (signal: string) => {
    app.log.info(`Received ${signal}. Shutting down...`);

    await app.close();
    await prisma.$disconnect();

    process.exit(0);
  };

  process.once("SIGINT", () => {
    void shutdown("SIGINT");
  });

  process.once("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
}

void start();