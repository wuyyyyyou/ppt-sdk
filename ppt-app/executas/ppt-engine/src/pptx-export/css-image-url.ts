function isCssWhitespace(value: string) {
  return value === " " || value === "\n" || value === "\r" || value === "\t" || value === "\f";
}

function isCssIdentifierCharacter(value: string | undefined) {
  return value !== undefined && /[a-zA-Z0-9_-]/.test(value);
}

function decodeCssEscapes(value: string) {
  let decoded = "";
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (character !== "\\") {
      decoded += character;
      continue;
    }

    const next = value[index + 1];
    if (next === undefined) continue;
    if (next === "\n" || next === "\f") {
      index += 1;
      continue;
    }
    if (next === "\r") {
      index += value[index + 2] === "\n" ? 2 : 1;
      continue;
    }

    if (/[0-9a-fA-F]/.test(next)) {
      let end = index + 1;
      while (end < value.length && end < index + 7 && /[0-9a-fA-F]/.test(value[end])) end += 1;
      const codePoint = Number.parseInt(value.slice(index + 1, end), 16);
      decoded += codePoint === 0 || codePoint > 0x10ffff ? "\uFFFD" : String.fromCodePoint(codePoint);
      if (isCssWhitespace(value[end])) end += 1;
      index = end - 1;
      continue;
    }

    decoded += next;
    index += 1;
  }
  return decoded;
}

export function extractCssImageUrls(value: string | null | undefined): string[] {
  if (!value) return [];

  const urls: string[] = [];
  let index = 0;
  while (index < value.length) {
    if (
      value.slice(index, index + 3).toLowerCase() !== "url"
      || isCssIdentifierCharacter(value[index - 1])
    ) {
      index += 1;
      continue;
    }

    let cursor = index + 3;
    while (isCssWhitespace(value[cursor])) cursor += 1;
    if (value[cursor] !== "(") {
      index += 3;
      continue;
    }
    cursor += 1;
    while (isCssWhitespace(value[cursor])) cursor += 1;

    const quote = value[cursor] === '"' || value[cursor] === "'" ? value[cursor] : null;
    if (quote) cursor += 1;
    const start = cursor;

    if (quote) {
      while (cursor < value.length) {
        if (value[cursor] === "\\") {
          cursor += 2;
          continue;
        }
        if (value[cursor] === quote) break;
        cursor += 1;
      }
      if (value[cursor] !== quote) break;
      const rawUrl = value.slice(start, cursor);
      cursor += 1;
      while (isCssWhitespace(value[cursor])) cursor += 1;
      if (value[cursor] !== ")") break;
      const url = decodeCssEscapes(rawUrl);
      if (url) urls.push(url);
      index = cursor + 1;
      continue;
    }

    while (cursor < value.length && value[cursor] !== ")") {
      if (value[cursor] === "\\" && cursor + 1 < value.length) cursor += 2;
      else cursor += 1;
    }
    if (value[cursor] !== ")") break;
    const url = decodeCssEscapes(value.slice(start, cursor).trim());
    if (url) urls.push(url);
    index = cursor + 1;
  }

  return urls;
}
