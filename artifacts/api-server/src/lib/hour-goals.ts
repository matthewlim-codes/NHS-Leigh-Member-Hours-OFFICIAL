export function getAnnualGoal(grade: number): number {
  return grade === 10 ? 11 : grade === 11 || grade === 12 ? 19 : 0;
}

export function getSemester1Goal(grade: number): number {
  return grade === 11 || grade === 12 ? 8 : 0;
}

export function getSemester2Goal(grade: number): number {
  return grade === 10 || grade === 11 || grade === 12 ? 11 : 0;
}

export function getRemaining(hours: number, goal: number): number {
  return Math.max(0, Math.round((goal - hours) * 10) / 10);
}