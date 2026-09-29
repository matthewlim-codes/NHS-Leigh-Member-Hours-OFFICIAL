import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import { adminMessagesTable, db, membersTable } from "@workspace/db";
import { GetDashboardResponse, GetLifetimeHoursResponse } from "@workspace/api-zod";
import { getMemberFromSheet } from "../lib/sheets";
import { getPreviousYearHours } from "../lib/previous-year-hours";
import { countActivities, sumActivityHours } from "../lib/activity-hours";
import { getAnnualGoal, getSemester1Goal, getSemester2Goal, getRemaining } from "../lib/hour-goals";

const router: IRouter = Router();

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

  // Match the prior grade by student ID, never by name or tab alone.
  const previous = currentMember.grade === 11 || currentMember.grade === 12
    ? await getPreviousYearHours(currentMember.studentId, currentMember.grade === 11 ? 10 : 11)
    : { hours: 0, found: false, hwCenterHours: 0, tutorialHours: 0 };
  const currentActivity = sumActivityHours(currentMember.monthlyHours);
  const activityCounts = countActivities(currentActivity, previous);

  res.json(GetLifetimeHoursResponse.parse({
    currentYearHours: currentMember.hours,
    previousYearHours: previous.hours,
    totalHours: Math.round((currentMember.hours + previous.hours) * 100) / 100,
    hasPreviousYear: previous.found,
    ...activityCounts,
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

export default router;
