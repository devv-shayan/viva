/**
 * Returns the server-only OpenAI API key or fails with an actionable message.
 *
 * Keep this call inside API routes and other server-only code. The browser
 * receives short-lived Realtime client secrets, never this key.
 */
export function requireOpenAIKey(): string {
  const apiKey = process.env.OPENAI_API_KEY?.trim();

  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY is missing. Add it to .env.local before calling an OpenAI API route.",
    );
  }

  return apiKey;
}
