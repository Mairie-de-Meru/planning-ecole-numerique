import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  index,
} from "drizzle-orm/pg-core";

export const reservationStatus = pgEnum("reservation_status", [
  "pending",
  "confirmed",
  "cancelled",
  "expired",
]);

export const periodSource = pgEnum("period_source", ["auto", "manual"]);

/** Une seule ligne (id = 1) : paramètres modifiables par l'admin. */
export const settings = pgTable("settings", {
  id: integer("id").primaryKey().default(1),
  zone: text("zone").notNull().default("B"),
  sourceUrl: text("source_url")
    .notNull()
    .default("https://www.service-public.gouv.fr/particuliers/vosdroits/F31952"),
  syncEnabled: boolean("sync_enabled").notNull().default(true),
  confirmTtlMinutes: integer("confirm_ttl_minutes").notNull().default(30),
  maxPerSchoolPerPeriod: integer("max_per_school_per_period").notNull().default(0),
  notifyAdmin: boolean("notify_admin").notNull().default(true),
  appName: text("app_name").notNull().default("Valises pédagogiques"),
  lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
  lastSyncStatus: text("last_sync_status"),
});

export const admins = pgTable("admins", {
  email: text("email").primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Adresse exacte (ecole@exemple.fr) ou domaine (@ac-amiens.fr). */
export const allowlist = pgTable("allowlist", {
  id: uuid("id").primaryKey().defaultRandom(),
  pattern: text("pattern").notNull().unique(),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const schools = pgTable("schools", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name").notNull().default(""),
  address: text("address").notNull().default(""),
  contactName: text("contact_name").notNull().default(""),
  phone: text("phone").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const items = pgTable("items", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  contents: text("contents").notNull().default(""),
  photoUrl: text("photo_url"),
  color: text("color"),
  active: boolean("active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const periods = pgTable(
  "periods",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolYear: text("school_year").notNull(), // "2026-2027"
    position: integer("position").notNull(), // 1..5
    label: text("label").notNull(),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    zone: text("zone").notNull(),
    source: periodSource("source").notNull().default("manual"),
    locked: boolean("locked").notNull().default(false),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("periods_year_pos_zone").on(t.schoolYear, t.position, t.zone)],
);

export const periodProposals = pgTable("period_proposals", {
  id: uuid("id").primaryKey().defaultRandom(),
  zone: text("zone").notNull(),
  payload: jsonb("payload").notNull(), // ProposalChange[]
  status: text("status").notNull().default("pending"), // pending | applied | rejected
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
});

export const reservations = pgTable(
  "reservations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    itemId: uuid("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "restrict" }),
    periodId: uuid("period_id")
      .notNull()
      .references(() => periods.id, { onDelete: "restrict" }),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "restrict" }),
    status: reservationStatus("status").notNull().default("pending"),
    confirmTokenHash: text("confirm_token_hash"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Premier réservé, premier servi : une seule réservation active par valise et par période.
    uniqueIndex("one_booking_per_slot")
      .on(t.itemId, t.periodId)
      .where(sql`status in ('pending', 'confirmed')`),
    index("reservations_school").on(t.schoolId),
    index("reservations_token").on(t.confirmTokenHash),
  ],
);

export const loginTokens = pgTable("login_tokens", {
  tokenHash: text("token_hash").primaryKey(),
  email: text("email").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
});

export const auditLog = pgTable("audit_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  actor: text("actor").notNull(),
  action: text("action").notNull(),
  reservationId: uuid("reservation_id"),
  details: jsonb("details"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Settings = typeof settings.$inferSelect;
export type School = typeof schools.$inferSelect;
export type Item = typeof items.$inferSelect;
export type Period = typeof periods.$inferSelect;
export type Reservation = typeof reservations.$inferSelect;

/** Journal des e-mails (utile pour vérifier les envois ; contient les liens en mode test). */
export const mailLog = pgTable("mail_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  to: text("to").notNull(),
  subject: text("subject").notNull(),
  text: text("text").notNull(),
  html: text("html").notNull(),
  delivered: boolean("delivered").notNull(),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
