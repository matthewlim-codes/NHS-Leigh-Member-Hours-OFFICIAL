export interface ActivityHours {
  hwCenterHours: number;
  tutorialHours: number;
}

export function parseActivityHours(raw: string | undefined): number {
  const value = (raw ?? "").trim().replace(/,/g, "");
  if (!value || /^excused(?:\b|$)/i.test(value)) return 0;
  const hours = Number(value);
  if (!Number.isFinite(hours) || hours < 0) {
    throw new Error("The spreadsheet has an invalid activity-hours entry");
  }
  return hours;
}

export function sumActivityHours(months: { hwCenter: string; tutorial: string }[]): ActivityHours {
  return months.reduce<ActivityHours>((total, month) => ({
    hwCenterHours: total.hwCenterHours + parseActivityHours(month.hwCenter),
    tutorialHours: total.tutorialHours + parseActivityHours(month.tutorial),
  }), { hwCenterHours: 0, tutorialHours: 0 });
}

export function countActivities(...years: ActivityHours[]): { hwCenterShifts: number; tutorialsAttended: number } {
  const hours = years.reduce<ActivityHours>((total, year) => ({
    hwCenterHours: total.hwCenterHours + year.hwCenterHours,
    tutorialHours: total.tutorialHours + year.tutorialHours,
  }), { hwCenterHours: 0, tutorialHours: 0 });

  return {
    hwCenterShifts: Math.round(hours.hwCenterHours * 100) / 100,
    tutorialsAttended: Math.round(hours.tutorialHours * 200) / 100,
  };
}