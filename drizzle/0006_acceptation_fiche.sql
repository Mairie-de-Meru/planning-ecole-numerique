ALTER TABLE "conventions" ADD COLUMN "delivery_accepted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "conventions" ADD COLUMN "delivery_accepted_name" text;--> statement-breakpoint
ALTER TABLE "conventions" ADD COLUMN "delivery_accepted_method" text;--> statement-breakpoint
ALTER TABLE "conventions" ADD COLUMN "delivery_accepted_signature" text;--> statement-breakpoint
ALTER TABLE "conventions" ADD COLUMN "return_accepted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "conventions" ADD COLUMN "return_accepted_name" text;--> statement-breakpoint
ALTER TABLE "conventions" ADD COLUMN "return_accepted_method" text;--> statement-breakpoint
ALTER TABLE "conventions" ADD COLUMN "return_accepted_signature" text;--> statement-breakpoint
ALTER TABLE "conventions" ADD COLUMN "sheet_token_hash" text;