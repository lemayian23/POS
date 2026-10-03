import {
  afterAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import { prisma } from "../../src/lib/prisma.js";
import {
  createRefreshToken,
  revokeRefreshToken,
  rotateRefreshToken,
} from "../../src/modules/auth/refresh-token.service.js";

describe("Refresh token service", () => {
  const createdUserIds: string[] = [];

  beforeEach(async () => {
    const user = await prisma.user.create({
      data: {
        name: "Refresh Token Test User",
        email: `refresh-token-${Date.now()}-${Math.random()}@example.com`,
        passwordHash: "test-hash",
      },
    });

    createdUserIds.push(user.id);
  });

  afterAll(async () => {
    await prisma.refreshToken.deleteMany({
      where: {
        userId: {
          in: createdUserIds,
        },
      },
    });

    await prisma.user.deleteMany({
      where: {
        id: {
          in: createdUserIds,
        },
      },
    });

    await prisma.$disconnect();
  });

  it("creates a refresh token and stores only its hash", async () => {
    const userId = createdUserIds.at(-1);

    if (!userId) {
      throw new Error("Expected a test user.");
    }

    const result = await createRefreshToken(userId);

    expect(result.token).toBeTruthy();
    expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(result.familyId).toBeTruthy();

    const stored = await prisma.refreshToken.findFirst({
      where: {
        userId,
      },
    });

    expect(stored).not.toBeNull();
    expect(stored?.tokenHash).not.toBe(result.token);
    expect(stored?.familyId).toBe(result.familyId);
    expect(stored?.revokedAt).toBeNull();
  });

  it("rotates a valid refresh token within the same family", async () => {
    const userId = createdUserIds.at(-1);

    if (!userId) {
      throw new Error("Expected a test user.");
    }

    const original = await createRefreshToken(userId);

    const rotated = await rotateRefreshToken(original.token);

    expect(rotated).not.toBeNull();
    expect(rotated?.token).toBeTruthy();
    expect(rotated?.token).not.toBe(original.token);
    expect(rotated?.userId).toBe(userId);
    expect(rotated?.familyId).toBe(original.familyId);

    const tokens = await prisma.refreshToken.findMany({
      where: {
        userId,
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    expect(tokens).toHaveLength(2);
    expect(tokens[0]?.revokedAt).not.toBeNull();
    expect(tokens[0]?.replacedBy).toBe(tokens[1]?.id);
    expect(tokens[0]?.familyId).toBe(original.familyId);
    expect(tokens[1]?.familyId).toBe(original.familyId);
    expect(tokens[1]?.revokedAt).toBeNull();
  });

  it("cannot rotate the same refresh token twice", async () => {
    const userId = createdUserIds.at(-1);

    if (!userId) {
      throw new Error("Expected a test user.");
    }

    const original = await createRefreshToken(userId);

    const firstRotation = await rotateRefreshToken(original.token);
    const secondRotation = await rotateRefreshToken(original.token);

    expect(firstRotation).not.toBeNull();
    expect(secondRotation).toBeNull();
  });

  it("revokes a refresh token", async () => {
    const userId = createdUserIds.at(-1);

    if (!userId) {
      throw new Error("Expected a test user.");
    }

    const created = await createRefreshToken(userId);

    await revokeRefreshToken(created.token);

    const stored = await prisma.refreshToken.findFirst({
      where: {
        userId,
      },
    });

    expect(stored?.revokedAt).not.toBeNull();

    const rotated = await rotateRefreshToken(created.token);

    expect(rotated).toBeNull();
  });

  it("rejects an unknown refresh token", async () => {
    const result = await rotateRefreshToken(
      "this-token-does-not-exist",
    );

    expect(result).toBeNull();
  });

  it("revokes the entire token family when a revoked token is replayed", async () => {
    const userId = createdUserIds.at(-1);

    if (!userId) {
      throw new Error("Expected a test user.");
    }

    const original = await createRefreshToken(userId);
    const firstRotation = await rotateRefreshToken(original.token);

    expect(firstRotation).not.toBeNull();

    const secondRotation = await rotateRefreshToken(
      firstRotation?.token ?? "",
    );

    expect(secondRotation).not.toBeNull();

    const replayResult = await rotateRefreshToken(original.token);

    expect(replayResult).toBeNull();

    const tokens = await prisma.refreshToken.findMany({
      where: {
        familyId: original.familyId,
      },
    });

    expect(tokens).toHaveLength(3);

    for (const token of tokens) {
      expect(token.revokedAt).not.toBeNull();
    }
  });

  it("does not revoke another refresh-token family when one family is replayed", async () => {
    const userId = createdUserIds.at(-1);

    if (!userId) {
      throw new Error("Expected a test user.");
    }

    const firstFamily = await createRefreshToken(userId);
    const secondFamily = await createRefreshToken(userId);

    await rotateRefreshToken(firstFamily.token);

    const replayResult = await rotateRefreshToken(firstFamily.token);

    expect(replayResult).toBeNull();

    const firstFamilyTokens = await prisma.refreshToken.findMany({
      where: {
        familyId: firstFamily.familyId,
      },
    });

    const secondFamilyTokens = await prisma.refreshToken.findMany({
      where: {
        familyId: secondFamily.familyId,
      },
    });

    for (const token of firstFamilyTokens) {
      expect(token.revokedAt).not.toBeNull();
    }

    expect(secondFamilyTokens).toHaveLength(1);
    expect(secondFamilyTokens[0]?.revokedAt).toBeNull();
  });
});