import type { FastifyInstance } from "fastify";

import { requireAuthentication } from "../auth/auth.guard.js";
import { createSale } from "./sale.service.js";
import { createSaleSchema } from "./sale.schema.js";

export async function saleRoutes(app: FastifyInstance) {
  app.post(
    "/sales",
    { onRequest: requireAuthentication },
    async (request, reply) => {
      const result = createSaleSchema.safeParse(request.body);

      if (!result.success) {
        return reply.status(400).send({
          error: "VALIDATION_ERROR",
          message: "Invalid sale data.",
        });
      }

      const sale = await createSale(result.data, request.user.sub);

      return reply.status(201).send({ sale });
    },
  );
}
