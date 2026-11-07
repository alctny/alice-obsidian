# Alice Midnight

以愛麗絲夢遊仙境為靈感的 Obsidian 深色主題：午夜藍背景、冰藍連結、薰衣草紫標題，以及玫瑰粉和淡金點綴。使用原生 CSS 變數，保留 Obsidian 的版面與字體設定，無需 JavaScript、外部字型或其他插件。

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
| 編輯區・午夜墨藍 | `#111521` |
| 側邊欄・深夜藍 | `#0c101a` |
| 浮層・靛藍 | `#191f30` |
| Alice 冰藍 | `#9acbf9` |
| 薰衣草紫 | `#c4b5f5` |
| 玫瑰粉 | `#efa9c6` |
| 懷錶淡金 | `#e8ce98` |
| 薄荷綠 | `#a3d9c3` |
| 主要文字 | `#e3eaf5` |

涵蓋閱讀模式與 Live Preview 的標題、連結、引用、清單、任務、標籤、表格、程式碼與 callout；並設定側邊欄、分頁、搜尋、屬性、對話框、Graph 和 Canvas 的原生色彩變數。

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

本專案不需要建置流程，直接編輯 `theme.css` 即可。修改 `manifest.json` 後請重啟 Obsidian。

已檢查 manifest JSON、CSS 括號與宣告結構、深色模式作用域、自訂變數引用及壓縮檔內容。預設主要文字對背景的對比為 15.05:1，次要文字為 8.82:1，程式碼註解為 5.43:1。這些是靜態檢查；尚未在 Obsidian 桌面版或手機版實際驗證畫面與互動。

實作依據：[Obsidian 官方主題開發說明](https://github.com/obsidianmd/obsidian-developer-docs/blob/main/en/Themes/App%20themes/Build%20a%20theme.md)、[官方色彩變數](https://github.com/obsidianmd/obsidian-developer-docs/blob/main/en/Reference/CSS%20variables/Foundations/Colors.md)。
