import type { FastifyInstance } from "fastify";

import { requireAuthentication } from "../auth/auth.guard.js";
import { requireRole } from "../auth/role.guard.js";
import {
  adjustInventory,
  getInventory,
} from "./inventory.service.js";
import { adjustInventorySchema } from "./inventory.schema.js";

export async function inventoryRoutes(app: FastifyInstance) {
  app.get(
    "/inventory/:productId",
    { onRequest: requireAuthentication },
    async (request, reply) => {
      const { productId } = request.params as { productId: string };

      const inventory = await getInventory(productId);

      return reply.send({ inventory });
    },
  );

  app.post(
    "/inventory/:productId/adjust",
    { onRequest: requireRole("ADMIN") },
    async (request, reply) => {
      const result = adjustInventorySchema.safeParse(request.body);

      if (!result.success) {
        return reply.status(400).send({
          error: "VALIDATION_ERROR",
          message: "Invalid inventory adjustment data.",
        });
      }

      const { productId } = request.params as { productId: string };

      const resultData = await adjustInventory(
        productId,
        result.data,
        request.user.sub,
      );

      return reply.send(resultData);
    },
  );
}