import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import { adminMessagesTable, db, membersTable } from "@workspace/db";
import { GetDashboardResponse } from "@workspace/api-zod";
import { getMemberFromSheet } from "../lib/sheets";

const router: IRouter = Router();

const GRADE_10_ANNUAL_GOAL = 7;
const UPPER_GRADE_ANNUAL_GOAL = 20;
const UPPER_GRADE_SEMESTER_1_GOAL = 9;
const SENIOR_SEMESTER_1_GOAL = 8;
const UPPER_GRADE_SEMESTER_2_GOAL = 11;

router.get("/dashboard", async (req, res): Promise<void> => {
  if (!req.session.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const [member] = await db
    .select()
    .from(membersTable)
    .where(eq(membersTable.id, req.session.userId));

  if (!member) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const sheetMember = await getMemberFromSheet(member.username);

  if (!sheetMember) {
    res.status(404).json({ error: "Your record was not found in the spreadsheet. Please contact your administrator." });
    return;
  }

  res.json(GetDashboardResponse.parse({
    displayName: sheetMember.displayName,
    grade: sheetMember.grade,
    infoFormComplete: sheetMember.infoFormComplete,
    clubDuesPaid: sheetMember.clubDuesPaid,
    totalHours: sheetMember.hours,
    annualGoal: getAnnualGoal(sheetMember.grade),
    annualRemaining: getRemaining(sheetMember.hours, getAnnualGoal(sheetMember.grade)),
    semester1Hours: sheetMember.semester1Hours,
    semester1Goal: getSemester1Goal(sheetMember.grade),
    semester1Remaining: getRemaining(sheetMember.semester1Hours, getSemester1Goal(sheetMember.grade)),
    semester2Hours: sheetMember.semester2Hours,
    semester2Goal: getSemester2Goal(sheetMember.grade),
    semester2Remaining: getRemaining(sheetMember.semester2Hours, getSemester2Goal(sheetMember.grade)),
    monthlyHours: sheetMember.monthlyHours,
  }));
});

router.get("/dashboard/sheet-status", async (req, res): Promise<void> => {
  if (!req.session.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const [latestUpdate] = await db
    .select({ updatedAt: adminMessagesTable.createdAt })
    .from(adminMessagesTable)
    .where(eq(adminMessagesTable.category, "sheet_update"))
    .orderBy(desc(adminMessagesTable.createdAt))
    .limit(1);

  res.json({ updatedAt: latestUpdate?.updatedAt ?? null });
});

function getAnnualGoal(grade: number): number {
  return grade === 10 ? GRADE_10_ANNUAL_GOAL : UPPER_GRADE_ANNUAL_GOAL;
}

function getSemester1Goal(grade: number): number {
  if (grade === 10) return 0;
  return grade === 12 ? SENIOR_SEMESTER_1_GOAL : UPPER_GRADE_SEMESTER_1_GOAL;
}

function getSemester2Goal(grade: number): number {
  return grade === 10 ? 0 : UPPER_GRADE_SEMESTER_2_GOAL;
}

function getRemaining(hours: number, goal: number): number {
  return Math.max(0, roundHours(goal - hours));
}

function roundHours(hours: number): number {
  return Math.round(hours * 10) / 10;
}

export default router;
