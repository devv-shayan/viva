import { describe, expect, it } from "vitest";

import demoDefense from "../../fixtures/demo-defense.json";
import { DemoDefenseFixtureSchema } from "./demo-defense-fixture";

describe("demo defense fixture", () => {
  it("keeps the scripted split answer together in one validated group", () => {
    const fixture = DemoDefenseFixtureSchema.parse(demoDefense);
    const splitAnswer = fixture.answerGroups.find(
      (group) => group.id === "answer-group:t5",
    );

    expect(splitAnswer).toMatchObject({
      questionTurnId: "t5",
      answerTurnIds: ["t6", "t6b"],
    });
  });

  it("rejects a group that attempts to cite only a fragment as a new answer", () => {
    const malformed = structuredClone(demoDefense);
    malformed.answerGroups.push({
      id: "answer-group:t6b",
      questionTurnId: "t5",
      answerTurnIds: ["t6b"],
    });

    expect(DemoDefenseFixtureSchema.safeParse(malformed).success).toBe(false);
  });
});
