export function extractJsonObject(text: string) {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("CLI returned empty output");

  // Fast path: already pure JSON
  try {
    return JSON.parse(trimmed);
  } catch {
    // continue
  }

  // Noisy output path: find any '{' or '[' and attempt parse from each position.
  // This avoids false starts like log prefixes: "[tools] ...".
  const starts: number[] = [];
  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed[i];
    if (ch === "{" || ch === "[") starts.push(i);
  }

  for (const idx of starts) {
    const candidate = trimmed.slice(idx);
    try {
      return JSON.parse(candidate);
    } catch {
      // try next candidate
    }
  }

  throw new Error(`No parseable JSON found in CLI output: ${trimmed.slice(0, 300)}`);
}
