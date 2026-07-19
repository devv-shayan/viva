import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  path.join(process.cwd(), "src", "components", "defense-room.tsx"),
  "utf8",
);

describe("answer-group transport boundary", () => {
  it("keeps a late final transcript with the prior answer until Viva audio starts", () => {
    expect(source).toMatch(
      /raw\.type === "output_audio_buffer\.started"[\s\S]{0,700}closeOpenAnswerGroup\(\)/,
    );
    expect(source).not.toMatch(
      /raw\.type === "response\.created"[\s\S]{0,220}closeOpenAnswerGroup\(\)/,
    );
  });
});
