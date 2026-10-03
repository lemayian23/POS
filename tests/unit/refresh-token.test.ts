import { describe, expect, it } from "vitest";

import {
  generateRefreshToken,
  hashRefreshToken,
} from "../../src/lib/refresh-token.js";

describe("Refresh token utilities", () => {
  it("generates a non-empty random token", () => {
    const token = generateRefreshToken();

    expect(token).toBeTruthy();
    expect(typeof token).toBe("string");
  });

  it("generates different tokens on separate calls", () => {
    const firstToken = generateRefreshToken();
    const secondToken = generateRefreshToken();

    expect(firstToken).not.toBe(secondToken);
  });

  it("produces a deterministic SHA-256 hash", () => {
    const token = "test-refresh-token";

    const firstHash = hashRefreshToken(token);
    const secondHash = hashRefreshToken(token);

    expect(firstHash).toBe(secondHash);
    expect(firstHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("produces different hashes for different tokens", () => {
    const firstHash = hashRefreshToken("token-one");
    const secondHash = hashRefreshToken("token-two");

    expect(firstHash).not.toBe(secondHash);
  });
});