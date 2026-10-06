import type { FastifyInstance } from "fastify";

import { requireAuthentication } from "../auth/auth.guard.js";
import { requireRole } from "../auth/role.guard.js";
import {
  createCategory,
  listCategories,
  updateCategory,
} from "./category.service.js";
import {
  createCategorySchema,
  updateCategorySchema,
} from "./category.schema.js";

export async function categoryRoutes(app: FastifyInstance) {
  app.get(
    "/categories",
    { onRequest: requireAuthentication },
    async (_request, reply) => {
      const categories = await listCategories();

      return reply.send({ categories });
    },
  );

  app.post(
    "/categories",
    { onRequest: requireRole("ADMIN") },
    async (request, reply) => {
      const result = createCategorySchema.safeParse(request.body);

      if (!result.success) {
        return reply.status(400).send({
          error: "VALIDATION_ERROR",
          message: "Invalid category data.",
        });
      }

      const category = await createCategory(result.data);

      return reply.status(201).send({ category });
    },
  );

  app.patch(
    "/categories/:id",
    { onRequest: requireRole("ADMIN") },
    async (request, reply) => {
      const result = updateCategorySchema.safeParse(request.body);

      if (!result.success) {
        return reply.status(400).send({
          error: "VALIDATION_ERROR",
          message: "Invalid category data.",
        });
      }

      const { id } = request.params as { id: string };

      const category = await updateCategory(id, result.data);

      return reply.send({ category });
    },
  );
}