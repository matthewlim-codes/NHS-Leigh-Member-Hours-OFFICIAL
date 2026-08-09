import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import {
  adminMessagesTable,
  db,
  messageDismissalsTable,
  type AdminMessage,
  type MessageDismissal,
} from "@workspace/db";
import { getMemberFromSheet, type SheetMember } from "../lib/sheets";

const router: IRouter = Router();

interface StudentMessage {
  id: number;
  title: string;
  body: string;
  category: string;
  createdBy: string;
  createdAt: Date;
  dismissedAt: Date | null;
  unread: boolean;
}

router.get("/messages", async (req, res): Promise<void> => {
  const username = requireMember(req, res);
  if (!username) return;

  const sheetMember = await getMemberFromSheet(username);
  const [messages, dismissals] = await Promise.all([
    db.select().from(adminMessagesTable),
    db
      .select()
      .from(messageDismissalsTable)
      .where(eq(messageDismissalsTable.username, username)),
  ]);

  const visibleMessages = messages
    .filter((message) => isMessageForMember(message, username, sheetMember))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .map((message) => toStudentMessage(message, dismissals));

  res.json({
    unreadCount: visibleMessages.filter((message) => message.unread).length,
    messages: visibleMessages,
  });
});

router.post("/messages/:id/dismiss", async (req, res): Promise<void> => {
  const username = requireMember(req, res);
  if (!username) return;

  const messageId = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(messageId)) {
    res.status(400).json({ error: "Invalid message id" });
    return;
  }

  const [message] = await db
    .select()
    .from(adminMessagesTable)
    .where(eq(adminMessagesTable.id, messageId));

  if (!message) {
    res.status(404).json({ error: "Message not found" });
    return;
  }

  const existing = await db
    .select()
    .from(messageDismissalsTable)
    .where(
      and(
        eq(messageDismissalsTable.messageId, messageId),
        eq(messageDismissalsTable.username, username),
      ),
    );

  if (existing.length === 0) {
    await db.insert(messageDismissalsTable).values({
      messageId,
      username,
    });
  }

  res.json({ success: true });
});

function requireMember(req: {
  session: { userId?: number; username?: string; role?: string };
}, res: { status: (n: number) => { json: (b: unknown) => void } }): string | null {
  if (!req.session.userId || !req.session.username) {
    res.status(401).json({ error: "Not authenticated" });
    return null;
  }
  if (req.session.role === "admin") {
    res.status(403).json({ error: "Member access required" });
    return null;
  }
  return req.session.username;
}

function toStudentMessage(
  message: AdminMessage,
  dismissals: MessageDismissal[],
): StudentMessage {
  const dismissal = dismissals.find((item) => item.messageId === message.id);

  return {
    id: message.id,
    title: message.title,
    body: message.body,
    category: message.category,
    createdBy: message.createdBy,
    createdAt: message.createdAt,
    dismissedAt: dismissal?.dismissedAt ?? null,
    unread: !dismissal,
  };
}

function isMessageForMember(
  message: AdminMessage,
  username: string,
  sheetMember: SheetMember | null,
): boolean {
  if (message.targetType === "all") return true;
  if (message.targetType === "grade") {
    return Boolean(sheetMember && String(sheetMember.grade) === message.targetValue);
  }
  if (message.targetType === "usernames") {
    return parseTargetUsernames(message.targetValue).includes(username);
  }
  return false;
}

function parseTargetUsernames(targetValue: string | null): string[] {
  if (!targetValue) return [];
  try {
    const parsed = JSON.parse(targetValue) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.map(String);
    }
  } catch {
    // Ignore invalid legacy target values.
  }
  return [];
}

export default router;
