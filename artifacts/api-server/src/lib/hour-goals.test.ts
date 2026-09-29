import assert from "node:assert/strict";
import { test } from "node:test";
import { getAnnualGoal, getSemester1Goal, getSemester2Goal, getRemaining } from "./hour-goals";

test("grades 11 and 12 need 19 hours annually with an 11-hour semester 2 goal", () => {
  assert.deepEqual([getAnnualGoal(10), getSemester1Goal(10), getSemester2Goal(10)], [11, 0, 11]);
  assert.deepEqual([getAnnualGoal(11), getSemester1Goal(11), getSemester2Goal(11)], [19, 8, 11]);
  assert.deepEqual([getAnnualGoal(12), getSemester1Goal(12), getSemester2Goal(12)], [19, 8, 11]);
  assert.equal(getRemaining(4.5, getAnnualGoal(11)), 14.5);
  assert.equal(getRemaining(4.5, getSemester1Goal(11)), 3.5);
  assert.equal(getRemaining(4.5, getSemester2Goal(11)), 6.5);
});