const INSTRUCTION_SEPARATOR = /\r?\n---\r?\n/;

/**
 * Keeps the human-reviewed instruction block in design/examiner-agent.md as the
 * source of truth while keeping Markdown headings and implementation notes out
 * of the model prompt.
 */
export function extractExaminerInstructions(markdown: string): string {
  const sections = markdown.split(INSTRUCTION_SEPARATOR);
  const instructions = sections[1]?.trim();

  if (!instructions?.startsWith("You are Viva,")) {
    throw new Error(
      "design/examiner-agent.md must contain the examiner instructions between horizontal rules.",
    );
  }

  return instructions;
}
