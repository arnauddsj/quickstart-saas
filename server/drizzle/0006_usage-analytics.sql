CREATE TABLE "activity_day" (
	"subject_id" text NOT NULL,
	"day" date NOT NULL,
	"signed_up_on" date NOT NULL,
	"organization_id" text
);
--> statement-breakpoint
CREATE TABLE "usage_event" (
	"id" text PRIMARY KEY NOT NULL,
	"subject_id" text NOT NULL,
	"organization_id" text,
	"type" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "activity_day" ADD CONSTRAINT "activity_day_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_event" ADD CONSTRAINT "usage_event_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "activity_day_subject_day_idx" ON "activity_day" USING btree ("subject_id","day");--> statement-breakpoint
CREATE INDEX "activity_day_day_idx" ON "activity_day" USING btree ("day");--> statement-breakpoint
CREATE INDEX "usage_event_type_created_idx" ON "usage_event" USING btree ("type","created_at");--> statement-breakpoint
CREATE INDEX "usage_event_subject_idx" ON "usage_event" USING btree ("subject_id");