# 台灣人生模擬 ── Taiwan Life Game

> 你即將替一個由 AI 生成的虛構台灣人做選擇。
> 從 12 歲走到退休。
> 他的人生會展開成一棵分支樹 ── 你走過的，與沒走的。

參考木原共《あなたをプレイするのはなに？》（森美術館 六本木クロッシング 2025）。
這不是「人生選擇」遊戲，是一場關於「身為一個台灣人，會被哪些東西塑形」的展覽級體驗。

---

## 它在做什麼

每一場遊戲是 **一個從未存在過的台灣人** 從國中走到退休的人生模擬。

不是隨機事件 + 文字冒險。每個節點都同時被五層東西注入：

```
角色（人生原型 + 玩家替他說的願望 + 出生年/縣市）
   ↓
台灣即時統計（他出生地的失業率、出生數、結婚年齡層）
   ↓
時代背景（他活到的那一年，台灣與世界正在發生什麼）
   ↓
戲劇/轉機/打破節奏的事件池（依年齡擲）
   ↓
角色名冊（過去出現過的人，依關係類型衰減地有機會回來）
   ↓
LLM 生成下一個節點
```

每個節點兩個選項，方向截然不同。選了之後 LLM 會輸出 **下一個節點 + 八欄結構化狀態**，下一個節點被強制不能違反這份狀態。延續性就是這樣壓出來的。

人生跑到 65-70 歲會被標記為終局，LLM 會根據 **整段軌跡的每一個 situation** 寫一段 250-300 字的回望散文。

---

## 為什麼這個值得玩

### 1. 每場開局都是真的不一樣的台灣人

20 種預設原型隨機抽一個，整局鎖死：

| 切面 | 原型範例（共 20 種） |
|------|----------------------|
| 都會精英 | 台北雙薪補習家、新竹竹科二代、台中商二代小開 |
| 北漂二代 | 新北蛋白區舊公寓、桃園工業區外移子弟 |
| 中南部 | 雲林農家、嘉義小鎮文具店、屏東漁村、台南老街三代 |
| 工藝/在地 | 鹿港工藝家後代、宜蘭民宿家庭、花蓮原住民部落 |
| 邊緣處境 | 單親家庭低收、新住民母親二代、隔代教養 |
| 特殊樣本 | 高雄重工業家庭、台東部落老師之子、金門離島 |

原型不是裝飾。它鎖住出生地、家庭組成、智力傾向、外貌設定、個性、處境限制 ── 並在每個節點 prompt 裡持續注入，所以一個雲林農家小孩不會中途被 LLM 偷偷改寫成北漂工程師。

### 2. 願望先說，角色後生

開局流程：

```
START  →  替這個尚未出生的孩子說一個願望  →  AI 生成角色  →  人生節點...
```

性別在 JS 端先擲 50/50（不然 LLM 永遠生男生），然後跟願望一起塞進角色生成 prompt：「這是玩家替這個 12 歲的孩子預先說出的心願，請讓 summary 隱約呼應這份心願 ── 但不要讓 12 歲的孩子直接說出這個夢想（孩子自己還說不清楚）」。

結局也會繞回這個願望，但不會直接說「你實現了 / 沒實現夢想」── 讓讀者自己感受。

### 3. 真實台灣統計直接餵給 LLM

`/api/stats`、`/api/snapshot`、`/api/health` 都從 build 期抓進 repo 的 `backend/data/stats.js` 出資料：

| 資料 | 來源 |
|------|------|
| 縣市別失業率 | 主計總處 mp0101a10.xml |
| 出生數量 | 內政部 opdadm 開放資料 |
| 結婚人數（年齡層） | 內政部 statis |

每個節點 prompt 都會把 **角色出生地的失業率/出生數** 用 ★ 標出來，並且要求 LLM「角色所在地失業率高，找工作選項的描述就應該帶有焦慮感」、「結婚年齡層集中 30-34 歲，35 歲還沒結婚的選項可以反映家人開始催」。

統計不是給玩家看的數字，是壓在 LLM 肩膀上的真實重量。

### 4. 時代不是背景，是會打到你身上的東西

`MACRO_EVENTS` 收了 **45 個** 真實或推測的台灣大事，每個都標了西元年區間：

```
解嚴 (1987-88) ・ 921 (1999-00) ・ SARS (2003) ・ 太陽花 (2014)
八仙塵爆 (2015) ・ 同婚合法化 (2019-20) ・ COVID-19 (2020-22)
俄烏戰爭 (2022-26) ・ 0403 花蓮地震 (2024) ・ 川普 2.0 (2025-28)
```

LLM 接到 prompt 時，**根據角色當年的西元年自動套用** 那年發生的事件之一，並要求「請讓這個節點的情境真實反映這個時代背景 ── 可以是直接衝擊（失業、回國、染疫、被裁員），也可以是擦邊（朋友的事、新聞引發的對話、日常被打亂的小事）」。

2026 之後的事件是「推測但合理」的延伸 ── 台海情勢、能源轉型、少子化大學退場、AI 取代知識工作、長照爆發、機器人照護、海平面上升。這些 hint 帶「（可能）」前綴，讓 LLM 知道這是建議不是史實。

### 5. 戲劇 / 轉機 / 跳出框架 ── 三個獨立擲骰的事件池

光靠 LLM 生節點，故事很快會變成自我重複的水流。所以每個節點獨立擲三次：

| 池 | 機率 | 內容 | 角色 |
|----|------|------|------|
| **DRAMA_POOL** ⚠ | ~32% | 88+ 條人生危機（依年齡分 5 層：teen/young/mid/late/end） | 父母外遇、配偶失業、孩子被霸凌、被詐騙、創業失敗、健康警訊、喪偶... |
| **OPPORTUNITY_POOL** ★ | ~28% | 45+ 條向上機會（同樣分 5 層） | 老師發現你的才能、獎學金、貴人提攜、副業意外爆紅、好對象出現... |
| **CURVEBALL_POOL** 🎲 | ~20% | 30+ 條打破節奏的「怪事」 | 一封寄錯的信、迷上業餘無線電、被誤認、家裡突然冒出沒人提過的親戚... |

三個池可以在同一個節點全部命中。最動人的故事常常就發生在這種交叉點 ── **「父親病倒那年我拿到獎學金」**。

OPPORTUNITY 是專門對抗 LLM 的「悲情雪球」傾向：給雲林農家二代的人生注入真實的向上槓桿，不要讓玩家覺得「不管選哪個都是死路」。

CURVEBALL 是專門對抗節奏單調：如果前幾節點都是工作線，這個節點就強迫岔開到完全不同的軸；但要求「**起點要從目前狀態自然走出去**，不可以無預警把人空降到別的人生」。

### 6. 角色名冊：人會老、會走遠、偶爾會回來

每個節點 LLM 輸出的 `cast[]` 會被累積進名冊。但下一節點不會把整個名冊倒進 prompt ── 那會變成「每節點都圍繞同一群舊人」的災難。

`sampleVisibleCast()` 用兩條規則過濾：

- **永久關係**（配偶/孩子/父母/阿公阿嬤）── 永遠在背景
- **半永久**（兄弟姊妹/岳家）── 60% 起跳，緩慢衰減
- **其他**（同學/前任/同事/鄰居）── 指數衰減：一年內 ~55%，五年後 ~30%，二十年後 ~10%

加上一個獨立的 35% 機率擲「這個節點認識新的人」 ── 強制 situation 出現一個之前沒提過的具名人物（同事、新鄰居、相親對象、補習班同學、孩子的老師...）。

結果：人生一邊累積、一邊汰換，重逢有重量，新人有空間。

### 7. 八欄結構化狀態鎖延續性

每個節點 LLM 必須輸出 `state_projections.if_a` 和 `if_b`，每邊都有：

```
location ・ education ・ occupation ・ relationship
family ・ finances ・ health ・ notable
```

玩家選了之後，那一邊會被存進 `history[i].state_after`。下一節點 prompt 把這份狀態當「**不可違反的事實**」塞給 LLM：

> 目前狀態說你在高雄開咖啡店，下一節點不可以突然把你寫成台北上班族；
> 目前狀態說你已婚有兩個小孩，下一節點不可以說你還在跟初戀曖昧。

這是抗 LLM 漂移的真正辦法 ── 不是 prompt 裡寫「請保持一致」，是 **每個節點都先告訴它「事實是這樣，不可以矛盾」**。

### 8. RELIVE 不是讀檔，是分歧樹的另一條路

死亡（其實是退休）後，玩家有 **3 次 RELIVE**。

點任何一個過去的節點 → 系統用該節點 **保存的 LLM 原始輸出** 翻面到另一個選項 → 從那一刻重新生成接下來的人生。

被丟掉的舊路 **不會消失**。它會變成虛線 + 半透明的鬼影分支，掛在分歧點旁邊；如果舊路走到 LIFE OVER，鬼影列底還會掛一條短線 + `LIFE OVER` 字樣。

同一個分歧點可以反覆 RELIVE，每次都會多一條鬼影列在旁邊展開。

### 9. 分支樹本身就是作品

參考森美術館展品的視覺語言。

- 每個決策 = 一顆鑽石
- 主幹按 **「右右左左」配對** zig-zag，跟你選 A/B 無關，所以一直選 A 不會讓樹歪到一邊
- 走過的選擇 = 實線 + 標籤 + 旁邊一條短虛線「另一條路」（LIFE OVER 後可點選 RELIVE）
- 鬼影路 = 半透明虛線 + 灰鑽石

固定像素、不自動縮放 ── 字級永遠讀得到，太寬就橫向捲動。

### 10. 全部存在你的瀏覽器

```
key: tlg:game

character / archetype / gender / pendingDream
currentNode / history / reliveRemaining / isOver / ending / stats
```

刷新、關 tab、隔天回來，全部還在。展覽 kiosk 斷電也不會中斷。

API Key 也在 localStorage（`tlg:settings`）。**從來不會傳到任何後端伺服器。**

---

## 架構

```
┌─────────────────────────────────────────────────────┐
│  Vue 3 Frontend (Vite)                              │
│  • Pinia + pinia-plugin-persistedstate              │
│  • LLM 直連（Gemini / Claude，使用者自己的 key）    │
│  • D3.js 分支樹                                     │
│  • 黑底白字 / 等寬字型 / 終端機美學                 │
└────────────────┬────────────────────────────────────┘
                 │ /api/stats /api/snapshot /api/health
                 ▼
┌─────────────────────────────────────────────────────┐
│  Cloudflare Worker（Workers + Static Assets）        │
│  • worker/index.js 處理 /api/*                       │
│  • 其他路由由 ASSETS binding 從 frontend/dist 出     │
│  • SPA 路由由 not_found_handling 處理                │
└─────────────────────────────────────────────────────┘
```

不是 Pages Functions（純 Pages 已被 Cloudflare 標記淘汰）。
是 **新版** Workers + Static Assets ── 一個 worker 同時負責 API 與靜態檔。

---

## 本機開發

```bash
# 安裝
cd frontend && npm install
cd ../backend && npm install
cd ..        && npm install   # 根目錄是 wrangler

# （選）刷新台灣統計資料
cd backend && npm run refresh

# 純前端開發（最常用）
cd frontend && npm run dev      # http://localhost:5173

# 完整模擬 Cloudflare Worker 環境
npm run dev                     # build + wrangler dev
```

開頁面後，第一次點 `> START` 會跳出 **動畫引導模式** ── 高亮 API Key 欄、跳動箭頭、AI Studio 一鍵跳轉教學、貼進去後 SAVE 鈕變成「SAVE & START」。免費 Gemini key 三分鐘搞定。

---

## 部署

```bash
npm run deploy   # = build + wrangler deploy
```

`wrangler.toml`：

```toml
name = "lifegame-taiwan"
main = "worker/index.js"
compatibility_date = "2025-01-01"

[assets]
directory = "./frontend/dist"
binding = "ASSETS"
not_found_handling = "single-page-application"

[observability]
enabled = true
```

---

## LLM Provider

| Provider | Model | 直連 | 備註 |
|----------|-------|------|------|
| Google Gemini | `gemini-3.1-flash-lite` | ✅ | **推薦**，免費，AI Studio 自助申請 |
| Anthropic Claude | `claude-haiku-4-5` | ✅（需 `dangerouslyAllowBrowser`） | 文字品質更穩定，需儲值 |

> ⚠ 前端直連 = API Key 會暴露在使用者瀏覽器。
> 此專案定位為 **單機 / 展覽 kiosk / 個人使用**。
> 正式公開部署請把 LLM 呼叫移到 Worker 後端。

---

## prompts.js 核心結構

`frontend/src/services/prompts.js` 是這個遊戲的真正大腦。三個 export：

### `promptCharacter(stats, archetype, gender, dream)`
12 歲角色生成 prompt。注入：
- 台灣即時統計 snapshot
- 抽到的人生原型整段
- 預擲的性別 + 玩家說出的願望
- 8 欄輸出（name/gender/birth_year/birth_place/family_background/income_tier/education_path/current_status/personality/current_age/summary）

### `promptNextNode(character, history, stats, archetype)`
人生節點生成 prompt。在 system message 裡組合：

```
原型 block
DRAMA hint（~32%）
OPPORTUNITY hint（~28%）
MACRO 時代事件 hint（~45%，依角色當年篩）
CURVEBALL hint（~20%）
meet-new-person flag（35%）
+ 統計 block（角色所在地用 ★ 標出）
+ 11 條【設計原則】
+ 當前年齡階段 hint
+ 「目前狀態（不可違反的事實）」+ 已走過的人生（每節點完整 situation）
+ 角色名冊（按關係類型 + 時間衰減過濾）
+ 期望年齡推進
```

輸出包含 cast[]、choices[2]、state_projections.{if_a, if_b}、is_terminal。

### `promptEnding(character, history, archetype)`
退休回望散文。重點：
- 整段軌跡每一個 situation 都餵進去（不是只餵 title）
- 累積後的完整名冊
- 最後狀態
- 強制要求結局「具體呼應 2-3 個關鍵節點 + 至少提到一個具名人物」
- 最後一句呼應當初的願望，但不直接說有沒有實現

---

## 遊戲設計核心對照表

| 機制 | 實作位置 | 目的 |
|------|----------|------|
| 角色生成 | `promptCharacter` | 12 歲開始，國中一年級 |
| 人生原型 | `services/archetypes.js` | 20 種台灣樣本，整局鎖死 |
| 統計注入 | `statsBlock(stats, character)` | 角色所在地的失業率/出生數帶入每節點 |
| 戲劇轉折 | `DRAMA_POOL` × 5 年齡層 | 88+ 條人生危機，~32% 擲入 |
| 轉機機會 | `OPPORTUNITY_POOL` × 5 年齡層 | 45+ 向上機會，~28% 獨立擲 |
| 跳出框架 | `CURVEBALL_POOL` | 30+ 條打破節奏事件，~20% |
| 時代背景 | `MACRO_EVENTS` × 45 | 真實/推測歷史事件，依角色當年自動套 |
| 角色名冊 | `sampleVisibleCast()` | 永久/半永久/衰減三種篩選邏輯 |
| 認識新人 | `meetNew` flag | 35% 強制讓新具名人物登場 |
| 延續性 | `state_projections` 8 欄 | 下節點 prompt 強制不可違反 |
| 兩岔路 | `choices[2]` | 必為方向截然不同的兩條路 |
| RELIVE | `reliveFrom(historyIndex)` | 3 次，舊分支變鬼影留在樹上 |
| 分支樹 | `BranchTree.vue` | 右右左左 zig-zag + 鬼影路 |
| 持久化 | `pinia-plugin-persistedstate` | localStorage `tlg:game` / `tlg:settings` |

---

## 資料更新

```bash
cd backend
npm run refresh                       # = fetch.js && build.js
git add backend/data/stats.js
git commit -m "data: refresh Taiwan stats"
```

---

## 持久化與隱私

所有遊戲狀態 + API Key 都只存在你的瀏覽器 localStorage。
**從來不會傳到任何伺服器（包含本專案的 Worker）。**
LLM 呼叫從你的瀏覽器直接打到 Google / Anthropic。
設定頁有「清除目前進度」與「清除全部（含 API Key）」按鈕。

---

## License & 致敬

設計概念參考木原共《あなたをプレイするのはなに？》，森美術館 六本木クロッシング 2025。
台灣化版本：以台灣社會樣本、台灣統計、台灣時代事件，重新講一次「人生是被什麼東西塑形」的故事。
