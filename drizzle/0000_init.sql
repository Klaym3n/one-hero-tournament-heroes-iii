CREATE TYPE "public"."dispute_status" AS ENUM('OPEN', 'RESOLVED');--> statement-breakpoint
CREATE TYPE "public"."match_status" AS ENUM('WAITING', 'PENDING', 'REPORTED', 'DISPUTED', 'CONFIRMED', 'WALKOVER');--> statement-breakpoint
CREATE TYPE "public"."outbox_kind" AS ENUM('DM', 'CHANNEL');--> statement-breakpoint
CREATE TYPE "public"."participant_status" AS ENUM('ACTIVE', 'WITHDRAWN', 'BANNED');--> statement-breakpoint
CREATE TYPE "public"."tournament_phase" AS ENUM('DRAFT', 'REGISTRATION_OPEN', 'REGISTRATION_CLOSED', 'GROUPS', 'KNOCKOUT', 'FINISHED');--> statement-breakpoint
CREATE TYPE "public"."report_status" AS ENUM('SUBMITTED', 'ACCEPTED', 'REJECTED', 'SUPERSEDED');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('PLAYER', 'MODERATOR', 'ADMIN');--> statement-breakpoint
CREATE TYPE "public"."match_stage" AS ENUM('GROUP', 'KNOCKOUT', 'THIRD_PLACE');--> statement-breakpoint
CREATE TABLE "admin_audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"action" text NOT NULL,
	"entity_type" text,
	"entity_id" text,
	"payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "announcements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tournament_id" uuid NOT NULL,
	"title" text NOT NULL,
	"body_md" text NOT NULL,
	"pinned" boolean DEFAULT false NOT NULL,
	"published" boolean DEFAULT true NOT NULL,
	"author_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "availability_slots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "discord_outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "outbox_kind" NOT NULL,
	"target" text NOT NULL,
	"content" text NOT NULL,
	"fallback_content" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	"failed_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "disputes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" uuid NOT NULL,
	"opened_by_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"status" "dispute_status" DEFAULT 'OPEN' NOT NULL,
	"resolved_by_id" uuid,
	"resolution" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "group_members" (
	"group_id" uuid NOT NULL,
	"participant_id" uuid NOT NULL,
	"seat" integer NOT NULL,
	CONSTRAINT "group_members_group_id_participant_id_pk" PRIMARY KEY("group_id","participant_id")
);
--> statement-breakpoint
CREATE TABLE "groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tournament_id" uuid NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer NOT NULL,
	"manual_order" jsonb
);
--> statement-breakpoint
CREATE TABLE "heroes" (
	"slug" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"faction" text NOT NULL,
	"hero_class" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"image_url" text
);
--> statement-breakpoint
CREATE TABLE "map_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tournament_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "match_report_games" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" uuid NOT NULL,
	"game_no" integer NOT NULL,
	"winner_id" uuid NOT NULL,
	"map_template_id" uuid,
	"faction_a" text NOT NULL,
	"faction_b" text NOT NULL,
	"hero_a" text NOT NULL,
	"hero_b" text NOT NULL,
	"end_day" integer NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "match_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" uuid NOT NULL,
	"submitted_by_id" uuid NOT NULL,
	"by_staff" boolean DEFAULT false NOT NULL,
	"status" "report_status" DEFAULT 'SUBMITTED' NOT NULL,
	"winner_id" uuid NOT NULL,
	"score_a" integer NOT NULL,
	"score_b" integer NOT NULL,
	"summary" text,
	"vod_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone,
	"decided_by_id" uuid
);
--> statement-breakpoint
CREATE TABLE "match_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" uuid NOT NULL,
	"edited_by_id" uuid,
	"action" text NOT NULL,
	"reason" text,
	"before" jsonb,
	"after" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tournament_id" uuid NOT NULL,
	"stage" "match_stage" NOT NULL,
	"group_id" uuid,
	"round" integer,
	"position" integer,
	"group_round" integer,
	"player_a_id" uuid,
	"player_b_id" uuid,
	"best_of" integer NOT NULL,
	"status" "match_status" DEFAULT 'PENDING' NOT NULL,
	"winner_id" uuid,
	"score_a" integer DEFAULT 0 NOT NULL,
	"score_b" integer DEFAULT 0 NOT NULL,
	"scheduled_at" timestamp with time zone,
	"scheduled_by_id" uuid,
	"next_match_id" uuid,
	"next_slot" text,
	"loser_next_match_id" uuid,
	"loser_next_slot" text,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"href" text,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tournament_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"nick" text NOT NULL,
	"status" "participant_status" DEFAULT 'ACTIVE' NOT NULL,
	"rules_accepted_at" timestamp with time zone NOT NULL,
	"rules_version" integer NOT NULL,
	"privacy_accepted_at" timestamp with time zone NOT NULL,
	"privacy_version" integer NOT NULL,
	"youtube_url" text,
	"twitch_url" text,
	"kick_url" text,
	"bio" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "slot_proposals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" uuid NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"notified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tournaments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"phase" "tournament_phase" DEFAULT 'DRAFT' NOT NULL,
	"tagline" text DEFAULT '' NOT NULL,
	"banner_url" text,
	"info_md" text DEFAULT '' NOT NULL,
	"rules_md" text DEFAULT '' NOT NULL,
	"privacy_md" text DEFAULT '' NOT NULL,
	"prizes_md" text DEFAULT '' NOT NULL,
	"schedule_md" text DEFAULT '' NOT NULL,
	"format_md" text DEFAULT '' NOT NULL,
	"game_settings" jsonb DEFAULT '{"difficulty":"","turnTimer":"","handicap":"","other":""}'::jsonb NOT NULL,
	"rules_version" integer DEFAULT 1 NOT NULL,
	"privacy_version" integer DEFAULT 1 NOT NULL,
	"group_best_of" integer DEFAULT 3 NOT NULL,
	"knockout_best_of" integer DEFAULT 3 NOT NULL,
	"final_best_of" integer DEFAULT 5 NOT NULL,
	"third_place_best_of" integer DEFAULT 3 NOT NULL,
	"min_slot_minutes" integer DEFAULT 120 NOT NULL,
	"current_round_label" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tournaments_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"discord_id" text NOT NULL,
	"discord_username" text NOT NULL,
	"discord_global_name" text,
	"avatar_url" text,
	"role" "role" DEFAULT 'PLAYER' NOT NULL,
	"banned" boolean DEFAULT false NOT NULL,
	"discord_access_token" text,
	"discord_token_expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_login_at" timestamp with time zone,
	CONSTRAINT "users_discord_id_unique" UNIQUE("discord_id")
);
--> statement-breakpoint
ALTER TABLE "admin_audit_log" ADD CONSTRAINT "admin_audit_log_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "availability_slots" ADD CONSTRAINT "availability_slots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_opened_by_id_users_id_fk" FOREIGN KEY ("opened_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_resolved_by_id_users_id_fk" FOREIGN KEY ("resolved_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_participant_id_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "groups" ADD CONSTRAINT "groups_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "map_templates" ADD CONSTRAINT "map_templates_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_report_games" ADD CONSTRAINT "match_report_games_report_id_match_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."match_reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_report_games" ADD CONSTRAINT "match_report_games_winner_id_participants_id_fk" FOREIGN KEY ("winner_id") REFERENCES "public"."participants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_report_games" ADD CONSTRAINT "match_report_games_map_template_id_map_templates_id_fk" FOREIGN KEY ("map_template_id") REFERENCES "public"."map_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_reports" ADD CONSTRAINT "match_reports_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_reports" ADD CONSTRAINT "match_reports_submitted_by_id_users_id_fk" FOREIGN KEY ("submitted_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_reports" ADD CONSTRAINT "match_reports_winner_id_participants_id_fk" FOREIGN KEY ("winner_id") REFERENCES "public"."participants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_reports" ADD CONSTRAINT "match_reports_decided_by_id_users_id_fk" FOREIGN KEY ("decided_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_revisions" ADD CONSTRAINT "match_revisions_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_revisions" ADD CONSTRAINT "match_revisions_edited_by_id_users_id_fk" FOREIGN KEY ("edited_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_player_a_id_participants_id_fk" FOREIGN KEY ("player_a_id") REFERENCES "public"."participants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_player_b_id_participants_id_fk" FOREIGN KEY ("player_b_id") REFERENCES "public"."participants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_winner_id_participants_id_fk" FOREIGN KEY ("winner_id") REFERENCES "public"."participants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_scheduled_by_id_users_id_fk" FOREIGN KEY ("scheduled_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participants" ADD CONSTRAINT "participants_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participants" ADD CONSTRAINT "participants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slot_proposals" ADD CONSTRAINT "slot_proposals_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_created_idx" ON "admin_audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "availability_user_idx" ON "availability_slots" USING btree ("user_id","starts_at");--> statement-breakpoint
CREATE INDEX "outbox_pending_idx" ON "discord_outbox" USING btree ("sent_at","next_attempt_at");--> statement-breakpoint
CREATE INDEX "disputes_status_idx" ON "disputes" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "groups_name_uq" ON "groups" USING btree ("tournament_id","name");--> statement-breakpoint
CREATE INDEX "heroes_faction_idx" ON "heroes" USING btree ("faction");--> statement-breakpoint
CREATE UNIQUE INDEX "report_games_uq" ON "match_report_games" USING btree ("report_id","game_no");--> statement-breakpoint
CREATE INDEX "reports_match_idx" ON "match_reports" USING btree ("match_id");--> statement-breakpoint
CREATE INDEX "revisions_match_idx" ON "match_revisions" USING btree ("match_id");--> statement-breakpoint
CREATE INDEX "matches_tournament_idx" ON "matches" USING btree ("tournament_id","stage");--> statement-breakpoint
CREATE INDEX "matches_player_a_idx" ON "matches" USING btree ("player_a_id");--> statement-breakpoint
CREATE INDEX "matches_player_b_idx" ON "matches" USING btree ("player_b_id");--> statement-breakpoint
CREATE INDEX "matches_group_idx" ON "matches" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "notifications_user_idx" ON "notifications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "participants_user_tournament_uq" ON "participants" USING btree ("tournament_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "participants_nick_uq" ON "participants" USING btree ("tournament_id",lower("nick"));--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "slot_proposals_uq" ON "slot_proposals" USING btree ("match_id","starts_at");