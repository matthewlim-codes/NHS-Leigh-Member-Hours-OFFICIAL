import { ReplitConnectors } from "@replit/connectors-sdk";

// --- SPREADSHEET CONFIG ------------------------------------------------------
// To replace the Google Sheet, set GOOGLE_SHEET_ID to the long ID in the sheet
// URL between /d/ and /edit. If the member data lives on different tabs, set
// MEMBER_SHEET_TABS to a comma-separated list, e.g. "11/12,10".
const DEFAULT_SPREADSHEET_ID = "1NAfPUYygYC_AuIVHrguiGO_7sixenv3P2JREIawRKrk";
const DEFAULT_MEMBER_SHEET_TABS = ["11/12", "10"];

const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID?.trim() || DEFAULT_SPREADSHEET_ID;
const MEMBER_SHEET_TABS = parseSheetTabs(process.env.MEMBER_SHEET_TABS);
// ----------------------------------------------------------------------------

const NAME_HEADER = "name";
const STUDENT_ID_HEADER = "student id";
const GRADE_HEADER = "grade";
const INFO_FORM_HEADER = "info form";
const CLUB_DUES_HEADER = "club dues";
const HOURS_HEADER = "total hours";
const SEMESTER_1_HEADER = "sem 1 hours";
const HW_CENTER_SUBHEADER = "hw center";
const TUTORIAL_SUBHEADER = "tutorial";
const HEADER_SCAN_ROW_COUNT = 5;

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

const SHEET_HOUR_SECTION_ORDER = [
  "October",
  "November",
  "December",
  "Semester 1 Make-Up",
  "January",
  "February",
  "March",
  "April",
  "May",
] as const;

export interface SheetMember {
  studentId: string;
  username: string;
  displayName: string;
  grade: number;
  infoFormComplete: boolean;
  clubDuesPaid: boolean;
  hours: number;
  semester1Hours: number;
  semester2Hours: number;
  monthlyHours: SheetMonthHours[];
}

export interface SheetMonthHours {
  month: string;
  shortLabel: string;
  hwCenter: string;
  tutorial: string;
  total: number;
  hasData: boolean;
}

interface MemberColumns {
  studentIdColumn: number;
  nameColumn: number;
  gradeColumn: number | null;
  infoFormColumn: number | null;
  clubDuesColumn: number | null;
  hoursColumn: number | null;
  semester1Column: number | null;
  monthColumns: MonthColumns[];
  dataStartRow: number;
}

interface MonthColumns {
  month: string;
  shortLabel: string;
  hwCenterColumn: number;
  tutorialColumn: number;
}

export async function getMemberFromSheet(username: string): Promise<SheetMember | null> {
  const members = await listMembersFromSheet();
  const normalizedUsername = normalizeNameForMatching(username.replace(/-/g, " "));

  return members.find((member) => normalizeNameForMatching(member.username.replace(/-/g, " ")) === normalizedUsername) ?? null;
}

export async function listMembersFromSheet(): Promise<SheetMember[]> {
  const connectors = new ReplitConnectors();
  const members: SheetMember[] = [];

  for (const sheetTab of MEMBER_SHEET_TABS) {
    const range = encodeURIComponent(`${quoteSheetName(sheetTab)}!A:ZZ`);
    const response = await connectors.proxy(
      "google-sheet",
      `/v4/spreadsheets/${SPREADSHEET_ID}/values/${range}`,
      { method: "GET" }
    );

    const data = await response.json() as { values?: string[][] };
    const rows = data.values ?? [];

    if (rows.length < 2) continue;

    const columns = findMemberColumns(rows);

    if (!columns) continue;

    for (let i = columns.dataStartRow; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length <= columns.nameColumn || row.length <= columns.studentIdColumn) continue;

      const studentId = normalizeStudentId(row[columns.studentIdColumn]);
      const cellName = (row[columns.nameColumn] ?? "").trim();
      if (!studentId || !cellName) continue;

      const hours = parseHours(getCell(row, columns.hoursColumn));
      const semester1Hours = parseHours(getCell(row, columns.semester1Column));
      const displayName = toDisplayName(cellName);

      members.push({
        studentId,
        username: generateUsername(displayName),
        displayName,
        grade: parseGrade(getCell(row, columns.gradeColumn)),
        infoFormComplete: parseCompletion(getCell(row, columns.infoFormColumn)),
        clubDuesPaid: parseCompletion(getCell(row, columns.clubDuesColumn)),
        hours,
        semester1Hours,
        semester2Hours: Math.max(0, hours - semester1Hours),
        monthlyHours: buildMonthlyHours(row, columns.monthColumns),
      });
    }
  }

  return members;
}

export function generateUsername(fullName: string): string {
  return toDisplayName(fullName)
    .trim()
    .replace(/\s+/g, "-");
}

export function getStudentIdTemporaryPassword(studentId: string): string {
  return normalizeStudentId(studentId);
}

function parseSheetTabs(rawTabs: string | undefined): string[] {
  const tabs = rawTabs
    ?.split(",")
    .map((tab) => tab.trim())
    .filter(Boolean);

  return tabs && tabs.length > 0 ? tabs : DEFAULT_MEMBER_SHEET_TABS;
}

function quoteSheetName(sheetName: string): string {
  return `'${sheetName.replace(/'/g, "''")}'`;
}

function normalizeHeader(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function findMemberColumns(rows: string[][]): MemberColumns | null {
  const studentIdHeader = findHeader(rows, STUDENT_ID_HEADER);
  const nameHeader = findHeader(rows, NAME_HEADER);
  const gradeHeader = findHeader(rows, GRADE_HEADER);
  const infoFormHeader = findHeader(rows, INFO_FORM_HEADER);
  const clubDuesHeader = findHeader(rows, CLUB_DUES_HEADER);
  const hoursHeader = findHeader(rows, HOURS_HEADER);
  const semester1Header = findHeader(rows, SEMESTER_1_HEADER);

  if (!studentIdHeader || !nameHeader) {
    return null;
  }

  const dataStartRow = Math.max(studentIdHeader.row, nameHeader.row) + 1;

  const columnBeforeMonthlyHours = semester1Header?.column ?? (hoursHeader ? hoursHeader.column + 1 : nameHeader.column + 5);

  return {
    studentIdColumn: studentIdHeader.column,
    nameColumn: nameHeader.column,
    gradeColumn: gradeHeader?.column ?? null,
    infoFormColumn: infoFormHeader?.column ?? null,
    clubDuesColumn: clubDuesHeader?.column ?? null,
    hoursColumn: hoursHeader?.column ?? null,
    semester1Column: semester1Header?.column ?? null,
    monthColumns: findMonthColumns(rows, dataStartRow, columnBeforeMonthlyHours),
    dataStartRow,
  };
}

function findMonthColumns(rows: string[][], dataStartRow: number, columnBeforeMonthlyHours: number | null): MonthColumns[] {
  const columnsByMonth = new Map<string, MonthColumns>();
  const monthHeaders = MONTHS.flatMap((month) => {
    const header = findHeader(rows, month);
    if (!header) {
      return [];
    }

    return [{ month, shortLabel: month.slice(0, 3).toUpperCase(), ...header }];
  });

  monthHeaders.forEach((header) => {
    const nextMonthColumn = monthHeaders
      .filter((monthHeader) => monthHeader.column > header.column)
      .reduce<number | null>((closest, monthHeader) => {
        if (closest === null || monthHeader.column < closest) return monthHeader.column;
        return closest;
      }, null);

    const fallbackTutorialColumn = header.column + 1;
    const searchEndColumn = Math.max(
      fallbackTutorialColumn,
      nextMonthColumn === null ? fallbackTutorialColumn : nextMonthColumn - 1,
    );

    const hwCenterColumn = findSubheaderColumn(rows, header.row + 1, dataStartRow, header.column, searchEndColumn, HW_CENTER_SUBHEADER);
    const tutorialColumn = findSubheaderColumn(rows, header.row + 1, dataStartRow, header.column, searchEndColumn, TUTORIAL_SUBHEADER);

    if (hwCenterColumn !== null && tutorialColumn !== null) {
      columnsByMonth.set(header.month, {
        month: header.month,
        shortLabel: header.shortLabel,
        hwCenterColumn,
        tutorialColumn,
      });
    }
  });

  if (columnBeforeMonthlyHours !== null) {
    const firstMonthlyColumn = columnBeforeMonthlyHours + 1;

    SHEET_HOUR_SECTION_ORDER.forEach((sectionName, index) => {
      if (!isDashboardMonth(sectionName)) {
        return;
      }

      const hwCenterColumn = firstMonthlyColumn + index * 2;
      columnsByMonth.set(sectionName, {
        month: sectionName,
        shortLabel: sectionName.slice(0, 3).toUpperCase(),
        hwCenterColumn,
        tutorialColumn: hwCenterColumn + 1,
      });
    });
  }

  return MONTHS.flatMap((month) => columnsByMonth.get(month) ?? []);
}

function isDashboardMonth(sectionName: string): sectionName is typeof MONTHS[number] {
  return (MONTHS as readonly string[]).includes(sectionName);
}

function findSubheaderColumn(
  rows: string[][],
  startRow: number,
  endRow: number,
  startColumn: number,
  endColumn: number,
  subheaderName: string,
): number | null {
  const normalizedSubheaderName = normalizeHeader(subheaderName);

  for (let row = startRow; row < endRow; row++) {
    for (let column = startColumn; column <= endColumn; column++) {
      if (normalizeHeader(rows[row]?.[column]) === normalizedSubheaderName) {
        return column;
      }
    }
  }

  return null;
}

function findHeader(rows: string[][], headerName: string): { row: number; column: number } | null {
  const rowsToScan = Math.min(rows.length, HEADER_SCAN_ROW_COUNT);
  const normalizedHeaderName = normalizeHeader(headerName);

  for (let row = 0; row < rowsToScan; row++) {
    const column = rows[row].findIndex((cell) => normalizeHeader(cell) === normalizedHeaderName);
    if (column !== -1) {
      return { row, column };
    }
  }

  return null;
}

function toDisplayName(fullName: string): string {
  const trimmed = fullName.trim();
  const commaIndex = trimmed.indexOf(",");

  if (commaIndex === -1) {
    return trimmed;
  }

  const lastName = trimmed.slice(0, commaIndex).trim();
  const firstNames = trimmed.slice(commaIndex + 1).trim();

  return [firstNames, lastName].filter(Boolean).join(" ");
}

function normalizeNameForMatching(fullName: string): string {
  return toDisplayName(fullName)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function parseHours(rawHours: string): number {
  const hours = Number.parseFloat(rawHours.replace(/,/g, ""));
  return Number.isFinite(hours) ? hours : 0;
}

function getCell(row: string[], column: number | null): string {
  if (column === null) return "";
  return row[column] ?? "";
}

function normalizeStudentId(studentId: string | undefined): string {
  return (studentId ?? "").trim();
}

function parseGrade(rawGrade: string | undefined): number {
  const grade = Number.parseInt((rawGrade ?? "").trim(), 10);
  return Number.isFinite(grade) ? grade : 0;
}

function parseCompletion(rawValue: string | undefined): boolean {
  const normalized = (rawValue ?? "").trim().toLowerCase();
  return normalized === "✅" || normalized === "yes" || normalized === "y" || normalized === "true" || normalized === "complete" || normalized === "paid";
}

function buildMonthlyHours(row: string[], monthColumns: MonthColumns[]): SheetMonthHours[] {
  const byMonth = new Map(monthColumns.map((monthColumn) => {
    const hwCenter = formatHourCell(row[monthColumn.hwCenterColumn]);
    const tutorial = formatHourCell(row[monthColumn.tutorialColumn]);

    return [monthColumn.month, {
      month: monthColumn.month,
      shortLabel: monthColumn.shortLabel,
      hwCenter,
      tutorial,
      total: parseHours(hwCenter) + parseHours(tutorial),
      hasData: hasMonthData(hwCenter) || hasMonthData(tutorial),
    }];
  }));

  return MONTHS.map((month) => byMonth.get(month) ?? {
    month,
    shortLabel: month.slice(0, 3).toUpperCase(),
    hwCenter: "0",
    tutorial: "0",
    total: 0,
    hasData: false,
  });
}

function formatHourCell(rawValue: string | undefined): string {
  return (rawValue ?? "").trim() || "0";
}

function hasMonthData(value: string): boolean {
  return value !== "0" && value.length > 0;
}
