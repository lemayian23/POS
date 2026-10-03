-- Add the refresh-token family column as nullable first
-- so existing refresh tokens can be backfilled safely.
ALTER TABLE "refresh_tokens"
ADD COLUMN "familyId" UUID;

-- Existing tokens are assigned to their own family.
UPDATE "refresh_tokens"
SET "familyId" = gen_random_uuid()
WHERE "familyId" IS NULL;

-- Every refresh token must belong to a family.
ALTER TABLE "refresh_tokens"
ALTER COLUMN "familyId" SET NOT NULL;

-- Speed up family-wide revocation and lookup.
CREATE INDEX "refresh_tokens_familyId_idx"
ON "refresh_tokens"("familyId");