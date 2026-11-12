const en = {
  filename: 'File name', renameError: 'Unable to rename Mermaid file: ', invalidFilename: 'Enter a valid file name without a folder path.',
  edit: 'Source', preview: 'Preview',
  zoomOut: 'Zoom out', zoomIn: 'Zoom in', resetZoom: 'Reset zoom to 100%',
  source: 'Mermaid source', minimap: 'Diagram minimap',
  empty: 'This file is empty. Edit the Mermaid source to get started.',
  resetZoomCommand: 'Reset zoom', createCommand: 'New mermaid',
  createMenu: 'New mermaid', createError: 'Unable to create Mermaid file: ',
  blockFileExists: 'File already exists: ',
  blockMoveError: 'Mermaid file created, but Markdown could not be updated. The original block was kept. Check file write permissions. New file: ',
  blockSourceChanged: 'Markdown changed. The block was kept; retry from its context menu.',
  untitled: 'Untitled', start: 'Start', end: 'End',
  missingDelimiter: 'Frontmatter is missing the closing ---.',
  invalidFrontmatter: 'Frontmatter must be a YAML object.',
  invalidConfig: 'config must be a YAML object.',
};
const zhTW = {
  filename: '文件名', renameError: '無法重新命名 Mermaid 文件：', invalidFilename: '請輸入有效的文件名，不可包含目錄路徑。',
  edit: 'Source', preview: 'Preview',
  zoomOut: '縮小圖表', zoomIn: '放大圖表', resetZoom: '重設縮放為 100%',
  source: 'Mermaid 原始碼', minimap: '圖表導覽縮圖',
  empty: '文件為空，請編輯 Mermaid 原始碼。',
  resetZoomCommand: '恢復預設縮放', createCommand: 'New mermaid',
  createMenu: 'New mermaid', createError: '無法建立 Mermaid 文件：',
  blockFileExists: '文件已存在：',
  blockMoveError: 'Mermaid 文件已建立，但 Markdown 更新失敗，原代碼塊已保留。請檢查原文件的寫入權限。新文件：',
  blockSourceChanged: 'Markdown 內容已變更，原代碼塊已保留，請重新開啟右鍵選單操作。',
  untitled: '未命名', start: '開始', end: '結束',
  missingDelimiter: 'Frontmatter 缺少結尾的 ---。',
  invalidFrontmatter: 'Frontmatter 必須是 YAML 物件。',
  invalidConfig: 'config 必須是 YAML 物件。',
};
const zhCN = {
  filename: '文件名', renameError: '无法重命名 Mermaid 文件：', invalidFilename: '请输入有效的文件名，不可包含目录路径。',
  edit: 'Source', preview: 'Preview',
  zoomOut: '缩小图表', zoomIn: '放大图表', resetZoom: '重置缩放为 100%',
  source: 'Mermaid 源代码', minimap: '图表导航缩略图',
  empty: '文件为空，请编辑 Mermaid 源代码。',
  resetZoomCommand: '恢复默认缩放', createCommand: 'New mermaid',
  createMenu: 'New mermaid', createError: '无法创建 Mermaid 文件：',
  blockFileExists: '文件已存在：',
  blockMoveError: 'Mermaid 文件已创建，但 Markdown 更新失败，原代码块已保留。请检查原文件的写入权限。新文件：',
  blockSourceChanged: 'Markdown 内容已变更，原代码块已保留，请重新打开右键菜单操作。',
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
