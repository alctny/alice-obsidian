import { translate } from './i18n.js';
import { diagramObjects } from './outline.js';

// No whitelist: Mermaid owns the meaning and validation of configuration keys.
export function readConfig(source, parseYaml, language = 'en') {
  const normalized = source.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  if (!/^---[ \t]*\n/.test(normalized)) return { source: normalized, config: {} };
  const match = normalized.match(/^---[ \t]*\n([\s\S]*?)^---[ \t]*(?:\n|$)/m);
  if (!match) throw new Error(translate('missingDelimiter', language));
  const metadata = parseYaml(match[1]);
  if (metadata == null) return { source: normalized, config: {} };
  if (typeof metadata !== 'object' || Array.isArray(metadata)) {
    throw new Error(translate('invalidFrontmatter', language));
  }
  const config = metadata.config ?? {};
  if (typeof config !== 'object' || Array.isArray(config)) {
    throw new Error(translate('invalidConfig', language));
  }
  return { source: normalized, config };
}

export function createRenderer(mermaid, parseYaml, getLanguage = () => 'en') {
  let queue = Promise.resolve();
  let sequence = 0;
  return (source, container, dark, isCurrent = () => true) => {
    const task = queue.then(async () => {
      if (!isCurrent()) return null;
      const document = readConfig(source, parseYaml, getLanguage());
      // initialize resets site defaults, including Mermaid's secure config keys.
      // Its DOM-ready lifecycle is disabled when the engine is first loaded.
      mermaid.initialize({
        startOnLoad: false,
        theme: dark ? 'dark' : 'default',
        ...document.config,
      });
      const id = `alice-mmd-${++sequence}`;
      try {
        let objects;
        if (mermaid.mermaidAPI?.getDiagramFromText && document.source.length <= (document.config.maxTextSize ?? 50000)) {
          objects = diagramObjects(await mermaid.mermaidAPI.getDiagramFromText(document.source), document.source);
        }
        const result = await mermaid.render(id, document.source, container);
        return objects ? { ...result, outlineObjects: objects } : result;
      } catch (error) {
        container.replaceChildren();
        throw error;
      }
    });
    queue = task.catch(() => {});
    return task;
  };
}
