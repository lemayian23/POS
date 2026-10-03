import type { TransactionClient } from "../generated/prisma/internal/prismaNamespace.js";

import { prisma } from "./prisma.js";

export type DatabaseClient = TransactionClient;

export async function withTransaction<T>(
  operation: (db: DatabaseClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(
    async (tx) => {
      return operation(tx);
    },
    {
      maxWait: 5_000,
      timeout: 10_000,
    },
  );
}