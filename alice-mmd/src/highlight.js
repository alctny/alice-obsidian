import { mermaidBlocks } from './blocks.js';

const keywords = new Set(`graph flowchart sequenceDiagram classDiagram stateDiagram stateDiagram-v2
erDiagram journey gantt pie quadrantChart requirementDiagram gitGraph mindmap timeline
zenuml sankey-beta xyChart xychart-beta block-beta packet-beta architecture-beta kanban
radar-beta treemap-beta accTitle accDescr title direction subgraph end
participant actor as activate deactivate create destroy box autonumber loop alt else
opt par and critical option break rect note Note over left right of link links
class classDef style linkStyle click call href callback default interpolate
state fork join choice concurrent composite hide empty description
section dateFormat axisFormat tickInterval excludes includes todayMarker
after until milestone done active crit vert id type risk verifymethod
requirement functionalRequirement interfaceRequirement performanceRequirement
physicalRequirement designConstraint element contains copies derives satisfies verifies
refines traces commit branch checkout switch merge cherry-pick reset
TB TD BT LR RL true false null`.split(/\s+/));

// Offsets stay in UTF-16, matching CodeMirror even with Chinese labels or emoji.
const mermaidTokens = /%%\{[\s\S]*?(?:\}%%|$)|%%[^\r\n]*|"(?:\\[\s\S]|[^"\\])*"?|'(?:\\[\s\S]|[^'\\])*'?|`[^`]*`?|[|o}{]{1,2}--[|o}{]{1,2}|[<|o*x]{0,2}(?:-\.+-|[-=]+)(?:\|>|[>o*x]{0,2})|\|[^|\r\n]+\||:::|::|[\p{L}_$](?:[\p{L}\p{N}_$]|[.-](?=[\p{L}\p{N}_$]))*|-?\b\d+(?:\.\d+)?\b|[\[\]{}():,;<>+*#&=]/gu;
const yamlTokens = /#[^\r\n]*|"(?:\\.|[^"\\])*"?|'(?:''|[^'])*'?|[\p{L}_][\p{L}\p{N}_-]*(?=\s*:)|\b(?:true|false|null)\b|-?\b\d+(?:\.\d+)?\b|[:{}\[\],|>!-]/gu;

export function mermaidTokensFor(source, offset = 0) {
  const tokens = [];
  const add = (from, to, kind) => tokens.push({ from: from + offset, to: to + offset, kind });
  let bodyStart = 0;
  const frontmatter = /^\uFEFF?---[ \t]*\r?\n/.exec(source);
  if (frontmatter) {
    const close = /^---[ \t]*\r?$/gm;
    close.lastIndex = frontmatter[0].length;
    const end = close.exec(source);
    const yamlEnd = end?.index ?? source.length;
    add(0, frontmatter[0].trimEnd().length, 'meta');
    for (const match of source.slice(frontmatter[0].length, yamlEnd).matchAll(yamlTokens)) {
      const text = match[0];
      const kind = text[0] === '#' ? 'comment' : /^["']/.test(text) ? 'string'
        : /^[\p{L}_]/u.test(text) ? (['true', 'false', 'null'].includes(text) ? 'keyword' : 'property')
        : /^-?\d/.test(text) ? 'number' : 'punctuation';
      add(frontmatter[0].length + match.index, frontmatter[0].length + match.index + text.length, kind);
    }
    if (end) add(end.index, end.index + end[0].trimEnd().length, 'meta');
    bodyStart = end ? end.index + end[0].length : source.length;
  }
  for (const match of source.slice(bodyStart).matchAll(mermaidTokens)) {
    const text = match[0];
    const kind = text.startsWith('%%{') ? 'meta' : text.startsWith('%%') ? 'comment'
      : /^["'`]/.test(text) || /^\|.+\|$/.test(text) ? 'string'
      : /^[<|o*x}{]{0,2}(?:-\.+-|[-=]+)/.test(text) || text === ':::' ? 'operator'
      : keywords.has(text) ? 'keyword' : /^-?\d/.test(text) ? 'number'
      : /^[\p{L}_$]/u.test(text) ? 'variable' : 'punctuation';
    add(bodyStart + match.index, bodyStart + match.index + text.length, kind);
  }
  return tokens;
}

export function mermaidHighlights(source, markdown = false) {
  if (!markdown) return mermaidTokensFor(source);
  return [...mermaidBlocks(source, { includeUnclosed: true })]
    .flatMap(block => mermaidTokensFor(block.content, block.contentStart));
}
