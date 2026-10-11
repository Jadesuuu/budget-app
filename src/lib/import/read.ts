import "server-only";
import { extractText, getDocumentProxy } from "unpdf";
import type { ImportRow } from "@/lib/reconcile/match";
import { readBankCsv } from "./csv";

/** A statement/history PDF layout. Added only from real (redacted) samples, like email parsers. */
export type PdfStatementParser = {
  id: string;
  label: string;
  matches(text: string): boolean;
  parse(text: string): ImportRow[];
};

/** GCash transaction-history PDF is next, once a redacted sample is available. */
export const PDF_PARSERS: PdfStatementParser[] = [];

export type ReadResult =
  | { ok: true; format: string; rows: ImportRow[]; skipped: number }
  | { ok: false; error: string; needsPassword?: boolean };

const MAX_BYTES = 5_000_000;

/**
 * Reads an uploaded history or statement. The PDF password is used once, in memory, to open the file and is
 * never stored or logged (CLAUDE.md).
 */
export async function readImportFile(file: { name: string; bytes: Uint8Array }, password?: string): Promise<ReadResult> {
  if (file.bytes.byteLength > MAX_BYTES) return { ok: false, error: "That file is over 5 MB." };
  const name = file.name.toLowerCase();

  if (name.endsWith(".csv") || name.endsWith(".txt")) {
    const result = readBankCsv(new TextDecoder().decode(file.bytes));
    return "error" in result ? { ok: false, error: result.error } : { ok: true, format: "csv", ...result };
  }

  if (name.endsWith(".pdf")) {
    let text: string;
    try {
      const pdf = await getDocumentProxy(new Uint8Array(file.bytes), password ? { password } : {});
      const extracted = await extractText(pdf, { mergePages: true });
      text = Array.isArray(extracted.text) ? extracted.text.join("\n") : extracted.text;
    } catch (error) {
      if ((error as { name?: string }).name === "PasswordException") {
        return password
          ? { ok: false, error: "That password didn't open the file.", needsPassword: true }
          : { ok: false, error: "This file is password-protected. Enter its password.", needsPassword: true };
      }
      return { ok: false, error: "Couldn't open this PDF." };
    }
    const parser = PDF_PARSERS.find((p) => p.matches(text));
    if (!parser) {
      return {
        ok: false,
        error: "This PDF layout isn't supported yet. A blacked-out sample is all that's needed to add it; meanwhile, a CSV export works.",
      };
    }
    const rows = parser.parse(text);
    return rows.length ? { ok: true, format: parser.id, rows, skipped: 0 } : { ok: false, error: "No transactions found in this PDF." };
  }

  return { ok: false, error: "Upload a CSV or PDF file." };
}
