# 台灣人生模擬 Taiwan Life Game 
 
> 參考木原共《あなたをプレイするのはなに？》（森美術館 六本木クロッシング 2025）
> Vue 3 + LLM 前端直連 + Cloudflare Pages 一鍵部署

## 架構

```
┌─────────────────────────────────────────────┐
│  Vue 3 Frontend (Vite)                      │
│  • Pinia store + localStorage 持久化         │
│  • LLM 直連（Gemini / Claude，user-side key）│
│  • D3.js 分支樹                              │
│  • 黑底白字 / Courier 等寬字型               │
└────────────────┬────────────────────────────┘
                 │ /api/stats /api/snapshot
                 ▼
┌─────────────────────────────────────────────┐
│  Cloudflare Pages Functions                 │
│  • functions/api/*.js                       │
│  • 從 backend/data/stats.js 出資料           │
│  • 失業率 / 出生數 / 結婚數（build 期抓）    │
└─────────────────────────────────────────────┘
```

前端 = 純靜態檔；API = Pages Functions；資料 = build 期抓進 repo 的 JSON。
本機 dev 也可以用 `backend/server.js` 跑 Node 版（同一份邏輯）。

---

## 本機開發

```bash
# 1. 安裝
cd frontend && npm install
cd ../backend && npm install

# 2. （選）刷新台灣統計資料
cd backend && npm run refresh

# 3a. 走純 Vite + 本機 Node API
cd backend && npm run dev    # http://localhost:8000  (在另一個 terminal)
cd frontend && npm run dev   # http://localhost:5173

# 3b. 模擬 Cloudflare Pages 環境
cd frontend && npm run build
npx wrangler pages dev frontend/dist
```

開啟頁面後到 settings 填 Gemini 或 Claude API Key（存 localStorage，不會上傳）。

---

## 部署到 Cloudflare Pages

**方法 A：連 GitHub（推薦）**

1. Push 這個 repo 到 GitHub。
2. Cloudflare Dashboard → Workers & Pages → Create → Pages → Connect to Git。
3. 選你的 repo，Build settings 填：
   - Framework preset: `None`
   - Build command: `cd frontend && npm install && npm run build`
   - Build output directory: `frontend/dist`
   - Root directory: `/`（保留預設）
4. 部署完成。`/api/stats`、`/api/snapshot`、`/api/health` 自動由 `functions/` 目錄提供。

**方法 B：直接用 wrangler**

```bash
cd frontend && npm install && npm run build
npx wrangler pages deploy frontend/dist --project-name taiwan-life-game
```

> Pages Functions 會自動部署，不需要額外設定。

---

## 資料更新

`backend/data/stats.js` 是 commit 進 repo 的快照（失業率 / 出生數 / 結婚數），更新方式：

```bash
cd backend
npm run refresh   # = node scripts/fetch.js && node scripts/build.js
git add backend/data/
git commit -m "data: refresh Taiwan stats"
```

來源：

| 資料 | 來源 |
|------|------|
| 縣市別失業率 | 主計總處 mp0101a10.xml |
| 出生數量 | 內政部 opdadm 開放資料 |
| 結婚人數 | 內政部 statis（年齡層） |

---

## LLM 供應商

| Provider | Model | 前端直連 | 備註 |
|----------|-------|----------|------|
| Google Gemini | `gemini-2.0-flash` | ✅ 原生支援 | 推薦，便宜快速 |
| Anthropic Claude | `claude-haiku-4-5` | ✅（需 `dangerouslyAllowBrowser`） | 品質更穩定 |

> ⚠️ 前端直連 = API Key 暴露在使用者瀏覽器。此專案定位為單機 / 展覽 kiosk / 個人使用。
> 正式公開部署請把 LLM 呼叫移到 Pages Functions 後端。

---

## 持久化

所有遊戲狀態（角色、原型、歷史、分支、cast、RELIVE 計數）都存在 `localStorage` key `tlg:game`。
重新整理或關閉瀏覽器都不會中斷。設定頁有「清除存檔」按鈕。

---

## 遊戲設計核心

| 機制 | 實作 |
|------|------|
| 角色生成 | 12 歲開始，國中一年級 |
| 人生原型 | 20 種台灣社會樣本，整局保持一致 |
| 統計注入 | 角色出生地的失業率/出生數會帶入每個節點 prompt |
| 戲劇轉折池 | 88 條人生危機，依年齡分層擲（~32%） |
| 轉機池 | 45 條向上機會，與 drama 獨立擲（~28%） |
| 時代背景 | 45 個真實/推測歷史事件，依角色當年自動套用 |
| 角色名冊 | LLM 記下出現過的人，後面節點可重逢 |
| 延續性 | 每節點輸出 8 欄結構化狀態，下節點 prompt 強制不可違反 |
| 選項數 | 每節點 2 個方向截然不同的岔路 |
