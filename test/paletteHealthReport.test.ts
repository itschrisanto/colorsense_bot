import { describe, expect, it } from "vitest";
import { buildContrastRows, computeHierarchy, buildSummary, type Entry } from "../src/lib/paletteHealthReport.js";

// This exact palette + expected values are the reference example verified
// directly against the live ColorSense website's Palette Health tool —
// same score, same ratios, same 60/30/10 split, same summary wording.
const ENTRIES: Entry[] = [
  { hex: "#212B3B", name: "Ebony Clay" },
  { hex: "#343665", name: "Rhino" },
  { hex: "#60498D", name: "Butterfly Bush" },
  { hex: "#9D6BB3", name: "Wisteria" },
  { hex: "#D0AACD", name: "Lilac" },
];

describe("buildContrastRows", () => {
  it("excludes the darkest color as a background and sorts weakest-first", () => {
    const rows = buildContrastRows(ENTRIES);

    expect(rows.map((r) => r.bgName)).toEqual(["Wisteria", "Lilac", "Butterfly Bush", "Rhino"]);
    expect(rows[0]).toMatchObject({ fg: "#FFFFFF", bg: "#9D6BB3", ratio: "4.05:1", verdict: "AA Large", tone: "warn" });
    expect(rows[1]).toMatchObject({ fg: "#212B3B", bg: "#D0AACD", ratio: "7.00:1", verdict: "AA", tone: "pass" });
  });

  it("returns nothing for fewer than two colors", () => {
    expect(buildContrastRows([{ hex: "#000000", name: "Black" }])).toEqual([]);
  });
});

describe("computeHierarchy", () => {
  it("assigns darkest=60%, closest-to-midtone=30%, most-saturated=10%", () => {
    expect(computeHierarchy(ENTRIES)).toEqual([
      { hex: "#212B3B", name: "Ebony Clay", pct: 60 },
      { hex: "#D0AACD", name: "Lilac", pct: 30 },
      { hex: "#9D6BB3", name: "Wisteria", pct: 10 },
    ]);
  });
});

describe("buildSummary", () => {
  it("matches the website's exact wording for the reference palette", () => {
    const rows = buildContrastRows(ENTRIES);
    const summary = buildSummary(rows, ENTRIES, 70, "deuteranopia");

    expect(summary.text).toBe(
      "A confident, balanced palette. One real problem to fix: Rhino and Butterfly Bush are hard to tell apart under deuteranopia. Everything below is measured, not guessed.",
    );
    expect(summary.issueCount).toBe(1);
  });

  it("reports no issues for a palette with no failing or confusable pairs", () => {
    const entries: Entry[] = [
      { hex: "#000000", name: "Black" },
      { hex: "#FFFFFF", name: "White" },
    ];
    const rows = buildContrastRows(entries);
    const summary = buildSummary(rows, entries, 95, "deuteranopia");

    expect(summary.issueCount).toBe(0);
    expect(summary.text).toContain("No accessibility issues found");
  });
});
