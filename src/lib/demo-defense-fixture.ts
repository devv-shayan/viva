import { z } from "zod";

import { DossierAnswerGroupSchema } from "./dossier-types";
import {
  TranscriptTurnSchema,
  answerGroupIdForQuestionTurn,
} from "./session-state";

export const DemoDefenseFixtureSchema = z
  .object({
    _note: z.string().min(1).optional(),
    sessionId: z.string().min(1),
    studentName: z.string().min(1),
    consent: z
      .object({
        given: z.literal(true),
        at: z.string().min(1),
        spokenConfirmationTurnId: z.string().min(1).optional(),
      })
      .strict(),
    turns: z.array(TranscriptTurnSchema).min(1).max(100),
    answerGroups: z.array(DossierAnswerGroupSchema).max(6),
  })
  .strict()
  .superRefine((fixture, context) => {
    const turnsById = new Map(fixture.turns.map((turn) => [turn.id, turn]));
    const answerIds = new Set<string>();
    const groupIds = new Set<string>();

    if (turnsById.size !== fixture.turns.length) {
      context.addIssue({
        code: "custom",
        message: "Demo transcript turns must have stable, unique IDs.",
        path: ["turns"],
      });
    }

    for (const group of fixture.answerGroups) {
      const question = turnsById.get(group.questionTurnId);

      if (groupIds.has(group.id)) {
        context.addIssue({
          code: "custom",
          message: "Demo answer groups must have stable, unique IDs.",
          path: ["answerGroups"],
        });
        break;
      }

      groupIds.add(group.id);

      if (group.id !== answerGroupIdForQuestionTurn(group.questionTurnId)) {
        context.addIssue({
          code: "custom",
          message: "Demo answer group IDs must be derived from their question turn.",
          path: ["answerGroups"],
        });
        break;
      }

      if (question?.speaker !== "agent") {
        context.addIssue({
          code: "custom",
          message: "Demo answer groups must start with an agent question.",
          path: ["answerGroups"],
        });
        break;
      }

      for (const answerTurnId of group.answerTurnIds) {
        const answer = turnsById.get(answerTurnId);

        if (
          answer?.speaker !== "student" ||
          answer.t <= question.t ||
          answerIds.has(answerTurnId)
        ) {
          context.addIssue({
            code: "custom",
            message:
              "Every demo answer fragment must be a unique student turn after its question.",
            path: ["answerGroups"],
          });
          break;
        }

        answerIds.add(answerTurnId);
      }
    }
  });

export type DemoDefenseFixture = z.infer<typeof DemoDefenseFixtureSchema>;
