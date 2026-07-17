import { z } from "zod";

export const MAX_SUBMISSION_CHARACTERS = 35_000;

export const ParagraphSchema = z
  .object({
    id: z.string().regex(/^p[1-9]\d*$/),
    text: z.string().min(1),
  })
  .strict();

export const RubricObjectiveSchema = z
  .object({
    id: z.string().trim().regex(/^r[1-9]\d*$/),
    text: z.string().trim().min(3).max(160),
  })
  .strict();

export const AnalyzeRequestSchema = z
  .object({
    studentName: z.string().trim().min(1).max(120),
    title: z.string().trim().min(1).max(160).optional(),
    text: z
      .string()
      .trim()
      .min(80, "Paste a longer submission before analyzing it.")
      .max(MAX_SUBMISSION_CHARACTERS),
    rubric: z.array(RubricObjectiveSchema).min(1).max(5),
  })
  .superRefine((request, context) => {
    const ids = request.rubric.map((objective) => objective.id);

    if (new Set(ids).size !== ids.length) {
      context.addIssue({
        code: "custom",
        message: "Each rubric objective needs a unique ID.",
        path: ["rubric"],
      });
    }
  });

export const PassageRefSchema = z
  .object({
    paragraphId: z.string().regex(/^p[1-9]\d*$/),
    quote: z.string().trim().min(1).max(800),
  })
  .strict();

export const EvidenceSchema = z
  .object({
    text: z.string().trim().min(1).max(400),
    passage: PassageRefSchema,
  })
  .strict();

export const ClaimSchema = z
  .object({
    id: z.string().trim().min(1).max(30),
    text: z.string().trim().min(1).max(500),
    passage: PassageRefSchema,
    evidence: z.array(EvidenceSchema).max(5),
    kind: z.enum(["thesis", "claim", "assumption"]),
    rubricIds: z.array(z.string().regex(/^r[1-9]\d*$/)).min(1).max(5),
  })
  .strict();

export const ArgumentGraphOutputSchema = z
  .object({
    thesis: ClaimSchema,
    claims: z.array(ClaimSchema).min(3).max(5),
    weakSpots: z.array(z.string().trim().min(1)).max(5),
  })
  .strict();

export const ArgumentGraphSchema = ArgumentGraphOutputSchema
  .superRefine((graph, context) => {
    if (graph.thesis.id !== "thesis") {
      context.addIssue({
        code: "custom",
        message: 'The thesis id must be "thesis".',
        path: ["thesis", "id"],
      });
    }

    if (graph.thesis.kind !== "thesis") {
      context.addIssue({
        code: "custom",
        message: 'The thesis kind must be "thesis".',
        path: ["thesis", "kind"],
      });
    }

    const claimIds = graph.claims.map((claim) => claim.id);

    if (new Set(claimIds).size !== claimIds.length) {
      context.addIssue({
        code: "custom",
        message: "Claim IDs must be unique.",
        path: ["claims"],
      });
    }

    for (const [index, claim] of graph.claims.entries()) {
      if (!/^c[1-9]\d*$/.test(claim.id)) {
        context.addIssue({
          code: "custom",
          message: 'Claim IDs must follow the "c1" format.',
          path: ["claims", index, "id"],
        });
      }

      if (claim.kind === "thesis") {
        context.addIssue({
          code: "custom",
          message: "Only the top-level thesis may use the thesis kind.",
          path: ["claims", index, "kind"],
        });
      }
    }

    const weakSpotIds = graph.weakSpots;

    if (new Set(weakSpotIds).size !== weakSpotIds.length) {
      context.addIssue({
        code: "custom",
        message: "Weak-spot IDs must be unique.",
        path: ["weakSpots"],
      });
    }

    const requiredWeakSpots = graph.claims
      .filter((claim) => claim.kind === "assumption" || claim.evidence.length === 0)
      .map((claim) => claim.id);

    for (const claimId of requiredWeakSpots) {
      if (!weakSpotIds.includes(claimId)) {
        context.addIssue({
          code: "custom",
          message: `${claimId} must be listed in weakSpots.`,
          path: ["weakSpots"],
        });
      }
    }

    for (const claimId of weakSpotIds) {
      const claim = graph.claims.find((item) => item.id === claimId);

      if (!claim) {
        context.addIssue({
          code: "custom",
          message: `${claimId} does not identify a claim.`,
          path: ["weakSpots"],
        });
        continue;
      }

      if (claim.kind !== "assumption" && claim.evidence.length > 0) {
        context.addIssue({
          code: "custom",
          message: `${claimId} is not an assumption or unsupported claim.`,
          path: ["weakSpots"],
        });
      }
    }
  });

export type AnalyzeRequest = z.infer<typeof AnalyzeRequestSchema>;
export type ArgumentGraph = z.infer<typeof ArgumentGraphOutputSchema>;
export type Claim = z.infer<typeof ClaimSchema>;
export type PassageRef = z.infer<typeof PassageRefSchema>;
export type RubricObjective = z.infer<typeof RubricObjectiveSchema>;

export type Submission = {
  id: string;
  studentName: string;
  title: string;
  text: string;
  paragraphs: z.infer<typeof ParagraphSchema>[];
};

export function normalizeSubmissionText(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]*\n[ \t]*/g, " ")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export function splitIntoParagraphs(text: string): Submission["paragraphs"] {
  return text
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .map((paragraph) => normalizeSubmissionText(paragraph))
    .filter(Boolean)
    .map((paragraph, index) => ({ id: `p${index + 1}`, text: paragraph }));
}

export function createSubmission(request: AnalyzeRequest): Submission {
  const text = request.text.replace(/\r\n/g, "\n").trim();

  return {
    id: `submission-${crypto.randomUUID()}`,
    studentName: request.studentName,
    title: request.title || "Student submission",
    text,
    paragraphs: splitIntoParagraphs(text),
  };
}

function formatZodIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
    return `${path}${issue.message}`;
  });
}

function validatePassageRef(
  passage: PassageRef,
  paragraphs: Map<string, string>,
  label: string,
): string[] {
  const paragraph = paragraphs.get(passage.paragraphId);

  if (!paragraph) {
    return [`${label} references unknown paragraph ${passage.paragraphId}.`];
  }

  if (!paragraph.includes(passage.quote)) {
    return [
      `${label} quote is not a verbatim substring of ${passage.paragraphId}.`,
    ];
  }

  return [];
}

export function getArgumentGraphValidationIssues(
  candidate: unknown,
  submission: Submission,
  rubric: RubricObjective[],
): string[] {
  const parsed = ArgumentGraphSchema.safeParse(candidate);

  if (!parsed.success) {
    return formatZodIssues(parsed.error);
  }

  const graph = parsed.data;
  const paragraphs = new Map(
    submission.paragraphs.map((paragraph) => [paragraph.id, paragraph.text]),
  );
  const rubricIds = new Set(rubric.map((objective) => objective.id));
  const claims = [graph.thesis, ...graph.claims];
  const issues: string[] = [];

  for (const claim of claims) {
    issues.push(
      ...validatePassageRef(claim.passage, paragraphs, `${claim.id} passage`),
    );

    for (const evidence of claim.evidence) {
      issues.push(
        ...validatePassageRef(
          evidence.passage,
          paragraphs,
          `${claim.id} evidence`,
        ),
      );
    }

    for (const rubricId of claim.rubricIds) {
      if (!rubricIds.has(rubricId)) {
        issues.push(`${claim.id} references unknown rubric objective ${rubricId}.`);
      }
    }
  }

  return issues;
}
