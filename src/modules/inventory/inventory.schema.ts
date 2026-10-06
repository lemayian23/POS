import { z } from "zod";

export const adjustInventorySchema = z
  .object({
    quantity: z.number().int().positive(),
    type: z.enum(["ADJUSTMENT_IN", "ADJUSTMENT_OUT"]),
    notes: z.string().trim().max(500).optional(),
  })
  .strict();

export type AdjustInventoryInput = z.infer<
  typeof adjustInventorySchema
>;