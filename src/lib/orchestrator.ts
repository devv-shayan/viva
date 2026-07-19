import { MAX_DEFENSE_ELAPSED_MS } from "./defense-clock";
import {
  createFocusForClaim,
  type CoverageEntry,
  type Focus,
} from "./session-state";
import type { ArgumentGraph } from "./analysis-types";

export const MAX_DEFENSE_QUESTIONS = 6;

export type NextFocus = Focus | "wrap";

function wasAsked(entry: CoverageEntry) {
  return entry.answerGroups.length > 0;
}

function questionCount(coverage: CoverageEntry[]) {
  return coverage.reduce(
    (total, entry) => total + entry.answerGroups.length,
    0,
  );
}

function hasMove(entry: CoverageEntry, move: Focus["move"]) {
  return entry.movesUsed.includes(move);
}

function chooseCounterfactualClaim(coverage: CoverageEntry[]) {
  const eligible = coverage.filter(
    (entry) =>
      entry.claimId !== "thesis" &&
      wasAsked(entry) &&
      (entry.status === "partial" || entry.status === "demonstrated"),
  );

  return (
    [...eligible].reverse().find((entry) => entry.status === "partial") ??
    [...eligible].reverse().find((entry) => entry.status === "demonstrated")
  );
}

/**
 * The teacher-approved graph order is the primary deterministic route for the
 * MVP demo (thesis → c1 → c2 → c3). `weakSpots` still drives the graph and
 * coverage display, but is not allowed to reorder this recorded acceptance
 * sequence. A future adaptive policy can make that trade-off explicit.
 */
function nextPlannedClaim(coverage: CoverageEntry[], graph: ArgumentGraph) {
  return graph.claims.find((claim) => {
    const entry = coverage.find((item) => item.claimId === claim.id);
    return entry ? !wasAsked(entry) : false;
  });
}

function canAskAnotherQuestion(coverage: CoverageEntry[], elapsedMs: number) {
  return (
    elapsedMs < MAX_DEFENSE_ELAPSED_MS &&
    questionCount(coverage) < MAX_DEFENSE_QUESTIONS
  );
}

/**
 * Coded policy, not LLM-owned. It deliberately makes a vague answer earn one
 * concrete drill-down before the counterfactual phase; after two non-thesis
 * claims are tested, the counterfactual has priority over an extra drill.
 */
export function nextFocus(
  coverage: CoverageEntry[],
  graph: ArgumentGraph,
  elapsedMs: number,
): NextFocus {
  if (!canAskAnotherQuestion(coverage, elapsedMs)) {
    return "wrap";
  }

  const thesisCoverage = coverage.find((entry) => entry.claimId === "thesis");

  if (!thesisCoverage || !wasAsked(thesisCoverage)) {
    return createFocusForClaim(graph, graph.thesis.id) ?? "wrap";
  }

  const testedNonThesisClaims = coverage.filter(
    (entry) => entry.claimId !== "thesis" && wasAsked(entry),
  ).length;
  const counterfactualAlreadyUsed = coverage.some((entry) =>
    hasMove(entry, "counterfactual"),
  );

  if (testedNonThesisClaims >= 2 && !counterfactualAlreadyUsed) {
    const target = chooseCounterfactualClaim(coverage);

    if (target) {
      return (
        createFocusForClaim(graph, target.claimId, "counterfactual") ?? "wrap"
      );
    }
  }

  const drillTarget = coverage.find(
    (entry) =>
      entry.status === "partial" &&
      hasMove(entry, "grounded_question") &&
      !hasMove(entry, "drill_down") &&
      !hasMove(entry, "counterfactual"),
  );

  if (drillTarget) {
    return createFocusForClaim(graph, drillTarget.claimId, "drill_down") ?? "wrap";
  }

  const plannedClaim = nextPlannedClaim(coverage, graph);

  return plannedClaim
    ? createFocusForClaim(graph, plannedClaim.id, "grounded_question") ?? "wrap"
    : "wrap";
}

/**
 * Assessment hiccups must never stall the defense. This intentionally skips
 * adaptive moves and advances to the next approved grounded claim only.
 */
export function nextFallbackFocus(
  coverage: CoverageEntry[],
  graph: ArgumentGraph,
  elapsedMs: number,
): NextFocus {
  if (!canAskAnotherQuestion(coverage, elapsedMs)) {
    return "wrap";
  }

  const plannedClaim = nextPlannedClaim(coverage, graph);

  return plannedClaim
    ? createFocusForClaim(graph, plannedClaim.id, "grounded_question") ?? "wrap"
    : "wrap";
}
