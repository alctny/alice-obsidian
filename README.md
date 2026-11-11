# alice-mindnight

以《愛麗絲夢遊仙境》為靈感的 Obsidian 深色主題，採用 Mystic、Cute Fuchsia、Alana、Washed Out Orange 與 Simple Teal 五色色票。紫黑背景承接紫色介面層次，粉紫、柔金、暖橘與青綠分別標示標題、狀態、強調與導覽。使用原生 CSS 變數，保留 Obsidian 的版面與字體設定，無需 JavaScript、外部字型或其他插件。

## 安裝

適用於 Obsidian 1.10.6 以上版本。

可直接將 `alice-mindnight-1.0.0.zip` 解壓縮至 vault 的 `.obsidian/themes/`，壓縮檔已包含 `alice-mindnight` 資料夾；或依照以下步驟手動安裝：

1. 在你的 vault 裡建立 `.obsidian/themes/alice-mindnight/` 資料夾。若使用自訂設定資料夾，請用該資料夾取代 `.obsidian`。
2. 將建置後 `dist/alice-mindnight/` 中的 `manifest.json` 與 `theme.css` 放入其中，資料夾名稱必須為 `alice-mindnight`。
3. 重新啟動 Obsidian，前往 **設定 → 外觀 → 主題**，選擇 **alice-mindnight**。
4. 將 **基礎配色方案** 設為 **深色**。

```text
你的 vault/
└── .obsidian/
    └── themes/
        └── alice-mindnight/
            ├── manifest.json
            └── theme.css
```

這是原生 Theme，安裝位置是 `themes`。淺色模式維持 Obsidian 預設外觀；本主題的所有樣式都限定於深色模式。

本機開發可執行 `./install.sh /absolute/path/to/vault`，一次建置並更新該筆記庫的主題與配套側欄插件。不指定路徑時，使用 `~/Documents/zske`。腳本可從任意目錄呼叫，會保留 `dist/` 產物與既有插件資料，只覆寫對應的發布檔案。`./build.sh` 與 `npm run build` 僅建置，不會更新已安裝的主題。

## 配色設計

以五個原始色票為基礎，大面積使用低亮度紫黑中性色，Mystic 建立選取與表頭層次，Cute Fuchsia 引導閱讀與互動，Alana 標示重點與釘選，Washed Out Orange 提供暖色強調，Simple Teal 補充冷色導覽。原始色票集中定義為 CSS 變數，透明背景、懸停色與可讀文字色由這些色票衍生。

### 原始色票與用途

| 顏色名稱 | Hex | RGB | CSS 變數 | 主要用途 |
| --- | --- | --- | --- | --- |
| Mystic | `#461C89` | `(70, 28, 137)` | `--alice-mystic` | 當前文件與 tab 的底色、表頭、設定操作按鈕、程式碼區塊的紫色底調 |
| Cute Fuchsia | `#D57ACE` | `(213, 122, 206)` | `--alice-fuchsia` | H1／H5、文件標題、內部連結、預設強調色、引用側線、語法關鍵字 |
| Alana | `#F6D383` | `(246, 211, 131)` | `--alice-alana` | H2、當前文件文字、釘選茶壺、標籤、搜尋命中、游標 |
| Washed Out Orange | `#E7B280` | `(231, 178, 128)` | `--alice-orange` | H3、粗體、重要語法、運算子等暖色強調 |
| Simple Teal | `#1C8988` | `(28, 137, 136)` | `--alice-teal` | 行內程式碼與成功提示的底調；提亮後用於 H4、外部連結、未釘選茶杯及分隔線 |

### 色彩數值

| 顏色名稱 | CMYK (%) | HSV (°／%／%) | HSL (°／%／%) | RAL 參考 | Pantone 參考 |
| --- | --- | --- | --- | --- | --- |
| Mystic | `(49, 80, 0, 46)` | `(263.1, 79.6, 53.7)` | `(263.1, 66.1, 32.4)` | `5002` | `268 C` |
| Cute Fuchsia | `(0, 43, 3, 17)` | `(304.6, 42.7, 83.5)` | `(304.6, 52.0, 65.7)` | `3015` | `245 C` |
| Alana | `(0, 14, 47, 4)` | `(41.7, 46.7, 96.5)` | `(41.7, 86.5, 73.9)` | `1014` | `7403 C` |
| Washed Out Orange | `(0, 23, 45, 9)` | `(29.1, 44.6, 90.6)` | `(29.1, 68.2, 70.4)` | `1001` | `7508 C` |
| Simple Teal | `(80, 0, 1, 46)` | `(179.4, 79.6, 53.7)` | `(179.4, 66.1, 32.4)` | `5018` | `7473 C` |

Hex、RGB、CMYK、RAL 與 Pantone 依提供的色票資料記錄；HSV 與 HSL 由 RGB 計算至小數一位。介面實際以 Hex／sRGB 呈現，RAL 與 Pantone 作為提供的參考對照。

### 中性色與閱讀對比

| 用途 | 顏色／衍生方式 |
| --- | --- |
| 正文與側邊欄背景 | 紫黑 `#121017` |
| 對話框背景 | 深紫黑 `#191420` |
| 浮層／次級區域 | `#231B31`／`#30243E` |
| 邊框 | 灰紫 `#554360` |
| 主要／次要／淡色文字 | `#F5EEDF`／`#C7BBCE`／`#A89AB2` |
| 可讀青綠 | Simple Teal 60% + 白色 40%，約 `#77B8B8`；變數 `--alice-teal-readable` |

Mystic 作為背景，不直接用於深底上的小字。Simple Teal 原色對正文背景的對比約 4.48:1，因此小字、連結與圖示改用可讀青綠。預設主要文字對正文背景為 16.34:1，Fuchsia 標題為 6.75:1，可讀青綠為 8.40:1；Alana 對 Mystic 選取底色為 8.15:1。錯誤提示保留獨立紅色，避免與一般暖橘強調混淆。

### 元件配色

涵蓋閱讀模式與 Live Preview 的標題、連結、引用、清單、任務、標籤、表格、程式碼與 callout，並設定側邊欄、分頁、搜尋、屬性、對話框、Graph 和 Canvas 的色彩。

介面分隔線與 Markdown 水平分隔線使用可讀青綠到 Alana 的靜態漸變：橫線由左至右、直線由上至下。涵蓋側欄與分割面板、分頁列及分頁間隔、筆記庫資訊列、筆記屬性區底線、選單分隔線與設定群組內的分隔線。預設不透明度為 40%，可拖曳分隔線在滑鼠移入、拖曳或觸控時提高至 75%，並保留原生拖曳範圍與線寬。

表格表頭使用 Mystic `#461C89`。支援 CSS [`contrast-color()`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/color_value/contrast-color) 的版本會依底色自動選擇黑字或白字；較舊版本使用暖白 `#F5EEDF`，對預設表頭底色的對比為 10.17:1。表頭內的粗體與斜體也跟隨表頭字色。

筆記屬性的摺疊按鈕與「Property」按鈕位於屬性區塊底部，與分隔線同行，分隔線從控制項右側延伸。展開時箭頭朝上，收合後朝下；收合時只隱藏屬性列表，仍顯示 Property 按鈕。點擊 Property 或以鍵盤啟用按鈕後，沿用 Obsidian 原生新增與聚焦欄位的流程，立即展開屬性區。閱讀模式與 Live Preview 使用相同版面，不需要外掛配合。

顯示文件標題時，也可點擊文件標題與屬性列表之間的空白帶切換展開／收合。空白帶與底部箭頭共用原生摺疊事件，屬性欄位與 Property 按鈕保留各自的操作；標題下方的間距可透過 `--alice-properties-title-gap` 調整，預設為 `1rem`。

檔案總管中的當前文件、作用中的原生 tab，以及 alice-sidebar 的當前文件列，統一使用 Mystic 底色與 Alana 文字。操作按鈕的顏色僅依 pin 狀態決定：未釘選為可讀青綠茶杯，已釘選為 Alana 茶壺，不因目前文件、懸停或焦點改色。

正文中央背景使用 `alice-mindnight/src/assets/alice-reading.svg`：Alice 坐在紫色大蘑菇下讀書，透明背景、無文字、不包含 Cheshire。插畫維持 640 × 600 的比例，預設寬度為視窗的 20%、不透明度為 22%，並限制在正文區域的 80% 寬高內。介面使用上述五色系統，SVG 插畫保留其角色與場景的原始色彩。

## 大綱標題圖示

H1 在閱讀模式和即時預覽中會顯示 Alice 頭像。若要讓原生大綱也按 H1–H6 顯示相同圖示，請將本專案的 `alice-outline-icons` 資料夾複製到 vault 的 `.obsidian/plugins/`，重新載入 Obsidian，然後在 **設定 → 第三方外掛** 啟用 **Alice Outline Icons**。此配套外掛適用於 Obsidian 1.15.0 以上的桌面版。

## 自訂

主要互動色預設為 Cute Fuchsia，可在 **設定 → 外觀 → 強調色** 調整。固定的標題、語意色與裝飾色使用上述五色色票。

如需修改配色，可建立 `.obsidian/snippets/alice-custom.css`，並在 **設定 → 外觀 → CSS 片段** 啟用。例如：

```css
.theme-dark {
  --alice-mystic: #461c89;
  --alice-fuchsia: #d57ace;
  --alice-alana: #f6d383;
  --alice-orange: #e7b280;
  --alice-teal: #1c8988;
  --alice-active-background: var(--alice-mystic);
  --alice-divider-opacity: 40%;
  --alice-divider-opacity-hover: 75%;
  --alice-note-art-width: 20vw;
  --alice-note-art-opacity: 0.22;
}
```

既有 CSS 片段仍可使用相容變數：`--alice-blue`／`--alice-mint` 對應可讀青綠，`--alice-lilac` 對應 Fuchsia，`--alice-rose` 對應 Orange，`--alice-gold` 對應 Alana。alice-sidebar 沿用同一組變數與獨立配色預設值。

## 檢視效果

將 [Alice Showcase.md](alice-mindnight/Alice%20Showcase.md) 複製到 vault，切換閱讀模式、Live Preview 與原始碼模式檢視。也可打開命令面板、搜尋、Graph 和 Canvas 檢查各介面的配色。

## 開發與打包

需要 Node.js 20 以上版本；只使用 Node.js 內建功能，不需要安裝套件。主題使用者不需要 Node.js。

```text
alice-mindnight/
├── src/theme.css             # 主題樣式
├── src/assets/               # 主題 SVG
├── scripts/                  # 主題建置與測試
└── manifest.json             # 主題發布資訊來源
alice-sidebar/
├── main.js                   # Obsidian 入口
├── src/                      # 插件生命週期、面板、文件列表、圖示
├── styles.css                # 面板樣式與原生分頁切換
├── manifest.json
├── build.mjs
└── tests/
dist/alice-sidebar/        # 插件安裝包（建置產生）
alice-mindnight/dev.config.example.json
dist/alice-mindnight/         # 主題安裝包（manifest.json、theme.css）
```

請編輯 `alice-mindnight/src/theme.css` 與 `alice-mindnight/src/assets/*.svg`。原始 CSS 使用 `url("./assets/名稱.svg")` 引用圖檔；`dist/alice-mindnight/theme.css` 由腳本產生，請勿直接修改。

### Obsidian 桌面版即時預覽

Obsidian 將主題 CSS 注入頁面，因此開發模式會將圖片引用改寫成 Obsidian 的本地資源 URL，實際讀取獨立 SVG，不會把圖片嵌入 CSS。

1. 在要預覽的 vault 開啟 Obsidian 開發者工具的 Console，執行：

   ```js
   const themeFolder = `${app.vault.configDir}/themes/alice-mindnight`;
   console.log(JSON.stringify({
     themeDir: `${app.vault.adapter.getBasePath()}/${themeFolder}`,
     resourceBase: app.vault.adapter.getResourcePath(`${themeFolder}/assets`)
   }, null, 2));
   ```

2. 將輸出的 JSON 存為本專案根目錄的 `dev.config.json`。格式可參考 `alice-mindnight/dev.config.example.json`；本機設定已列入 `.gitignore`。請使用測試 vault：開發腳本會覆寫該主題資料夾的 `manifest.json`、`theme.css` 與同名 SVG。更換 vault 或電腦後，重新取得設定。

3. 在專案目錄執行：

   ```sh
   npm run dev
   ```

4. 在 Obsidian 的 **設定 → 外觀** 選擇 **alice-mindnight**，基礎配色設為深色。首次安裝如未出現主題，請重新載入 Obsidian。

開發模式會先部署一次，接著每 250 毫秒檢查 `alice-mindnight/src/theme.css` 與 `alice-mindnight/src/assets/` 中的 SVG 是否變更，不依賴原生檔案監看事件。修改 CSS 或 SVG 後，腳本先更新圖檔，再寫入主題 CSS；每張圖片的 URL 版本參數由該 SVG 內容的 SHA-256 摘要產生。修改插畫會更新其 URL，讓 Obsidian 重新載入；只調整 CSS 時，未改動的圖片保留原有 URL。終端機按 `Ctrl+C` 結束監看。修改 `alice-mindnight/manifest.json` 後，請重新啟動開發腳本與 Obsidian。

也可指定設定檔：`node alice-mindnight/scripts/build.mjs dev /absolute/path/to/config.json`。開發設定與含本機路徑的 CSS 不會寫入根目錄的發布檔案。

### 產生發布檔案

```sh
npm test
npm run build
```

建置時會讀取原始 SVG，以 Base64 data URL 嵌入`dist/alice-mindnight/theme.css`，保留背景圖與遮罩圖示的原有樣式。發布或製作安裝壓縮檔時，只需要 `manifest.json` 與這份 `theme.css`；不需要附帶 `alice-mindnight/src/assets/`、開發設定或建置腳本。主題安裝包輸出至 `dist/alice-mindnight/`，主題名稱仍為 `alice-mindnight`。

`npm test` 會驗證主題 SVG 的嵌入內容、其餘 CSS 的保留、開發資源 URL／圖檔部署，以及修改 SVG 和 CSS 後的自動更新；也會驗證新版閱讀插畫的漸層、裁切遮罩與內部引用完整保留，以及圖片內容變更時的快取版本更新。

已檢查 manifest JSON、CSS 括號與宣告結構、深色模式作用域、自訂變數引用及壓縮檔內容。五色色票的主要文字、標題、連結與選取列已依預設背景計算對比值，詳見「配色設計」。這些是靜態檢查；尚未在 Obsidian 桌面版或手機版實際驗證畫面與互動。

實作依據：[Obsidian 官方主題開發說明](https://github.com/obsidianmd/obsidian-developer-docs/blob/main/en/Themes/App%20themes/Build%20a%20theme.md)、[官方色彩變數](https://github.com/obsidianmd/obsidian-developer-docs/blob/main/en/Reference/CSS%20variables/Foundations/Colors.md)。

## 開啟文件側邊欄

搭配 [alice-sidebar](alice-sidebar/README.md) 可將開啟的文件以真正的右側面板呈現，支援文件切換、關閉與釘選。插件與主題各自獨立運作。執行 `npm run build:plugin` 後，將 `dist/alice-sidebar/` 整個資料夾安裝至筆記庫的 `.obsidian/plugins/`。

### 分開建置

在專案根目錄執行 `./build.sh`，即可一次建置主題與插件；需要 Node.js 20 以上版本。腳本可從任意目錄呼叫，任一步驟失敗時會停止，成功後列出產物路徑。

- `npm run build:theme`：只產生 `dist/alice-mindnight/` 主題安裝包。
- `npm run build:plugin`：只產生 `dist/alice-sidebar/` 插件安裝包。
- `npm run build`：建置兩者；不會修改已安裝的筆記庫。

主題負責外觀與背景資源；插件負責側邊欄內容、文件切換、關閉及釘選。插件自帶樣式與色彩預設值，可搭配其他主題。
