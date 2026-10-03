import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  PORT: z.coerce
    .number()
    .int()
    .min(1)
    .max(65535)
    .default(3000),

  HOST: z.string().min(1).default("127.0.0.1"),

  DATABASE_URL: z
    .string()
    .min(1, "DATABASE_URL is required"),

  JWT_SECRET: z
    .string()
    .min(32, "JWT_SECRET must contain at least 32 characters"),

  CORS_ORIGIN: z
    .string()
    .min(1)
    .default("http://localhost:5173"),

  ACCESS_TOKEN_EXPIRES_IN: z
    .string()
    .min(1)
    .default("15m"),

  REFRESH_TOKEN_EXPIRES_IN_DAYS: z.coerce
    .number()
    .int()
    .min(1)
    .max(30)
    .default(7),

  COOKIE_SECURE: z
  .enum(["true", "false"])
  .transform((value) => value === "true")
  .default(false),
});

export const env = envSchema.parse(process.env);