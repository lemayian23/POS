import type { FastifyInstance } from "fastify";

import { requireAuthentication } from "../auth/auth.guard.js";
import { requireRole } from "../auth/role.guard.js";

import {
  createProductSchema,
  updateProductSchema,
} from "./product.schema.js";

import { listProductsSchema } from "./product-list.schema.js";

import {
  createProduct,
  listProductsPaginated,
  updateProduct,
} from "./product.service.js";

export async function productRoutes(app: FastifyInstance) {
  app.get(
    "/products",
    {
      onRequest: requireAuthentication,
    },
    async (request, reply) => {
      const result = listProductsSchema.safeParse(request.query);

      if (!result.success) {
        return reply.status(400).send({
          error: "VALIDATION_ERROR",
          message: "Invalid product listing parameters.",
          details: result.error.flatten(),
        });
      }

      const products = await listProductsPaginated(result.data);

      return reply.send(products);
    },
  );

  app.post(
    "/products",
    {
      onRequest: requireRole("ADMIN"),
    },
    async (request, reply) => {
      const result = createProductSchema.safeParse(request.body);

      if (!result.success) {
        return reply.status(400).send({
          error: "VALIDATION_ERROR",
          message: "Invalid product data.",
          details: result.error.flatten(),
        });
      }

      const product = await createProduct(result.data);

      return reply.status(201).send({
        product,
      });
    },
  );

  app.patch(
    "/products/:id",
    {
      onRequest: requireRole("ADMIN"),
    },
    async (request, reply) => {
      const params = request.params as { id: string };

      const result = updateProductSchema.safeParse(request.body);

      if (!result.success) {
        return reply.status(400).send({
          error: "VALIDATION_ERROR",
          message: "Invalid product data.",
          details: result.error.flatten(),
        });
      }

      const product = await updateProduct(params.id, result.data);

      return reply.send({
        product,
      });
    },
  );
}