import { Router, type IRouter } from "express";
import { adminMessagesTable, db, type AdminMessage } from "@workspace/db";

const router: IRouter = Router();

router.get("/admin/summary", async (req, res): Promise<void> => {
  if (!requireAdmin(req, res)) return;

  const messages = await db.select().from(adminMessagesTable);

  const latestSheetUpdate = messages
    .filter((message) => message.category === "sheet_update")
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0] ?? null;

  res.json({
    stats: {
      latestSheetUpdate: latestSheetUpdate ? toAdminMessage(latestSheetUpdate) : null,
    },
  });
});

router.post("/admin/sheet-updated", async (req, res): Promise<void> => {
  if (!requireAdmin(req, res)) return;

  const [message] = await db
    .insert(adminMessagesTable)
    .values({
      title: "Hours sheet updated",
      body: "The hours sheet is up to date. Please check your dashboard for your latest hours.",
      category: "sheet_update",
      targetType: "all",
      targetValue: null,
      createdBy: req.session.username ?? "Admin",
    })
    .returning();

  res.status(201).json({ message: toAdminMessage(message) });
});

function requireAdmin(req: {
  session: { userId?: number; username?: string; role?: string };
}, res: { status: (n: number) => { json: (b: unknown) => void } }): boolean {
  if (!req.session.userId || !req.session.username) {
    res.status(401).json({ error: "Not authenticated" });
    return false;
  }
  if (req.session.role !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return false;
  }
  return true;
}

function toAdminMessage(message: AdminMessage) {
  return {
    id: message.id,
    title: message.title,
    body: message.body,
    category: message.category,
    createdAt: message.createdAt,
  };
}

export default router;
