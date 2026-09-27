import assert from "node:assert/strict";
import { test } from "node:test";
import { findPreviousYearHours } from "./previous-year-hours";

const headers = [
  [],
  ["Members Data", "", "", "", "", "TOTAL HOURS"],
  ["STUDENT ID", "NAME", "GRADE"],
];

test("adds only a matching previous-year 11th-grader's hours", () => {
  const rows = [
    ...headers,
    ["123", "Example, Alex", "11", "", "", "12.5"],
    ["456", "Example, Sam", "12", "", "", "20"],
    ["789", "Example, Lee", "11", "", "", "8"],
  ];

  assert.deepEqual(findPreviousYearHours(rows, "123"), { hours: 12.5, found: true });
  assert.deepEqual(findPreviousYearHours(rows, "456"), { hours: 0, found: false });
  assert.deepEqual(findPreviousYearHours(rows, "999"), { hours: 0, found: false });
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