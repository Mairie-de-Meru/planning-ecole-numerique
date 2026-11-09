CREATE TYPE "public"."convention_status" AS ENUM('to_sign', 'signed', 'cancelled');--> statement-breakpoint
CREATE TABLE "convention_templates" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "convention_templates_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"body" text NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conventions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" integer GENERATED ALWAYS AS IDENTITY (sequence name "conventions_number_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"reservation_id" uuid NOT NULL,
	"template_id" integer,
	"status" "convention_status" DEFAULT 'to_sign' NOT NULL,
	"body" text NOT NULL,
	"signer_name" text,
	"signer_title" text,
	"signer_email" text,
	"signature_method" text,
	"signature_image" text,
	"signed_at" timestamp with time zone,
	"signed_ip" text,
	"email_copy" boolean DEFAULT false NOT NULL,
	"amendments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "conventions_reservation_id_unique" UNIQUE("reservation_id")
);
--> statement-breakpoint
ALTER TABLE "schools" ALTER COLUMN "email" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "inventory" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "replacement_value" integer;--> statement-breakpoint
ALTER TABLE "schools" ADD COLUMN "director_name" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "schools" ADD COLUMN "director_title" text DEFAULT 'Directrice' NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "lender_name" text DEFAULT 'Mairie de Méru' NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "lender_address" text DEFAULT 'Place de l''Hôtel de Ville, 60110 Méru' NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "it_service" text DEFAULT 'Service informatique de la Mairie de Méru' NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "it_contact" text DEFAULT '03 44 52 36 00' NOT NULL;--> statement-breakpoint
ALTER TABLE "conventions" ADD CONSTRAINT "conventions_reservation_id_reservations_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."reservations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conventions" ADD CONSTRAINT "conventions_template_id_convention_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."convention_templates"("id") ON DELETE no action ON UPDATE no action;