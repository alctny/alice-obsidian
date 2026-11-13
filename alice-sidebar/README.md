# alice-sidebar

真正可停靠的 Obsidian 右側「開啟文件」面板，可與 Files、Outline 一樣拖曳及調整寬度。

## 安裝

1. 在專案根目錄執行 `npm run build:plugin`，將產生的 `dist/alice-sidebar/` 整個資料夾（`manifest.json`、`main.js`、`styles.css`）複製至筆記庫的 `.obsidian/plugins/alice-sidebar/`。
2. 在設定 → 第三方外掛啟用 **alice-sidebar**。
3. 首次啟用會在右側開啟面板；之後可使用命令 **alice-sidebar: 顯示開啟文件** 或左側 Files 圖示重新顯示。
4. 同時更新 alice-mindnight 主題的 `theme.css`，移除之前的浮動分頁效果。

## 操作

- 按 `Option+O`（其他平台為 `Alt+O`）依目前排列順序循環切換「開啟文件」所在分頁群組的所有子標籤；焦點在編輯器時也可使用。
- 使用者拖入同一群組的新面板會自動加入切換，移出的面板不再參與；側邊欄收起時，按鍵會先展開開啟文件。
- 可在 **設定 → 快捷鍵** 搜尋 **alice-sidebar: 切換側邊欄子標籤** 修改按鍵；已自訂的快捷鍵仍沿用原設定。
- 點擊文件名切換到該分頁。標題相同的分頁會分別列出，懸停可查看文件路徑。
- 可讀青綠茶杯：關閉未釘選分頁，沿用 Obsidian 原生關閉流程。
- Alana 金色茶壺：取消釘選，不會關閉文件。
- 右鍵列：釘選／取消釘選。
- 焦點位於左右側邊欄時，原生 **Pin node** 快捷鍵會釘選／取消釘選最近使用的文件分頁；圖示顯示在對應文件列，側邊欄維持原有焦點。停用插件後恢復原生命令行為。
- 當前文件使用 Mystic 紫底、Alana 金色文字；操作按鈕僅依釘選狀態配色，未釘選為可讀青綠、已釘選為 Alana 金色，不隨目前文件、懸停或焦點狀態改變。書籍圖示代表文件面板，右側展開按鈕使用 Cheshire 笑臉。
- 所有主工作區分頁均列入，包括空白頁與非 Markdown 視圖；側邊欄自身不計入。

面板啟用時隱藏一般模式的原生文件分頁欄；停用外掛後自動恢復。Stacked tabs 保留原生分頁欄。

更新外掛樣式後，停用再啟用 **alice-sidebar**，讓 Obsidian 重新載入 `styles.css`。搭配 alice-mindnight 時，主題也會指定當前文件列的 Mystic 紫底與 Alana 金字，讓主題更新可套用相同配色。

面板透過 Obsidian 官方 Workspace / ItemView API 建立，可原生停靠及持久化位置。尚需在實際 Obsidian 工作區驗證互動。

## 程式碼導覽

- `main.js`：Obsidian 入口，只載入插件。
- `src/plugin.cjs`：註冊面板、命令與工具列入口。
- `src/view.cjs`：面板繪製及互動事件。
- `src/documents.cjs`：列舉主工作區分頁。
- `src/icons.cjs`：茶杯及茶壺圖示。
- `src/constants.cjs`：面板類型識別。
- `styles.css`：插件樣式，原生分頁欄僅在面板存在時隱藏。

`build.mjs` 將 `src/` 的 CommonJS 模組合併至單一 `main.js`，只保留 `obsidian` 作為執行時依賴。安裝包包含 `manifest.json`、`main.js`、`styles.css`，不需要複製原始碼或安裝額外套件。

從舊版本更新時，先停用 `Alice Open Files`，再將新安裝包放入 `.obsidian/plugins/alice-sidebar/` 並啟用 `alice-sidebar`，避免同時載入兩份插件。
