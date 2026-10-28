import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import fastifyStatic from "@fastify/static";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { categoryRoutes } from "../modules/categories/category.routes.js";
import { inventoryRoutes } from "../modules/inventory/inventory.routes.js";

import { env } from "../config/env.js";
import { registerJwt } from "../plugins/jwt.js";
import { authRoutes } from "../modules/auth/auth.routes.js";
import { requireAuthentication } from "../modules/auth/auth.guard.js";
import { requireRole } from "../modules/auth/role.guard.js";
import { errorHandler } from "./error-handler.js";
import rateLimit from "@fastify/rate-limit";
import cookie from "@fastify/cookie";
import { productRoutes } from "../modules/products/product.routes.js";
import { saleRoutes } from "../modules/sales/sale.routes.js";

export async function buildApp() {
  const app = Fastify({
    logger: true,
  });

  const currentFile = fileURLToPath(import.meta.url);
  const currentDirectory = path.dirname(currentFile);
  const clientDirectory = path.resolve(currentDirectory, "../../client");


  app.setErrorHandler(errorHandler);

  await app.register(rateLimit, {
    global: false,
    max: 100,
    timeWindow: "1 minute",
  });

  await app.register(helmet);

  await app.register(fastifyStatic, {
    root: clientDirectory,
    prefix: "/",
    index: false,
    wildcard: false,
  });

  await app.register(cors, {
    origin: env.CORS_ORIGIN,
  });

  await registerJwt(app);

  await app.register(cookie);

  await app.register(authRoutes);
  
  await app.register(productRoutes);

  await app.register(categoryRoutes);

  await app.register(inventoryRoutes);

  await app.register(saleRoutes);

  app.get("/health", async () => {
    return {
      status: "ok",
    };
  });

  app.get("/", async (_request, reply) => {
    return reply.redirect("/login.html");
  });
app.get(
  "/protected",
  {
    onRequest: requireAuthentication,
  },
  async (request) => {
    return {
      message: "You are authenticated.",
      user: request.user,
    };
  },
);

app.get(
  "/admin-only",
  {
    onRequest: requireRole("ADMIN"),
  },
  async (request) => {
    return {
      message: "You have administrator access.",
      user: request.user,
    };
  },
);


  return app;
}