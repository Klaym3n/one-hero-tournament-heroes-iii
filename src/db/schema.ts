import { relations, sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const id = () => uuid("id").primaryKey().defaultRandom();
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const ts = (name: string) => timestamp(name, { withTimezone: true });

// ---------- Enumy ----------
export const roleEnum = pgEnum("role", ["PLAYER", "MODERATOR", "ADMIN"]);
export const phaseEnum = pgEnum("tournament_phase", [
  "DRAFT",
  "REGISTRATION_OPEN",
  "REGISTRATION_CLOSED",
  "GROUPS",
  "KNOCKOUT",
  "FINISHED",
]);
export const participantStatusEnum = pgEnum("participant_status", ["ACTIVE", "WITHDRAWN", "BANNED"]);
export const stageEnum = pgEnum("match_stage", ["GROUP", "KNOCKOUT", "THIRD_PLACE"]);
export const matchStatusEnum = pgEnum("match_status", [
  "WAITING", // drabinka: czeka na zwycięzców poprzednich meczów
  "PENDING", // do rozegrania
  "REPORTED", // raport złożony, czeka na potwierdzenie
  "DISPUTED", // spór – decyzja moderatora
  "CONFIRMED",
  "WALKOVER",
]);
export const reportStatusEnum = pgEnum("report_status", ["SUBMITTED", "ACCEPTED", "REJECTED", "SUPERSEDED"]);
export const disputeStatusEnum = pgEnum("dispute_status", ["OPEN", "RESOLVED"]);
export const outboxKindEnum = pgEnum("outbox_kind", ["DM", "CHANNEL"]);

// ---------- Użytkownicy i sesje ----------
export const users = pgTable("users", {
  id: id(),
  discordId: text("discord_id").notNull().unique(),
  discordUsername: text("discord_username").notNull(),
  discordGlobalName: text("discord_global_name"),
  avatarUrl: text("avatar_url"),
  role: roleEnum("role").notNull().default("PLAYER"),
  banned: boolean("banned").notNull().default(false),
  // token OAuth – potrzebny do automatycznego dodania na serwer (scope guilds.join)
  discordAccessToken: text("discord_access_token"),
  discordTokenExpiresAt: ts("discord_token_expires_at"),
  createdAt: createdAt(),
  lastLoginAt: ts("last_login_at"),
});

export const sessions = pgTable(
  "sessions",
  {
    // sha256 tokenu z ciasteczka – sam token nie trafia do bazy
    id: text("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: ts("expires_at").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

// ---------- Turniej ----------
export type TournamentRules = {
  difficulty: string;
  turnTimer: string;
  handicap: string;
  other: string;
};

export const tournaments = pgTable("tournaments", {
  id: id(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  phase: phaseEnum("phase").notNull().default("DRAFT"),
  tagline: text("tagline").notNull().default(""),
  bannerUrl: text("banner_url"),
  // Treści markdown edytowalne w panelu
  infoMd: text("info_md").notNull().default(""),
  rulesMd: text("rules_md").notNull().default(""),
  privacyMd: text("privacy_md").notNull().default(""),
  prizesMd: text("prizes_md").notNull().default(""),
  scheduleMd: text("schedule_md").notNull().default(""),
  formatMd: text("format_md").notNull().default(""),
  gameSettings: jsonb("game_settings").$type<TournamentRules>().notNull().default({
    difficulty: "",
    turnTimer: "",
    handicap: "",
    other: "",
  }),
  rulesVersion: integer("rules_version").notNull().default(1),
  privacyVersion: integer("privacy_version").notNull().default(1),
  groupBestOf: integer("group_best_of").notNull().default(3),
  knockoutBestOf: integer("knockout_best_of").notNull().default(3),
  finalBestOf: integer("final_best_of").notNull().default(5),
  thirdPlaceBestOf: integer("third_place_best_of").notNull().default(3),
  minSlotMinutes: integer("min_slot_minutes").notNull().default(120),
  currentRoundLabel: text("current_round_label"),
  createdAt: createdAt(),
});

export const participants = pgTable(
  "participants",
  {
    id: id(),
    tournamentId: uuid("tournament_id")
      .notNull()
      .references(() => tournaments.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    nick: text("nick").notNull(),
    status: participantStatusEnum("status").notNull().default("ACTIVE"),
    rulesAcceptedAt: ts("rules_accepted_at").notNull(),
    rulesVersion: integer("rules_version").notNull(),
    privacyAcceptedAt: ts("privacy_accepted_at").notNull(),
    privacyVersion: integer("privacy_version").notNull(),
    youtubeUrl: text("youtube_url"),
    twitchUrl: text("twitch_url"),
    kickUrl: text("kick_url"),
    bio: text("bio"),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("participants_user_tournament_uq").on(t.tournamentId, t.userId),
    uniqueIndex("participants_nick_uq").on(t.tournamentId, sql`lower(${t.nick})`),
  ],
);

export const mapTemplates = pgTable("map_templates", {
  id: id(),
  tournamentId: uuid("tournament_id")
    .notNull()
    .references(() => tournaments.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  active: boolean("active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: createdAt(),
});

export const heroes = pgTable(
  "heroes",
  {
    slug: text("slug").primaryKey(),
    name: text("name").notNull(),
    faction: text("faction").notNull(),
    heroClass: integer("hero_class").notNull().default(0),
    active: boolean("active").notNull().default(true),
    imageUrl: text("image_url"),
  },
  (t) => [index("heroes_faction_idx").on(t.faction)],
);

export const groups = pgTable(
  "groups",
  {
    id: id(),
    tournamentId: uuid("tournament_id")
      .notNull()
      .references(() => tournaments.id, { onDelete: "cascade" }),
    name: text("name").notNull(), // "A", "B", ...
    sortOrder: integer("sort_order").notNull(),
    // ręczne rozstrzygnięcie remisu przez admina: kolejność participantId
    manualOrder: jsonb("manual_order").$type<string[] | null>(),
  },
  (t) => [uniqueIndex("groups_name_uq").on(t.tournamentId, t.name)],
);

export const groupMembers = pgTable(
  "group_members",
  {
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    participantId: uuid("participant_id")
      .notNull()
      .references(() => participants.id, { onDelete: "cascade" }),
    seat: integer("seat").notNull(),
  },
  (t) => [primaryKey({ columns: [t.groupId, t.participantId] })],
);

export const matches = pgTable(
  "matches",
  {
    id: id(),
    tournamentId: uuid("tournament_id")
      .notNull()
      .references(() => tournaments.id, { onDelete: "cascade" }),
    stage: stageEnum("stage").notNull(),
    groupId: uuid("group_id").references(() => groups.id, { onDelete: "cascade" }),
    // drabinka: runda 1 = pierwsza runda pucharu; pozycja w rundzie od 0
    round: integer("round"),
    position: integer("position"),
    // grupa: numer kolejki round-robin
    groupRound: integer("group_round"),
    playerAId: uuid("player_a_id").references(() => participants.id),
    playerBId: uuid("player_b_id").references(() => participants.id),
    bestOf: integer("best_of").notNull(),
    status: matchStatusEnum("status").notNull().default("PENDING"),
    winnerId: uuid("winner_id").references(() => participants.id),
    scoreA: integer("score_a").notNull().default(0),
    scoreB: integer("score_b").notNull().default(0),
    scheduledAt: ts("scheduled_at"),
    scheduledById: uuid("scheduled_by_id").references(() => users.id),
    nextMatchId: uuid("next_match_id"),
    nextSlot: text("next_slot", { enum: ["A", "B"] }),
    loserNextMatchId: uuid("loser_next_match_id"),
    loserNextSlot: text("loser_next_slot", { enum: ["A", "B"] }),
    completedAt: ts("completed_at"),
    createdAt: createdAt(),
  },
  (t) => [
    index("matches_tournament_idx").on(t.tournamentId, t.stage),
    index("matches_player_a_idx").on(t.playerAId),
    index("matches_player_b_idx").on(t.playerBId),
    index("matches_group_idx").on(t.groupId),
  ],
);

export const matchReports = pgTable(
  "match_reports",
  {
    id: id(),
    matchId: uuid("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    submittedById: uuid("submitted_by_id")
      .notNull()
      .references(() => users.id),
    // true = raport/korekta wprowadzona przez moderatora lub administratora
    byStaff: boolean("by_staff").notNull().default(false),
    status: reportStatusEnum("status").notNull().default("SUBMITTED"),
    winnerId: uuid("winner_id")
      .notNull()
      .references(() => participants.id),
    scoreA: integer("score_a").notNull(),
    scoreB: integer("score_b").notNull(),
    summary: text("summary"),
    vodUrl: text("vod_url"),
    createdAt: createdAt(),
    decidedAt: ts("decided_at"),
    decidedById: uuid("decided_by_id").references(() => users.id),
  },
  (t) => [index("reports_match_idx").on(t.matchId)],
);

export const matchReportGames = pgTable(
  "match_report_games",
  {
    id: id(),
    reportId: uuid("report_id")
      .notNull()
      .references(() => matchReports.id, { onDelete: "cascade" }),
    gameNo: integer("game_no").notNull(),
    winnerId: uuid("winner_id")
      .notNull()
      .references(() => participants.id),
    mapTemplateId: uuid("map_template_id").references(() => mapTemplates.id, { onDelete: "set null" }),
    factionA: text("faction_a").notNull(),
    factionB: text("faction_b").notNull(),
    heroA: text("hero_a").notNull(),
    heroB: text("hero_b").notNull(),
    // indeks dnia gry (1 = 111); prezentowany jako MWD
    endDay: integer("end_day").notNull(),
    notes: text("notes"),
  },
  (t) => [uniqueIndex("report_games_uq").on(t.reportId, t.gameNo)],
);

export const matchRevisions = pgTable(
  "match_revisions",
  {
    id: id(),
    matchId: uuid("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    editedById: uuid("edited_by_id").references(() => users.id),
    action: text("action").notNull(), // REPORT_SUBMITTED, REPORT_ACCEPTED, DISPUTE_OPENED, STAFF_EDIT, ...
    reason: text("reason"),
    before: jsonb("before"),
    after: jsonb("after"),
    createdAt: createdAt(),
  },
  (t) => [index("revisions_match_idx").on(t.matchId)],
);

export const disputes = pgTable(
  "disputes",
  {
    id: id(),
    matchId: uuid("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    openedById: uuid("opened_by_id")
      .notNull()
      .references(() => users.id),
    reason: text("reason").notNull(),
    status: disputeStatusEnum("status").notNull().default("OPEN"),
    resolvedById: uuid("resolved_by_id").references(() => users.id),
    resolution: text("resolution"),
    createdAt: createdAt(),
    resolvedAt: ts("resolved_at"),
  },
  (t) => [index("disputes_status_idx").on(t.status)],
);

// ---------- Terminy ----------
export const availabilitySlots = pgTable(
  "availability_slots",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    startsAt: ts("starts_at").notNull(),
    endsAt: ts("ends_at").notNull(),
  },
  (t) => [index("availability_user_idx").on(t.userId, t.startsAt)],
);

export const slotProposals = pgTable(
  "slot_proposals",
  {
    id: id(),
    matchId: uuid("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    startsAt: ts("starts_at").notNull(),
    endsAt: ts("ends_at").notNull(),
    notifiedAt: ts("notified_at"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("slot_proposals_uq").on(t.matchId, t.startsAt)],
);

// ---------- Powiadomienia ----------
export const notifications = pgTable(
  "notifications",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull().default(""),
    href: text("href"),
    readAt: ts("read_at"),
    createdAt: createdAt(),
  },
  (t) => [index("notifications_user_idx").on(t.userId, t.createdAt)],
);

export const discordOutbox = pgTable(
  "discord_outbox",
  {
    id: id(),
    kind: outboxKindEnum("kind").notNull(),
    // DM: discord user id; CHANNEL: channel id
    target: text("target").notNull(),
    content: text("content").notNull(),
    // dla DM: treść awaryjna na kanał, jeśli DM zablokowane
    fallbackContent: text("fallback_content"),
    attempts: integer("attempts").notNull().default(0),
    nextAttemptAt: ts("next_attempt_at").notNull().defaultNow(),
    sentAt: ts("sent_at"),
    failedAt: ts("failed_at"),
    lastError: text("last_error"),
    createdAt: createdAt(),
  },
  (t) => [index("outbox_pending_idx").on(t.sentAt, t.nextAttemptAt)],
);

export const announcements = pgTable("announcements", {
  id: id(),
  tournamentId: uuid("tournament_id")
    .notNull()
    .references(() => tournaments.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  bodyMd: text("body_md").notNull(),
  pinned: boolean("pinned").notNull().default(false),
  published: boolean("published").notNull().default(true),
  authorId: uuid("author_id").references(() => users.id),
  createdAt: createdAt(),
});

export const adminAuditLog = pgTable(
  "admin_audit_log",
  {
    id: id(),
    actorId: uuid("actor_id").references(() => users.id),
    action: text("action").notNull(),
    entityType: text("entity_type"),
    entityId: text("entity_id"),
    payload: jsonb("payload"),
    createdAt: createdAt(),
  },
  (t) => [index("audit_created_idx").on(t.createdAt)],
);

// ---------- Relacje ----------
export const usersRelations = relations(users, ({ many }) => ({
  participants: many(participants),
}));

export const participantsRelations = relations(participants, ({ one }) => ({
  user: one(users, { fields: [participants.userId], references: [users.id] }),
  tournament: one(tournaments, { fields: [participants.tournamentId], references: [tournaments.id] }),
}));

export const groupsRelations = relations(groups, ({ many }) => ({
  members: many(groupMembers),
  matches: many(matches),
}));

export const groupMembersRelations = relations(groupMembers, ({ one }) => ({
  group: one(groups, { fields: [groupMembers.groupId], references: [groups.id] }),
  participant: one(participants, { fields: [groupMembers.participantId], references: [participants.id] }),
}));

export const matchesRelations = relations(matches, ({ one, many }) => ({
  group: one(groups, { fields: [matches.groupId], references: [groups.id] }),
  playerA: one(participants, { fields: [matches.playerAId], references: [participants.id], relationName: "playerA" }),
  playerB: one(participants, { fields: [matches.playerBId], references: [participants.id], relationName: "playerB" }),
  reports: many(matchReports),
  disputes: many(disputes),
  revisions: many(matchRevisions),
  proposals: many(slotProposals),
}));

export const matchReportsRelations = relations(matchReports, ({ one, many }) => ({
  match: one(matches, { fields: [matchReports.matchId], references: [matches.id] }),
  submittedBy: one(users, { fields: [matchReports.submittedById], references: [users.id] }),
  games: many(matchReportGames),
}));

export const matchReportGamesRelations = relations(matchReportGames, ({ one }) => ({
  report: one(matchReports, { fields: [matchReportGames.reportId], references: [matchReports.id] }),
  mapTemplate: one(mapTemplates, { fields: [matchReportGames.mapTemplateId], references: [mapTemplates.id] }),
}));

export const disputesRelations = relations(disputes, ({ one }) => ({
  match: one(matches, { fields: [disputes.matchId], references: [matches.id] }),
  openedBy: one(users, { fields: [disputes.openedById], references: [users.id] }),
}));

export const matchRevisionsRelations = relations(matchRevisions, ({ one }) => ({
  match: one(matches, { fields: [matchRevisions.matchId], references: [matches.id] }),
  editedBy: one(users, { fields: [matchRevisions.editedById], references: [users.id] }),
}));

export const slotProposalsRelations = relations(slotProposals, ({ one }) => ({
  match: one(matches, { fields: [slotProposals.matchId], references: [matches.id] }),
}));

export type User = typeof users.$inferSelect;
export type Tournament = typeof tournaments.$inferSelect;
export type Participant = typeof participants.$inferSelect;
export type Match = typeof matches.$inferSelect;
export type MapTemplate = typeof mapTemplates.$inferSelect;
export type Hero = typeof heroes.$inferSelect;
export type Role = (typeof roleEnum.enumValues)[number];
export type Phase = (typeof phaseEnum.enumValues)[number];
