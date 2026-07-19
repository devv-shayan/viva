import mammoth from "mammoth";

export async function extractAssignmentText(input: {
  bytes: Uint8Array;
  mimeType: "application/pdf" | "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
}) {
  if (input.mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    const result = await mammoth.extractRawText({ buffer: Buffer.from(input.bytes) });
    return result.value;
  }

  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: Buffer.from(input.bytes) });
  try {
    const result = await parser.getText();
    return result.text;
  } finally {
    await parser.destroy();
  }
}
