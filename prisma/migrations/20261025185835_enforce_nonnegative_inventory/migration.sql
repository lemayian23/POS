-- Enforce nonnegative inventory quantities.
ALTER TABLE "inventory_items"
ADD CONSTRAINT "inventory_items_quantity_nonnegative_check"
CHECK ("quantity" >= 0);
