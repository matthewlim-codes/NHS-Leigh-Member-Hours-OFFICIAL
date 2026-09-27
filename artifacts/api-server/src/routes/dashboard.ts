import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import { adminMessagesTable, db, membersTable } from "@workspace/db";
import { GetDashboardResponse, GetLifetimeHoursResponse } from "@workspace/api-zod";
import { getMemberFromSheet } from "../lib/sheets";
import { getPreviousYearHours } from "../lib/previous-year-hours";

const router: IRouter = Router();

const GRADE_10_ANNUAL_GOAL = 7;
const SENIOR_SEMESTER_1_GOAL = 8;
const UPPER_GRADE_SEMESTER_2_GOAL = 11;
const JUNIOR_MONTHS = new Set(["January", "February", "March", "April", "May"]);

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
    monthlyHours:
      sheetMember.grade === 11
        ? sheetMember.monthlyHours.filter((month) => JUNIOR_MONTHS.has(month.month))
        : sheetMember.monthlyHours,
  }));
});

router.get("/dashboard/lifetime-hours", async (req, res): Promise<void> => {
  if (!req.session.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const [member] = await db.select().from(membersTable).where(eq(membersTable.id, req.session.userId));
  if (!member) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const currentMember = await getMemberFromSheet(member.username);
  if (!currentMember) {
    res.status(404).json({ error: "Your record was not found in the current spreadsheet." });
    return;
  }

  // Only returning seniors can have 11th-grade hours from the previous sheet.
  const previous = currentMember.grade === 12
    ? await getPreviousYearHours(currentMember.studentId)
    : { hours: 0, found: false };

  res.json(GetLifetimeHoursResponse.parse({
    currentYearHours: currentMember.hours,
    previousYearHours: previous.hours,
    totalHours: Math.round((currentMember.hours + previous.hours) * 100) / 100,
    hasPreviousYear: previous.found,
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
  if (grade === 10) return GRADE_10_ANNUAL_GOAL;
  return getSemester1Goal(grade) + getSemester2Goal(grade);
}

function getSemester1Goal(grade: number): number {
  return grade === 12 ? SENIOR_SEMESTER_1_GOAL : 0;
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
