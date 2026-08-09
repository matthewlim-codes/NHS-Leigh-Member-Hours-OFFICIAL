import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

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

export type AdminMessage = typeof adminMessagesTable.$inferSelect;
