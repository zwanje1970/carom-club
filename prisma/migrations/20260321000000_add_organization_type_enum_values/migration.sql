-- Add INSTRUCTOR and HOST to OrganizationType enum (used by Prisma schema)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'INSTRUCTOR' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'OrganizationType')) THEN
    ALTER TYPE "OrganizationType" ADD VALUE 'INSTRUCTOR';
  END IF;
END
$$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'HOST' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'OrganizationType')) THEN
    ALTER TYPE "OrganizationType" ADD VALUE 'HOST';
  END IF;
END
$$;
