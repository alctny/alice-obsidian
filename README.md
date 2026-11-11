# Alice Midnight

以迪士尼 1951 年版《愛麗絲夢遊仙境》為靈感的 Obsidian 深色主題。編輯區以森林陰影的炭灰為底，浮層帶有暖棕。裙藍用於主標題與連結，髮金用於次標題與標籤，正文採用圍裙暖白。使用原生 CSS 變數，保留 Obsidian 的版面與字體設定，無需 JavaScript、外部字型或其他插件。

## 安裝

適用於 Obsidian 1.10.6 以上版本。

可直接將 `Alice-Midnight-1.0.0.zip` 解壓縮至 vault 的 `.obsidian/themes/`，壓縮檔已包含 `Alice Midnight` 資料夾；或依照以下步驟手動安裝：

1. 在你的 vault 裡建立 `.obsidian/themes/Alice Midnight/` 資料夾。若使用自訂設定資料夾，請用該資料夾取代 `.obsidian`。
2. 將本專案的 `manifest.json` 與 `theme.css` 放入其中，資料夾名稱必須為 `Alice Midnight`。
3. 重新啟動 Obsidian，前往 **設定 → 外觀 → 主題**，選擇 **Alice Midnight**。
4. 將 **基礎配色方案** 設為 **深色**。

```text
你的 vault/
└── .obsidian/
    └── themes/
        └── Alice Midnight/
            ├── manifest.json
            └── theme.css
```

這是原生 Theme，安裝位置是 `themes`。淺色模式維持 Obsidian 預設外觀；本主題的所有樣式都限定於深色模式。

## 配色

| 用途 | 顏色 |
| --- | --- |
| 編輯區・森林炭灰 | `#191c1e` |
| 側邊欄・髮帶黑 | `#121416` |
| 浮層・深灰 | `#242729` |
| Alice 裙藍 | `#65baff` |
| 薰衣草紫 | `#c9b6e0` |
| 蜜桃色 | `#f1ac8c` |
| Alice 髮金 | `#ffd16a` |
| 霧青綠 | `#9ecbc1` |
| 主要文字・圍裙暖白 | `#f4eee5` |

涵蓋閱讀模式與 Live Preview 的標題、連結、引用、清單、任務、標籤、表格、程式碼與 callout；並設定側邊欄、分頁、搜尋、屬性、對話框、Graph 和 Canvas 的原生色彩變數。

## 大綱標題圖示

H1 在閱讀模式和即時預覽中會顯示 Alice 頭像。若要讓原生大綱也按 H1–H6 顯示相同圖示，請將本專案的 `alice-outline-icons` 資料夾複製到 vault 的 `.obsidian/plugins/`，重新載入 Obsidian，然後在 **設定 → 第三方外掛** 啟用 **Alice Outline Icons**。此配套外掛適用於 Obsidian 1.15.0 以上的桌面版。

## 自訂

主要互動色可在 **設定 → 外觀 → 強調色** 調整。固定的標題、語意色與裝飾色使用 Alice 配色。

如需修改配色，可建立 `.obsidian/snippets/alice-custom.css`，並在 **設定 → 外觀 → CSS 片段** 啟用。例如：

```css
.theme-dark {
  --alice-blue: #afd8ff;
  --alice-lilac: #d0c0ff;
  --alice-ink: #141827;
}
```

## 檢視效果

將 [Alice Showcase.md](Alice%20Showcase.md) 複製到 vault，切換閱讀模式、Live Preview 與原始碼模式檢視。也可打開命令面板、搜尋、Graph 和 Canvas 檢查各介面的配色。

## 開發與打包

需要 Node.js 20 以上版本；只使用 Node.js 內建功能，不需要安裝套件。主題使用者不需要 Node.js。

```text
src/
├── theme.css                 # 日常編輯的 CSS
└── assets/                   # 原始 SVG
scripts/
├── build.mjs                 # 開發部署與發布建置
└── build.test.mjs
dev.config.example.json       # 本機開發設定範例
manifest.json
theme.css                     # 自動產生的發布檔案
```

請編輯 `src/theme.css` 與 `src/assets/*.svg`。原始 CSS 使用 `url("./assets/名稱.svg")` 引用圖檔；根目錄的 `theme.css` 由腳本產生，請勿直接修改。

### Obsidian 桌面版即時預覽

Obsidian 將主題 CSS 注入頁面，因此開發模式會將圖片引用改寫成 Obsidian 的本地資源 URL，實際讀取獨立 SVG，不會把圖片嵌入 CSS。

1. 在要預覽的 vault 開啟 Obsidian 開發者工具的 Console，執行：

   ```js
   const themeFolder = `${app.vault.configDir}/themes/Alice Midnight`;
   console.log(JSON.stringify({
     themeDir: `${app.vault.adapter.getBasePath()}/${themeFolder}`,
     resourceBase: app.vault.adapter.getResourcePath(`${themeFolder}/assets`)
   }, null, 2));
   ```

2. 將輸出的 JSON 存為本專案根目錄的 `dev.config.json`。格式可參考 `dev.config.example.json`；本機設定已列入 `.gitignore`。請使用測試 vault：開發腳本會覆寫該主題資料夾的 `manifest.json`、`theme.css` 與同名 SVG。更換 vault 或電腦後，重新取得設定。

3. 在專案目錄執行：

   ```sh
   npm run dev
   ```

4. 在 Obsidian 的 **設定 → 外觀** 選擇 **Alice Midnight**，基礎配色設為深色。首次安裝如未出現主題，請重新載入 Obsidian。

開發模式會先部署一次，接著監看 `src/theme.css` 與 `src/assets/`。修改 CSS 或 SVG 後，腳本先更新圖檔，再寫入主題 CSS；圖片 URL 的版本參數也會更新，讓 Obsidian 重新載入圖片。終端機按 `Ctrl+C` 結束監看。修改 `manifest.json` 後，請重新啟動開發腳本與 Obsidian。

也可指定設定檔：`node scripts/build.mjs dev /absolute/path/to/config.json`。開發設定與含本機路徑的 CSS 不會寫入根目錄的發布檔案。

### 產生發布檔案

```sh
npm test
npm run build
```

建置時會讀取原始 SVG，以 Base64 data URL 嵌入根目錄的 `theme.css`，保留背景圖與遮罩圖示的原有樣式。發布或製作安裝壓縮檔時，只需要 `manifest.json` 與這份 `theme.css`；不需要附帶 `src/assets/`、開發設定或建置腳本。根目錄的產生檔應一併提交，讓 Obsidian 的社群主題安裝流程可直接使用。

`npm test` 會驗證七個 SVG 的嵌入內容、其餘 CSS 的保留、開發資源 URL／圖檔部署，以及修改 SVG 和 CSS 後的自動更新。

已檢查 manifest JSON、CSS 括號與宣告結構、深色模式作用域、自訂變數引用及壓縮檔內容。預設主要文字・圍裙暖白對背景的對比為 14.85:1，次要文字為 8.91:1，程式碼註解為 6.40:1。這些是靜態檢查；尚未在 Obsidian 桌面版或手機版實際驗證畫面與互動。

實作依據：[Obsidian 官方主題開發說明](https://github.com/obsidianmd/obsidian-developer-docs/blob/main/en/Themes/App%20themes/Build%20a%20theme.md)、[官方色彩變數](https://github.com/obsidianmd/obsidian-developer-docs/blob/main/en/Reference/CSS%20variables/Foundations/Colors.md)。
