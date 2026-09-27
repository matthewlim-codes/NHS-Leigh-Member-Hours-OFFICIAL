import { ReplitConnectors } from "@replit/connectors-sdk";

const PREVIOUS_YEAR_SPREADSHEET_ID = "1NAfPUYygYC_AuIVHrguiGO_7sixenv3P2JREIawRKrk";
const PREVIOUS_YEAR_TAB = "11/12";

type SheetValues = { values?: string[][] };

export function findPreviousYearHours(
  rows: string[][],
  studentId: string,
): { hours: number; found: boolean } {
  const headers = rows.slice(0, 5);
  const idHeader = findHeader(headers, "student id");
  const gradeHeader = findHeader(headers, "grade");
  const hoursHeader = findHeader(headers, "total hours");

  if (!idHeader || !gradeHeader || !hoursHeader) {
    throw new Error("The previous-year spreadsheet is missing required member columns");
  }

  const dataStart = Math.max(idHeader.row, gradeHeader.row, hoursHeader.row) + 1;
  const matches = rows.slice(dataStart).filter((row) =>
    row[idHeader.column]?.trim() === studentId && Number.parseInt(row[gradeHeader.column] ?? "", 10) === 11
  );

  if (matches.length > 1) {
    throw new Error("The previous-year spreadsheet has duplicate records for this student ID");
  }
  if (matches.length === 0) return { hours: 0, found: false };

  const rawHours = (matches[0][hoursHeader.column] ?? "").replace(/,/g, "").trim();
  const hours = rawHours === "" ? 0 : Number(rawHours);
  if (!Number.isFinite(hours) || hours < 0) {
    throw new Error("The previous-year spreadsheet has invalid total hours for this member");
  }

  return { hours, found: true };
}

export async function getPreviousYearHours(studentId: string): Promise<{ hours: number; found: boolean }> {
  const connectors = new ReplitConnectors();
  const range = encodeURIComponent(`'${PREVIOUS_YEAR_TAB}'!A:G`);
  const response = await connectors.proxy(
    "google-sheet",
    `/v4/spreadsheets/${PREVIOUS_YEAR_SPREADSHEET_ID}/values/${range}`,
    { method: "GET" },
  );

  if (!response.ok) {
    throw new Error(`Could not read the previous-year spreadsheet (status ${response.status})`);
  }

  const data = await response.json() as SheetValues;
  return findPreviousYearHours(data.values ?? [], studentId);
}

function findHeader(rows: string[][], name: string): { row: number; column: number } | null {
  for (let row = 0; row < rows.length; row++) {
    const column = rows[row].findIndex((cell) => cell.trim().toLowerCase() === name);
    if (column >= 0) return { row, column };
  }
  return null;
}