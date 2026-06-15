import { describe, expect, it } from "vitest";
import { navSections } from "./navigationModel";

function labelsFor(sectionLabel: string): string[] {
  return navSections.find((section) => section.label === sectionLabel)?.items.map((item) => item.label) ?? [];
}

describe("console navigation model", () => {
  it("prioritizes intent-led operator surfaces", () => {
    expect(labelsFor("Operate")).toEqual([
      "Dashboard",
      "Start Work",
      "Queue",
      "Work History",
      "Capabilities",
      "Resources",
      "Review",
    ]);
  });

  it("contains implementation primitives in advanced work", () => {
    expect(labelsFor("Advanced work")).toEqual([
      "Tasks",
      "Workflow Templates",
      "Missions",
      "Schedules",
      "Run Templates",
    ]);
  });

  it("keeps admin and docs surfaces reachable outside the primary operator path", () => {
    expect(labelsFor("Admin")).toEqual([
      "Audit Trail",
      "Access Control",
      "Workspaces",
      "Failed Work",
      "Settings",
      "Documentation",
    ]);
  });
});
