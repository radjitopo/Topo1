export function splitSqlStatements(source) {
  const statements = [];
  let statement = '';
  let dollarTag = '';
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    const next = source[index + 1];

    if (inLineComment) {
      statement += character;
      if (character === '\n') inLineComment = false;
      continue;
    }

    if (inBlockComment) {
      statement += character;
      if (character === '*' && next === '/') {
        statement += next;
        index += 1;
        inBlockComment = false;
      }
      continue;
    }

    if (dollarTag) {
      if (source.startsWith(dollarTag, index)) {
        statement += dollarTag;
        index += dollarTag.length - 1;
        dollarTag = '';
      } else {
        statement += character;
      }
      continue;
    }

    if (inSingleQuote) {
      statement += character;
      if (character === "'" && next === "'") {
        statement += next;
        index += 1;
      } else if (character === "'") {
        inSingleQuote = false;
      }
      continue;
    }

    if (inDoubleQuote) {
      statement += character;
      if (character === '"' && next === '"') {
        statement += next;
        index += 1;
      } else if (character === '"') {
        inDoubleQuote = false;
      }
      continue;
    }

    if (character === '-' && next === '-') {
      statement += character + next;
      index += 1;
      inLineComment = true;
      continue;
    }

    if (character === '/' && next === '*') {
      statement += character + next;
      index += 1;
      inBlockComment = true;
      continue;
    }

    if (character === "'") {
      statement += character;
      inSingleQuote = true;
      continue;
    }

    if (character === '"') {
      statement += character;
      inDoubleQuote = true;
      continue;
    }

    if (character === '$') {
      const match = source.slice(index).match(/^\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/);
      if (match) {
        dollarTag = match[0];
        statement += dollarTag;
        index += dollarTag.length - 1;
        continue;
      }
    }

    if (character === ';') {
      const clean = statement.trim();
      if (clean) statements.push(clean);
      statement = '';
      continue;
    }

    statement += character;
  }

  const clean = statement.trim();
  if (clean) statements.push(clean);
  return statements;
}
