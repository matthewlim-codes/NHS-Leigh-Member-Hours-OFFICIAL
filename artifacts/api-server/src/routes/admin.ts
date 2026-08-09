import { Router, type IRouter } from "express";
import { adminMessagesTable, db, type AdminMessage } from "@workspace/db";
import { listMembersFromSheet, type SheetMember } from "../lib/sheets";

const router: IRouter = Router();

const GRADE_10_ANNUAL_GOAL = 7;
const UPPER_GRADE_ANNUAL_GOAL = 20;

type AdminTargetType = "all" | "grade" | "usernames";

interface MessageInput {
  title: string;
  body: string;
  category: string;
  targetType: AdminTargetType;
  targetValue: string | null;
}

router.get("/admin/summary", async (req, res): Promise<void> => {
  if (!requireAdmin(req, res)) return;

  const [members, messages] = await Promise.all([
    listMembersFromSheet(),
    db.select().from(adminMessagesTable),
  ]);

  const latestSheetUpdate = messages
    .filter((message) => message.category === "sheet_update")
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0] ?? null;

  res.json({
    stats: {
      totalMembers: members.length,
      missingHours: members.filter((member) => getRemaining(member.hours, getAnnualGoal(member.grade)) > 0).length,
      unpaidDues: members.filter((member) => !member.clubDuesPaid).length,
      missingInfoForm: members.filter((member) => !member.infoFormComplete).length,
      latestSheetUpdate: latestSheetUpdate ? toAdminMessage(latestSheetUpdate) : null,
    },
    groups: buildGroups(members),
    members: members.map(toAdminMember),
    messages: messages
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 25)
      .map(toAdminMessage),
  });
});

router.post("/admin/messages", async (req, res): Promise<void> => {
  if (!requireAdmin(req, res)) return;

  const input = parseMessageInput(req.body);
  if (!input) {
    res.status(400).json({ error: "Invalid message request" });
    return;
  }

  const [message] = await db
    .insert(adminMessagesTable)
    .values({
      title: input.title,
      body: input.body,
      category: input.category,
      targetType: input.targetType,
      targetValue: input.targetValue,
      createdBy: req.session.username ?? "Admin",
    })
    .returning();

  res.status(201).json({ message: toAdminMessage(message) });
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

function parseMessageInput(body: unknown): MessageInput | null {
  if (!body || typeof body !== "object") return null;
  const value = body as Record<string, unknown>;
  const title = typeof value.title === "string" ? value.title.trim() : "";
  const messageBody = typeof value.body === "string" ? value.body.trim() : "";
  const category = normalizeCategory(value.category);
  const targetType = normalizeTargetType(value.targetType);

  if (!title || !messageBody || !targetType) return null;

  if (targetType === "all") {
    return { title, body: messageBody, category, targetType, targetValue: null };
  }

  if (targetType === "grade") {
    const grade = typeof value.grade === "string" || typeof value.grade === "number"
      ? String(value.grade).trim()
      : "";
    if (!["10", "11", "12"].includes(grade)) return null;
    return { title, body: messageBody, category, targetType, targetValue: grade };
  }

  const usernames = Array.isArray(value.usernames)
    ? value.usernames.map(String).map((username) => username.trim()).filter(Boolean)
    : [];
  if (usernames.length === 0) return null;

  return {
    title,
    body: messageBody,
    category,
    targetType,
    targetValue: JSON.stringify([...new Set(usernames)]),
  };
}

function normalizeCategory(value: unknown): string {
  if (value === "system" || value === "due_date" || value === "sheet_update") {
    return value;
  }
  return "admin";
}

function normalizeTargetType(value: unknown): AdminTargetType | null {
  if (value === "all" || value === "grade" || value === "usernames") {
    return value;
  }
  return null;
}

function buildGroups(members: SheetMember[]) {
  return [
    buildGradeGroup("sophomores", "Sophomores", 10, members),
    buildGradeGroup("juniors", "Juniors", 11, members),
    buildGradeGroup("seniors", "Seniors", 12, members),
  ];
}

function buildGradeGroup(id: string, label: string, grade: number, members: SheetMember[]) {
  const groupMembers = members.filter((member) => member.grade === grade);
  return {
    id,
    label,
    grade,
    count: groupMembers.length,
    usernames: groupMembers.map((member) => member.username),
  };
}

function toAdminMember(member: SheetMember) {
  const annualGoal = getAnnualGoal(member.grade);
  return {
    username: member.username,
    displayName: member.displayName,
    grade: member.grade,
    totalHours: member.hours,
    annualGoal,
    annualRemaining: getRemaining(member.hours, annualGoal),
    infoFormComplete: member.infoFormComplete,
    clubDuesPaid: member.clubDuesPaid,
  };
}

function toAdminMessage(message: AdminMessage) {
  return {
    id: message.id,
    title: message.title,
    body: message.body,
    category: message.category,
    targetType: message.targetType,
    targetValue: message.targetValue,
    createdBy: message.createdBy,
    createdAt: message.createdAt,
  };
}

function getAnnualGoal(grade: number): number {
  return grade === 10 ? GRADE_10_ANNUAL_GOAL : UPPER_GRADE_ANNUAL_GOAL;
}

function getRemaining(hours: number, goal: number): number {
  return Math.max(0, Math.round((goal - hours) * 10) / 10);
}

export default router;
