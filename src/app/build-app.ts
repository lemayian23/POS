import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";

import { env } from "../config/env.js";
import { registerJwt } from "../plugins/jwt.js";
import { authRoutes } from "../modules/auth/auth.routes.js";
import { requireAuthentication } from "../modules/auth/auth.guard.js";
import { requireRole } from "../modules/auth/role.guard.js";
import { errorHandler } from "./error-handler.js";
import rateLimit from "@fastify/rate-limit";
import cookie from "@fastify/cookie";
import { productRoutes } from "../modules/products/product.routes.js";

export async function buildApp() {
  const app = Fastify({
    logger: true,
  });


  app.setErrorHandler(errorHandler);

  await app.register(rateLimit, {
    global: false,
    max: 100,
    timeWindow: "1 minute",
  });

  await app.register(helmet);

  await app.register(cors, {
    origin: env.CORS_ORIGIN,
  });

  await registerJwt(app);

  await app.register(authRoutes);
  
  await app.register(productRoutes);

  await app.register(cookie);

  app.get("/health", async () => {
    return {
      status: "ok",
    };
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