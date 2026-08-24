function normalizeOptionLabel(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function damerauLevenshtein(left, right) {
  const a = [...left];
  const b = [...right];
  const matrix = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));

  for (let row = 0; row <= a.length; row += 1) matrix[row][0] = row;
  for (let column = 0; column <= b.length; column += 1) matrix[0][column] = column;

  for (let row = 1; row <= a.length; row += 1) {
    for (let column = 1; column <= b.length; column += 1) {
      const cost = a[row - 1] === b[column - 1] ? 0 : 1;
      matrix[row][column] = Math.min(
        matrix[row - 1][column] + 1,
        matrix[row][column - 1] + 1,
        matrix[row - 1][column - 1] + cost,
      );

      if (row > 1 && column > 1 && a[row - 1] === b[column - 2] && a[row - 2] === b[column - 1]) {
        matrix[row][column] = Math.min(matrix[row][column], matrix[row - 2][column - 2] + cost);
      }
    }
  }

  return matrix[a.length][b.length];
}

export function optionSimilarity(left, right) {
  const normalizedLeft = normalizeOptionLabel(left);
  const normalizedRight = normalizeOptionLabel(right);
  if (!normalizedLeft || !normalizedRight) return 0;
  if (normalizedLeft === normalizedRight) return 1;

  const leftTokens = normalizedLeft.split(' ');
  const rightTokens = normalizedRight.split(' ');
  const sortedLeft = [...leftTokens].sort().join(' ');
  const sortedRight = [...rightTokens].sort().join(' ');
  if (sortedLeft === sortedRight) return 0.99;

  const compactLeft = normalizedLeft.replace(/\s+/g, '');
  const compactRight = normalizedRight.replace(/\s+/g, '');
  const longest = Math.max(compactLeft.length, compactRight.length);
  if (!longest) return 0;

  const distance = damerauLevenshtein(compactLeft, compactRight);
  return Math.max(0, 1 - distance / longest);
}

export function possibleOptionDuplicate(label, options = []) {
  const normalizedLabel = normalizeOptionLabel(label);
  const compactLabel = normalizedLabel.replace(/\s+/g, '');
  if (!compactLabel) return null;

  let closest = null;
  for (const option of options) {
    const normalizedOption = normalizeOptionLabel(option?.label);
    const compactOption = normalizedOption.replace(/\s+/g, '');
    if (!compactOption) continue;

    const similarity = optionSimilarity(label, option.label);
    const distance = damerauLevenshtein(compactLabel, compactOption);
    const shortest = Math.min(compactLabel.length, compactOption.length);
    const sameWords =
      normalizedLabel.split(' ').sort().join(' ') === normalizedOption.split(' ').sort().join(' ');
    const likely =
      normalizedLabel === normalizedOption ||
      sameWords ||
      (distance === 1 && shortest >= 4) ||
      (distance === 2 && shortest >= 8 && similarity >= 0.8);

    if (!likely || (closest && closest.similarity >= similarity)) continue;
    closest = {
      optionId: option.optionId ?? option.id,
      label: option.label,
      similarity: Number(similarity.toFixed(2)),
    };
  }

  return closest;
}
