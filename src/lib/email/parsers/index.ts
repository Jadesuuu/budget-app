import type { TemplateParser } from "./types";

/**
 * One parser per bank email template, each with redacted fixtures in fixtures/emails/<institution>/.
 * Parsers are added only from real (redacted) samples, never from guessed formats.
 */
export const TEMPLATE_PARSERS: TemplateParser[] = [];
