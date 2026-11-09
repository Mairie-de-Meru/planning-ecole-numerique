ALTER TABLE "settings" ALTER COLUMN "lender_representative" SET DEFAULT 'Monsieur Abdelafid MOKHTARI, Maire';--> statement-breakpoint
UPDATE "settings" SET "lender_representative" = 'Monsieur Abdelafid MOKHTARI, Maire' WHERE "lender_representative" = 'Madame Nathalie RAVIER, Maire';
