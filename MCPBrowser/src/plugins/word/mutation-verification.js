/** Compare full clipboard text, not Word's virtualized viewport or event acknowledgements. */
export function normalizeDocumentText(text) {
  return text
    .replace(/\u200B/g, '')
    .replace(/\s+/gu, ' ')
    .trim();
}

export function planTextReplacement(text, query, replacement, options, matchCount) {
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const expression = new RegExp(escaped, options.matchCase ? 'gu' : 'giu');
  const matches = [...text.matchAll(expression)].filter((match) => {
    if (!options.wholeWords) return true;
    const before = [...text.slice(0, match.index)].at(-1) || '';
    const after = text.slice(match.index + match[0].length);
    return !/[\p{L}\p{N}_]/u.test(before) && !/^[\p{L}\p{N}_]/u.test(after);
  });
  // Word's linguistic search can differ from literal matching. Never guess a target.
  if (matches.length !== matchCount) return null;
  const selected = options.replaceAll ? matches : [matches[(options.occurrence ?? 1) - 1]];
  if (selected.some((match) => !match)) return null;
  let expected = text;
  for (const match of selected.reverse()) {
    expected =
      expected.slice(0, match.index) + replacement + expected.slice(match.index + match[0].length);
  }
  return expected;
}

export async function verifyDocumentText(readText, before, expected, timeoutMs = 5_000) {
  const deadline = Date.now() + timeoutMs;
  const normalizedBefore = normalizeDocumentText(before);
  const normalizedExpected = normalizeDocumentText(expected);
  let observedChange = false;
  let observedReadableText = false;
  let attempts = 0;
  let lastReadReason = null;
  do {
    const current = await readText();
    attempts++;
    if (current.accepted && typeof current.text === 'string') {
      observedReadableText = true;
      const normalized = normalizeDocumentText(current.text);
      observedChange ||= normalized !== normalizedBefore;
      const whitespaceOnlyChange = before !== expected && normalizedBefore === normalizedExpected;
      if (
        normalized === normalizedExpected &&
        (!whitespaceOnlyChange || current.text === expected)
      ) {
        return {
          accepted: true,
          changed: current.text !== before,
          verification: 'full_document_text',
        };
      }
    } else {
      lastReadReason = current.reason || 'clipboard_payload_unavailable';
    }
    if (Date.now() >= deadline) break;
    await new Promise((resolve) => setTimeout(resolve, 250));
  } while (true);
  return {
    accepted: false,
    changed: null,
    reason: observedReadableText ? 'content_not_verified' : 'verification_unavailable',
    observedChange,
    attempts,
    ...(observedReadableText ? {} : { lastReadReason }),
  };
}
