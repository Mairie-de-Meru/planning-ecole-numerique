ALTER TABLE "settings" ALTER COLUMN "lender_name" SET DEFAULT 'Ville de Méru';--> statement-breakpoint
ALTER TABLE "settings" ALTER COLUMN "lender_address" SET DEFAULT 'Hôtel de Ville, BP 129, 60111 Méru Cedex';--> statement-breakpoint
ALTER TABLE "settings" ALTER COLUMN "it_service" SET DEFAULT 'service informatique de la Ville de Méru';--> statement-breakpoint
ALTER TABLE "settings" ALTER COLUMN "it_contact" SET DEFAULT 'Alain MARTINEZ, 03 44 52 34 14';--> statement-breakpoint
ALTER TABLE "conventions" ADD COLUMN "storage_location" text;--> statement-breakpoint
ALTER TABLE "conventions" ADD COLUMN "loan_sheet" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "conventions" ADD COLUMN "delivered_at" date;--> statement-breakpoint
ALTER TABLE "conventions" ADD COLUMN "delivered_by" text;--> statement-breakpoint
ALTER TABLE "conventions" ADD COLUMN "delivery_note" text;--> statement-breakpoint
ALTER TABLE "conventions" ADD COLUMN "returned_at" date;--> statement-breakpoint
ALTER TABLE "conventions" ADD COLUMN "returned_by" text;--> statement-breakpoint
ALTER TABLE "conventions" ADD COLUMN "return_note" text;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "lender_representative" text DEFAULT 'Madame Nathalie RAVIER, Maire' NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "lender_signatory_name" text DEFAULT 'Gildas DUMONT' NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "lender_signatory_title" text DEFAULT 'Technicien informatique' NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "split_june" boolean DEFAULT true NOT NULL;--> statement-breakpoint
UPDATE "settings" SET "lender_name" = 'Ville de Méru', "lender_address" = 'Hôtel de Ville, BP 129, 60111 Méru Cedex', "it_service" = 'service informatique de la Ville de Méru', "it_contact" = 'Alain MARTINEZ, 03 44 52 34 14' WHERE "lender_name" = 'Mairie de Méru';
