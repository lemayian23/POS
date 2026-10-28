
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { prisma } from "../lib/prisma.js";
import { hashPassword } from "../lib/password.js";

function promptHidden(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!stdin.isTTY || typeof stdin.setRawMode !== "function") {
      reject(new Error("Run this command in an interactive terminal."));
      return;
    }

    let password = "";
    let settled = false;

    stdout.write(prompt);

    const cleanup = () => {
      stdin.off("data", onData);
      stdin.setRawMode(false);
      stdin.pause();
      stdout.write("\n");
    };

    const onData = (chunk: Buffer) => {
      for (const char of chunk.toString("utf8")) {
        if (char === "\u0003") {
          if (!settled) {
            settled = true;
            cleanup();
            reject(new Error("Password entry cancelled."));
          }
          return;
        }

        if (char === "\r" || char === "\n") {
          if (!settled) {
            settled = true;
            cleanup();
            resolve(password);
          }
          return;
        }

        if (char === "\u007f" || char === "\b") {
          password = password.slice(0, -1);
          continue;
        }

        if (char >= " ") {
          password += char;
        }
      }
    };

    stdin.setRawMode(true);
    stdin.resume();
    stdin.on("data", onData);
  });
}

async function main(): Promise<void> {
  const terminal = createInterface({
    input: stdin,
    output: stdout,
  });

  try {
    const name = (await terminal.question("Administrator name: ")).trim();
    const email = (
      await terminal.question("Administrator email: ")
    ).trim().toLowerCase();

    terminal.close();

    const password = await promptHidden(
      "Administrator password (hidden): ",
    );

    if (!name || !email || password.length < 12) {
      throw new Error(
        "Name and email are required; password must be at least 12 characters.",
      );
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error("Enter a valid email address.");
    }

    const passwordHash = await hashPassword(password);

    await prisma.$transaction(async (tx) => {
      // Serialize concurrent administrator-bootstrap attempts.
      await tx.$queryRaw<{ acquired: number }[]>`
        WITH lock AS MATERIALIZED (
          SELECT pg_advisory_xact_lock(7319241::bigint)
        )
        SELECT 1 AS acquired FROM lock
      `;

      const existingAdmin = await tx.user.findFirst({
        where: { role: "ADMIN" },
        select: { id: true },
      });

      if (existingAdmin) {
        throw new Error(
          "An administrator already exists. Bootstrap refused.",
        );
      }

      await tx.user.create({
        data: {
          name,
          email,
          passwordHash,
          role: "ADMIN",
        },
      });
    });

    console.log(`Administrator created for ${email}.`);
  } finally {
    terminal.close();
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(
    error instanceof Error
      ? error.message
      : "Administrator setup failed.",
  );
  process.exitCode = 1;
});
