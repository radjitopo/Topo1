export function compactSource(source) {
  return source.replace(/\s+/g, '');
}

export function extractTopLevelDeclaration(source, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const startMatch = source.match(
    new RegExp(`^(?:(?:async\\s+)?function|const|let)\\s+${escaped}\\b`, 'm'),
  );
  if (!startMatch || startMatch.index === undefined) return '';

  const start = startMatch.index;
  const rest = source.slice(start + startMatch[0].length);
  const nextMatch = rest.match(/^(?:(?:async\s+)?function|const|let)\s+[A-Za-z_$][\w$]*\b/m);
  const end =
    nextMatch?.index === undefined ? source.length : start + startMatch[0].length + nextMatch.index;
  return source.slice(start, end).trim();
}
