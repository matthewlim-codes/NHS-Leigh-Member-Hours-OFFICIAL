import assert from "node:assert/strict";
import { test } from "node:test";
import { findPreviousYearHours } from "./previous-year-hours";
import { countActivities, sumActivityHours } from "./activity-hours";

const headers = [
  [],
  ["Members Data", "", "", "", "", "TOTAL HOURS"],
  ["STUDENT ID", "NAME", "GRADE", "", "", "", "", "HW Center", "Tutorial", "HW Center", "Tutorial"],
];

test("adds only a matching previous-year 11th-grader's hours", () => {
  const rows = [
    ...headers,
    ["123", "Example, Alex", "11", "", "", "12.5", "", "2", "1.5", "1", "0.5"],
    ["456", "Example, Sam", "12", "", "", "20", "", "2", "2", "1", "1"],
    ["789", "Example, Lee", "11", "", "", "8", "", "EXCUSED (PT)", "0.5", "", ""],
  ];

  assert.deepEqual(findPreviousYearHours(rows, "123"), { hours: 12.5, found: true, hwCenterHours: 3, tutorialHours: 2 });
  assert.deepEqual(findPreviousYearHours(rows, "789"), { hours: 8, found: true, hwCenterHours: 0, tutorialHours: 0.5 });
  assert.deepEqual(findPreviousYearHours(rows, "456"), { hours: 0, found: false, hwCenterHours: 0, tutorialHours: 0 });
  assert.deepEqual(findPreviousYearHours(rows, "999"), { hours: 0, found: false, hwCenterHours: 0, tutorialHours: 0 });
});

test("does not silently use ambiguous or invalid previous-year hours", () => {
  assert.throws(
    () => findPreviousYearHours([...headers, ["123", "", "11", "", "", "5"], ["123", "", "11", "", "", "6"]], "123"),
    /duplicate records/,
  );
  assert.throws(
    () => findPreviousYearHours([...headers, ["123", "", "11", "", "", "invalid"]], "123"),
    /invalid total hours/,
  );
  assert.throws(() => findPreviousYearHours([["STUDENT ID", "GRADE"]], "123"), /missing required/);
});

test("counts one HW Center shift per hour and two tutorials per tutorial hour", () => {
  const current = sumActivityHours([
    { hwCenter: "1", tutorial: "0.5" },
    { hwCenter: "2", tutorial: "1.5" },
    { hwCenter: "EXCUSED (PT)", tutorial: "" },
  ]);
  assert.deepEqual(countActivities(current, { hwCenterHours: 3, tutorialHours: 2 }), {
    hwCenterShifts: 6,
    tutorialsAttended: 8,
  });
  assert.throws(() => sumActivityHours([{ hwCenter: "unknown", tutorial: "0" }]), /invalid activity-hours/);
});