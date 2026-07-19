import { z } from "zod";

import { ArgumentGraphSchema, PassageRefSchema } from "./analysis-types";

export const AssessMoveTypeSchema = z.enum([
  "grounded_question",
  "drill_down",
  "counterfactual",
  "wrap",
]);

export const AssessTurnSchema = z
  .object({
    id: z.string().min(1),
    speaker: z.enum(["agent", "student"]),
    text: z.string().trim().min(1).max(4_000),
    t: z.number().int().nonnegative(),
  })
  .strict();

export const AssessFocusSchema = z
  .object({
    move: AssessMoveTypeSchema,
    claimId: z.string().min(1),
    passage: PassageRefSchema,
    hint: z.string().trim().min(1).max(500),
  })
  .strict();

export const AssessQualitySchema = z.enum([
  "demonstrated",
  "partial",
  "vague",
  "contradicts_submission",
  "no_answer",
]);

export const AssessDeltaSchema = z
  .object({
    claimId: z.string().min(1),
    quality: AssessQualitySchema,
    evidenceCited: z.boolean(),
    note: z.string().trim().min(1).max(500),
    answeredInOtherLanguage: z.string().trim().min(2).max(16).optional(),
  })
  .strict();

/**
 * OpenAI structured outputs require all object properties to be required.
 * Keep this API-only shape nullable, then normalize null back to the optional
 * application field after parsing the model response.
 */
export const AssessModelOutputSchema = AssessDeltaSchema.extend({
  answeredInOtherLanguage: z.string().trim().min(2).max(16).nullable(),
});
export const AssessRequestSchema = z
  .object({
    // A single spoken answer can be finalized in several adjacent ASR events.
    // The capture layer keeps every captured fragment together before assessment.
    answerTurns: z.array(AssessTurnSchema).min(1).max(12),
    focus: AssessFocusSchema,
    graph: ArgumentGraphSchema,
    recentTurns: z.array(AssessTurnSchema).max(6),
  })
  .strict()
  .superRefine((request, context) => {
    const answerIds = request.answerTurns.map((turn) => turn.id);

    if (new Set(answerIds).size !== answerIds.length) {
      context.addIssue({
        code: "custom",
        message: "answerTurns must have unique turn IDs.",
        path: ["answerTurns"],
      });
    }

    for (const [index, turn] of request.answerTurns.entries()) {
      if (turn.speaker !== "student") {
        context.addIssue({
          code: "custom",
          message: "answerTurns may contain student turns only.",
          path: ["answerTurns", index, "speaker"],
        });
      }
    }

    const recentTurnIds = new Set(request.recentTurns.map((turn) => turn.id));

    for (const answerId of answerIds) {
      if (!recentTurnIds.has(answerId)) {
        context.addIssue({
          code: "custom",
          message: "recentTurns must include every answer turn.",
          path: ["recentTurns"],
        });
        break;
      }
    }

    const claims = [request.graph.thesis, ...request.graph.claims];
    const focusedClaim = claims.find(
      (claim) => claim.id === request.focus.claimId,
    );

    if (!focusedClaim) {
      context.addIssue({
        code: "custom",
        message: "focus references a claim outside the approved graph.",
        path: ["focus", "claimId"],
      });
      return;
    }

    if (
      focusedClaim.passage.paragraphId !== request.focus.passage.paragraphId ||
      focusedClaim.passage.quote !== request.focus.passage.quote
    ) {
      context.addIssue({
        code: "custom",
        message: "focus must use the approved claim passage exactly.",
        path: ["focus", "passage"],
      });
    }
  });

export type AssessDelta = z.infer<typeof AssessDeltaSchema>;
export type AssessQuality = z.infer<typeof AssessQualitySchema>;
export type AssessRequest = z.infer<typeof AssessRequestSchema>;
