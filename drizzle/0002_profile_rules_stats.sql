CREATE TABLE "page_views" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"path" text NOT NULL,
	"visitor" text NOT NULL,
	"user_id" uuid,
	"referrer" text,
	"mobile" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN "rules_version_label" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN "rules_updated_at" date;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "nick" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "youtube_url" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "twitch_url" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "kick_url" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "bio" text;--> statement-breakpoint
ALTER TABLE "page_views" ADD CONSTRAINT "page_views_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "page_views_created_idx" ON "page_views" USING btree ("created_at");--> statement-breakpoint
-- profil konta uzupełniony danymi z dotychczasowych zgłoszeń turniejowych
UPDATE "users" u SET "nick" = p."nick", "youtube_url" = p."youtube_url", "twitch_url" = p."twitch_url", "kick_url" = p."kick_url", "bio" = p."bio"
FROM (SELECT DISTINCT ON ("user_id") * FROM "participants" ORDER BY "user_id", "created_at" DESC) p
WHERE p."user_id" = u."id";
