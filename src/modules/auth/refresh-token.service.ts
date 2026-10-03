import { randomUUID } from "node:crypto";

import { prisma } from "../../lib/prisma.js";
import {
  generateRefreshToken,
  hashRefreshToken,
} from "../../lib/refresh-token.js";
import { env } from "../../config/env.js";

export async function createRefreshToken(userId: string) {
  const token = generateRefreshToken();
  const tokenHash = hashRefreshToken(token);
  const familyId = randomUUID();

  const expiresAt = new Date(
    Date.now() +
      env.REFRESH_TOKEN_EXPIRES_IN_DAYS * 24 * 60 * 60 * 1000,
  );

  await prisma.refreshToken.create({
    data: {
      userId,
      familyId,
      tokenHash,
      expiresAt,
    },
  });

  return {
    token,
    expiresAt,
    familyId,
  };
}

export async function revokeRefreshToken(token: string) {
  const tokenHash = hashRefreshToken(token);

  await prisma.refreshToken.updateMany({
    where: {
      tokenHash,
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
    },
  });
}

export async function rotateRefreshToken(token: string) {
  const tokenHash = hashRefreshToken(token);

  return prisma.$transaction(async (tx) => {
    const existingToken = await tx.refreshToken.findUnique({
      where: {
        tokenHash,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            isActive: true,
          },
        },
      },
    });

    if (!existingToken) {
      return null;
    }

    /*
     * A previously revoked token being presented again indicates
     * that an old refresh token has been replayed.
     *
     * Revoke the entire refresh-token family.
     */
    if (existingToken.revokedAt !== null) {
      await tx.refreshToken.updateMany({
        where: {
          familyId: existingToken.familyId,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
        },
      });

      return null;
    }

    if (existingToken.expiresAt <= new Date()) {
      return null;
    }

    if (!existingToken.user.isActive) {
      return null;
    }

    const revoked = await tx.refreshToken.updateMany({
      where: {
        id: existingToken.id,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    if (revoked.count !== 1) {
      return null;
    }

    const newToken = generateRefreshToken();
    const newTokenHash = hashRefreshToken(newToken);

    const newExpiresAt = new Date(
      Date.now() +
        env.REFRESH_TOKEN_EXPIRES_IN_DAYS * 24 * 60 * 60 * 1000,
    );

    const replacement = await tx.refreshToken.create({
      data: {
        userId: existingToken.userId,
        familyId: existingToken.familyId,
        tokenHash: newTokenHash,
        expiresAt: newExpiresAt,
      },
    });

    await tx.refreshToken.update({
      where: {
        id: existingToken.id,
      },
      data: {
        replacedBy: replacement.id,
      },
    });

    return {
      token: newToken,
      expiresAt: replacement.expiresAt,
      userId: replacement.userId,
      user: existingToken.user,
      previousTokenId: existingToken.id,
      familyId: replacement.familyId,
    };
  });
}