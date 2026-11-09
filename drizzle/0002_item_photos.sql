CREATE TABLE "item_photos" (
	"item_id" uuid PRIMARY KEY NOT NULL,
	"mime" text NOT NULL,
	"data" "bytea" NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "settings" ALTER COLUMN "app_name" SET DEFAULT 'Mallettes pédagogiques';--> statement-breakpoint
ALTER TABLE "item_photos" ADD CONSTRAINT "item_photos_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
UPDATE "settings" SET "app_name" = 'Mallettes pédagogiques' WHERE "app_name" = 'Valises pédagogiques';
