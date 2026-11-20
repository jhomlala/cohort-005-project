import { describe, expect, it } from "vitest";
import { calculateGrade } from "./lesson-quiz.server";

describe("calculateGrade", () => {
  it.each([
    [1, "A"],
    [0.9, "A"],
    [0.89, "B"],
    [0.8, "B"],
    [0.79, "C"],
    [0.7, "C"],
    [0.69, "D"],
    [0.6, "D"],
    [0.59, "F"],
    [0, "F"],
  ])("grades a score of %s as %s", (score, grade) => {
    expect(calculateGrade(score)).toBe(grade);
  });
});
