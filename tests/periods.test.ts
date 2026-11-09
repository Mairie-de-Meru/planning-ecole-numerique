import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseServicePublic, extractDates } from "@/lib/periods/scraper";
import { derivePeriods } from "@/lib/periods/derive";
import { diffPeriods } from "@/lib/periods/sync";

const expectedB = [
  { position: 1, label: "Rentrée → Toussaint", startDate: "2026-09-01", endDate: "2026-10-16" },
  { position: 2, label: "Toussaint → Noël", startDate: "2026-11-02", endDate: "2026-12-18" },
  { position: 3, label: "Noël → Hiver", startDate: "2027-01-04", endDate: "2027-02-19" },
  { position: 4, label: "Hiver → Printemps", startDate: "2027-03-08", endDate: "2027-04-16" },
  { position: 5, label: "Printemps → Été", startDate: "2027-05-03", endDate: "2027-07-02" },
];

describe("extractDates", () => {
  it("lit les dates françaises, y compris 1er et accents", () => {
    expect(extractDates("lundi 1er mars 2027 et samedi 19 décembre 2026")).toEqual(["2027-03-01", "2026-12-19"]);
    expect(extractDates("samedi 17 octobre", "2026-2027")).toEqual(["2026-10-17"]);
  });
});

describe("lecture de la page des vacances", () => {
  for (const fixture of ["table.html", "zones.html"]) {
    it(`déduit les 5 périodes de la zone B (${fixture})`, () => {
      const html = readFileSync(`tests/fixtures/${fixture}`, "utf8");
      const cals = parseServicePublic(html, "B");
      expect(cals).toHaveLength(1);
      const periods = derivePeriods(cals[0]);
      expect(periods.map(({ position, label, startDate, endDate }) => ({ position, label, startDate, endDate }))).toEqual(expectedB);
    });
  }

  it("prend la bonne colonne pour la zone A", () => {
    const html = readFileSync("tests/fixtures/table.html", "utf8");
    const p = derivePeriods(parseServicePublic(html, "A")[0]);
    expect(p[2].endDate).toBe("2027-02-12");
    expect(p[3].startDate).toBe("2027-03-01");
  });
});

describe("diffPeriods", () => {
  it("propose ajouts et modifications, ignore les périodes verrouillées et passées", () => {
    const derived = expectedB.map((p) => ({ ...p, schoolYear: "2026-2027", zone: "B" }));
    const base = { id: "x", zone: "B", schoolYear: "2026-2027", source: "manual" as const, updatedAt: new Date() };
    const existing = [
      { ...base, id: "2", position: 2, label: "Toussaint → Noël", startDate: "2026-11-02", endDate: "2026-12-18", locked: false },
      { ...base, id: "3", position: 3, label: "Noël → Hiver", startDate: "2027-01-04", endDate: "2027-02-12", locked: false },
      { ...base, id: "4", position: 4, label: "x", startDate: "2027-03-01", endDate: "2027-04-01", locked: true },
    ];
    const changes = diffPeriods(existing, derived, "2026-11-09");
    expect(changes.map((c) => [c.position, c.type])).toEqual([
      [3, "update"],
      [5, "add"],
    ]);
  });
});
