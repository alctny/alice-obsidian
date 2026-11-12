const en = {
  edit: 'Source', preview: 'Preview',
  zoomOut: 'Zoom out', zoomIn: 'Zoom in', resetZoom: 'Reset zoom to 100%',
  source: 'Mermaid source', minimap: 'Diagram minimap',
  empty: 'This file is empty. Edit the Mermaid source to get started.',
  resetZoomCommand: 'Reset zoom', createCommand: 'New mermaid',
  createMenu: 'New mermaid', createError: 'Unable to create Mermaid file: ',
  untitled: 'Untitled', start: 'Start', end: 'End',
  missingDelimiter: 'Frontmatter is missing the closing ---.',
  invalidFrontmatter: 'Frontmatter must be a YAML object.',
  invalidConfig: 'config must be a YAML object.',
};
const zhTW = {
  edit: 'Source', preview: 'Preview',
  zoomOut: '縮小圖表', zoomIn: '放大圖表', resetZoom: '重設縮放為 100%',
  source: 'Mermaid 原始碼', minimap: '圖表導覽縮圖',
  empty: '文件為空，請編輯 Mermaid 原始碼。',
  resetZoomCommand: '恢復預設縮放', createCommand: 'New mermaid',
  createMenu: 'New mermaid', createError: '無法建立 Mermaid 文件：',
  untitled: '未命名', start: '開始', end: '結束',
  missingDelimiter: 'Frontmatter 缺少結尾的 ---。',
  invalidFrontmatter: 'Frontmatter 必須是 YAML 物件。',
  invalidConfig: 'config 必須是 YAML 物件。',
};
const zhCN = {
  edit: 'Source', preview: 'Preview',
  zoomOut: '缩小图表', zoomIn: '放大图表', resetZoom: '重置缩放为 100%',
  source: 'Mermaid 源代码', minimap: '图表导航缩略图',
  empty: '文件为空，请编辑 Mermaid 源代码。',
  resetZoomCommand: '恢复默认缩放', createCommand: 'New mermaid',
  createMenu: 'New mermaid', createError: '无法创建 Mermaid 文件：',
  untitled: '未命名', start: '开始', end: '结束',
  missingDelimiter: 'Frontmatter 缺少结尾的 ---。',
  invalidFrontmatter: 'Frontmatter 必须是 YAML 对象。',
  invalidConfig: 'config 必须是 YAML 对象。',
};

export function translate(key, language = 'en') {
  const locale = language.toLowerCase().replaceAll('_', '-');
  const messages = /^zh(?:-|$)/.test(locale)
    ? (/^zh-(?:tw|hk|mo|hant)(?:-|$)/.test(locale) ? zhTW : zhCN)
    : en;
  return messages[key] ?? en[key] ?? key;
}
