// Skip other fenced blocks so Mermaid examples inside them are never extracted.
export function* mermaidBlocks(source) {
  const lines = source.split('\n');
  let fence = null;
  let offset = 0;
  for (let index = 0; index < lines.length; index++) {
    const text = lines[index].replace(/\r$/, '');
    if (!fence) {
      const match = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(text);
      if (match) fence = {
        marker: match[1][0], size: match[1].length, line: index, start: offset,
        contentStart: offset + lines[index].length + 1,
        mermaid: match[2].trim().toLowerCase() === 'mermaid',
      };
    } else if (new RegExp(`^ {0,3}${fence.marker}{${fence.size},}\\s*$`).test(text)) {
      if (fence.mermaid) {
        yield {
          lineStart: fence.line, lineEnd: index,
          start: fence.start,
          end: offset + lines[index].length + (index < lines.length - 1 ? 1 : 0),
          content: source.slice(fence.contentStart, offset),
        };
      }
      fence = null;
    }
    offset += lines[index].length + 1;
  }
}

export function mermaidBlockAt(source, line) {
  for (const block of mermaidBlocks(source)) {
    if (line >= block.lineStart && line <= block.lineEnd) {
      const { lineStart, lineEnd, ...result } = block;
      return result;
    }
  }
  return null;
}
