import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const adminMessagesTable = pgTable("admin_messages", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  category: text("category").notNull().default("admin"),
  targetType: text("target_type").notNull().default("all"),
  targetValue: text("target_value"),
  createdBy: text("created_by").notNull().default("Admin"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const messageDismissalsTable = pgTable("message_dismissals", {
  id: serial("id").primaryKey(),
  messageId: integer("message_id")
    .notNull()
    .references(() => adminMessagesTable.id, { onDelete: "cascade" }),
  username: text("username").notNull(),
  dismissedAt: timestamp("dismissed_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AdminMessage = typeof adminMessagesTable.$inferSelect;
export type MessageDismissal = typeof messageDismissalsTable.$inferSelect;
