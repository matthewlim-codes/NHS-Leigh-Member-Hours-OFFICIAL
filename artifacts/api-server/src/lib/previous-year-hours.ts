import { ReplitConnectors } from "@replit/connectors-sdk";
import { parseActivityHours, type ActivityHours } from "./activity-hours";

const PREVIOUS_YEAR_SPREADSHEET_ID = "1NAfPUYygYC_AuIVHrguiGO_7sixenv3P2JREIawRKrk";
const PREVIOUS_YEAR_TABS = { 10: "10", 11: "11/12" } as const;

type SheetValues = { values?: string[][] };

export function findPreviousYearHours(
  rows: string[][],
  studentId: string,
  previousGrade: 10 | 11,
): { hours: number; found: boolean } & ActivityHours {
  const headers = rows.slice(0, 5);
  const idHeader = findHeader(headers, "student id");
  const gradeHeader = findHeader(headers, "grade");
  const hoursHeader = findHeader(headers, "total hours");

  if (!idHeader || !gradeHeader || !hoursHeader) {
    throw new Error("The previous-year spreadsheet is missing required member columns");
  }

  const dataStart = Math.max(idHeader.row, gradeHeader.row, hoursHeader.row) + 1;
  const activityColumns: { hwCenter: number; tutorial: number }[] = [];
  for (let headerRow = 0; headerRow < dataStart; headerRow++) {
    const row = rows[headerRow] ?? [];
    for (let column = hoursHeader.column + 1; column < row.length - 1; column++) {
      if (normalizeHeader(row[column]) === "hw center" && normalizeHeader(row[column + 1]) === "tutorial") {
        activityColumns.push({ hwCenter: column, tutorial: column + 1 });
      }
    }
  }
  if (activityColumns.length === 0) {
    throw new Error("The previous-year spreadsheet is missing activity columns");
  }

  const matches = rows.slice(dataStart).filter((row) =>
    row[idHeader.column]?.trim() === studentId && Number(row[gradeHeader.column]?.trim()) === previousGrade
  );

  if (matches.length > 1) {
    throw new Error("The previous-year spreadsheet has duplicate records for this student ID");
  }
  if (matches.length === 0) return { hours: 0, found: false, hwCenterHours: 0, tutorialHours: 0 };

  const rawHours = (matches[0][hoursHeader.column] ?? "").replace(/,/g, "").trim();
  const hours = rawHours === "" ? 0 : Number(rawHours);
  if (!Number.isFinite(hours) || hours < 0) {
    throw new Error("The previous-year spreadsheet has invalid total hours for this member");
  }

  const activity = activityColumns.reduce<ActivityHours>((total, columns) => ({
    hwCenterHours: total.hwCenterHours + parseActivityHours(matches[0][columns.hwCenter]),
    tutorialHours: total.tutorialHours + parseActivityHours(matches[0][columns.tutorial]),
  }), { hwCenterHours: 0, tutorialHours: 0 });

  return { hours, found: true, ...activity };
}

export async function getPreviousYearHours(studentId: string, previousGrade: 10 | 11): Promise<{ hours: number; found: boolean } & ActivityHours> {
  const connectors = new ReplitConnectors();
  const tab = PREVIOUS_YEAR_TABS[previousGrade];
  const range = encodeURIComponent(`'${tab}'!${previousGrade === 10 ? "A:K" : "A:X"}`);
  const response = await connectors.proxy(
    "google-sheet",
    `/v4/spreadsheets/${PREVIOUS_YEAR_SPREADSHEET_ID}/values/${range}`,
    { method: "GET" },
  );

  if (!response.ok) {
    throw new Error(`Could not read the previous-year spreadsheet (status ${response.status})`);
  }

  const data = await response.json() as SheetValues;
  return findPreviousYearHours(data.values ?? [], studentId, previousGrade);
}

function findHeader(rows: string[][], name: string): { row: number; column: number } | null {
  for (let row = 0; row < rows.length; row++) {
    const column = rows[row].findIndex((cell) => normalizeHeader(cell) === name);
    if (column >= 0) return { row, column };
  }
  return null;
}

function normalizeHeader(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}