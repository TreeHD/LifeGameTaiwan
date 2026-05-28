# 台灣版人生模擬遊戲：完整企劃書 v2.0

> 參考作品：木原共《あなたをプレイするのはなに？― ありうる人生たちのゲーム》
> 森美術館 六本木クロッシング 2025 展
> 技術合作：Polygoose Studio × Anthropic（Claude）/ Google（Gemma 3）

---

## 一、概念核心

### 作品命題

**「是什麼在 Play 你的人生？」**

玩家扮演一個由 AI 根據台灣統計數據生成的虛構台灣人，從出社會走到退休，在每個人生節點做出選擇，最終看見自己走過的那條路——以及那些沒走的岔路。

遊戲揭示的不只是「一個人的故事」，而是 **2020 年代台灣社會的集體命運**：高房價、少子化、科技業薪資斷層、北漂南漂、世代焦慮。

當你替一個陌生人做選擇時，你不自覺暴露的，其實是你自己的價值觀。

### 與日本原作的差異

| 面向 | 日本原作 | 台灣版設計 |
|------|---------|-----------|
| 角色來源 | 日本統計 + 日本人口 | 台灣主計總處 + 內政部 + 勞動部 |
| 節點設計 | 預設固定節點 | **LLM 動態生成**（依角色歷史即時產生） |
| 節點數量 | 約 10-12 個 | 10-14 個（由 LLM 決定，依角色年齡自然收尾） |
| 時間跨度 | 日本當代 | 台灣當代（含特有社會事件：921、健保、台積電等） |
| 分支視覺 | 白色流程圖 on 黑底 | 同風格，前端 D3.js 即時渲染 |
| 重來機制 | 1 次（RELIVE） | 1 次（同原作，顯示計數器） |
| 統計透明度 | Loading 時顯示資料來源 | 同設計，顯示主計總處資料集名稱 |

---

## 二、遊戲流程設計

### 完整流程圖

```
[開始]
  │
  ▼
[Loading 畫面]
  顯示「Generating character with AI...」
  同時列出資料來源（主計總處、內政部、勞動部）
  │
  ▼
[角色展示頁]
  姓名 / 年齡 / 縣市 / 職業 / 家庭背景
  像素風格剪影圖像（與原作相同）
  → 玩家點 NEXT
  │
  ▼
[輸入夢想]
  「這個人有一個夢想。你幫他說出來。」
  文字輸入框
  │
  ▼
[人生節點循環]──────────────────────────┐
  顯示：年份 / 年齡 / 情境描述（LLM生成）  │
  顯示：6-8 個選項                         │
  玩家選擇                                 │
  ↓                                        │
  [分支樹即時更新]                          │
  ↓                                        │
  若未達退休 → 生成下一節點 ────────────────┘
  若達退休 → 進入結局
  │
  ▼
[LIFE OVER]
  LLM 生成退休回顧文字（200字）
  顯示完整分支樹（走過的路 + 未走的岔路）
  RELIVE (N times left) / QUIT
  │
  ├─ RELIVE → 角色不變，歷史清空，重新走
  └─ QUIT → 結束
```

### 節點生成邏輯

每個節點由 LLM **即時動態生成**，不使用預設腳本。

**生成依據：**
- 角色的出身背景（縣市、家庭收入層、教育路徑）
- 角色的夢想
- 過去所有選擇的累積歷史
- 台灣當前統計數據快照

**節點類型（LLM 自由組合）：**
- 教育岔路（技職 vs 普大 vs 直接就業）
- 職涯抉擇（跳槽、轉職、創業、考公職）
- 居住困境（買房、北漂、移居中南部）
- 感情與家庭（結婚、同居、生育、離婚）
- 家庭責任（父母照護、家族事業接班）
- 社會事件隨機插入（台積電效應、少子化衝擊、景氣波動）
- 中年危機（倦怠、轉換跑道、移民考量）
- 退休準備（勞保、投資、照護父母）

---

## 三、技術架構

### 3.1 系統架構總覽

```
┌──────────────────────────────────────────────┐
│              前端（單頁 HTML）                  │
│  黑底白字 / 等寬字型 / D3.js 分支樹            │
│  觸控友善（展覽 kiosk 模式）                   │
└────────────────┬─────────────────────────────┘
                 │ fetch() API 呼叫
┌────────────────▼─────────────────────────────┐
│         Python 後端（FastAPI）                 │
│  /api/generate-character                      │
│  /api/generate-node                           │
│  /api/generate-ending                         │
└────────┬──────────────────┬───────────────────┘
         │                  │
┌────────▼──────┐   ┌───────▼────────────────────┐
│  LLM API      │   │  台灣統計資料快取             │
│  Gemini Flash │   │  每日 00:00 更新              │
│  (主要)       │   │  data.gov.tw / stat.gov.tw   │
│openai completions  │   └────────────────────────────┘
│  (備援)       │
└───────────────┘
```

### 3.2 台灣統計資料串接

#### 資料來源與 API 端點

```python
# 政府資料開放平台 — 無需 API Key
BASE = "https://data.gov.tw/api/v2/rest/datastore"

RESOURCE_IDS = {
    "unemployment":  "6637",   # 人力資源調查失業率（年齡層別）
    "wage":          "6647",   # 工業及服務業薪資統計
    "household":     "74869",  # 家庭收支-平均可支配所得
    "population":    "6472",   # 人口年齡性別分布
    "marriage":      "6459",   # 結婚登記數及比率
    "birth":         "6456",   # 出生登記數
}

# 補充硬編碼資料（主計總處無直接 API）
STATIC_STATS = {
    "house_price_income_ratio": {
        "台北市": 16.2, "新北市": 12.8, "桃園市": 9.5,
        "台中市": 9.1,  "台南市": 7.8,  "高雄市": 8.3,
        "全國":   9.8
    },
    "total_fertility_rate": 0.87,   # 2024
    "higher_edu_rate": 52.3,         # 大專以上比率(%)
    "median_age_first_marriage": {
        "male": 32.5, "female": 30.6  # 2024
    }
}
```

#### 完整資料抓取器

```python
import requests, json
from datetime import datetime, date
from pathlib import Path

class TaiwanStatsFetcher:
    CACHE_FILE = Path("stats_cache.json")
    
    def fetch(self, resource_id: str, limit: int = 10) -> dict:
        url = f"https://data.gov.tw/api/v2/rest/datastore/{resource_id}"
        try:
            r = requests.get(url, params={"limit": limit}, timeout=10)
            return r.json().get("result", {})
        except:
            return {}
    
    def build_snapshot(self) -> dict:
        """組建完整統計快照，結合 API 即時資料 + 靜態補充"""
        # 嘗試從 API 取得動態資料
        unemp_data = self.fetch("6637", limit=1)
        wage_data  = self.fetch("6647", limit=10)
        
        snapshot = {
            "date": date.today().isoformat(),
            "youth_unemployment_rate": self._parse_youth_unemp(unemp_data),
            "avg_wages_by_industry":   self._parse_wages(wage_data),
            **STATIC_STATS
        }
        
        # 快取寫入
        self.CACHE_FILE.write_text(
            json.dumps(snapshot, ensure_ascii=False, indent=2)
        )
        return snapshot
    
    def load_or_refresh(self) -> dict:
        """讀取快取（當日有效），否則重新抓取"""
        if self.CACHE_FILE.exists():
            cached = json.loads(self.CACHE_FILE.read_text())
            if cached.get("date") == date.today().isoformat():
                return cached
        return self.build_snapshot()
    
    def _parse_youth_unemp(self, data: dict) -> float:
        try:
            rec = data["records"][0]
            u20 = float(rec.get("20_24歲", 0) or 0)
            u25 = float(rec.get("25_29歲", 0) or 0)
            return round((u20 + u25) / 2, 2)
        except:
            return 5.8  # fallback
    
    def _parse_wages(self, data: dict) -> dict:
        wages = {}
        for rec in data.get("records", []):
            ind  = rec.get("行業別", "")
            wage = rec.get("平均月薪", 0)
            if ind and wage:
                try:
                    wages[ind] = int(str(wage).replace(",", ""))
                except:
                    pass
        return wages
```

### 3.3 LLM Prompt 設計

#### Prompt 1：角色生成

```python
def prompt_character(stats: dict) -> tuple[str, str]:
    system = f"""你是「台灣人生模擬」的角色生成引擎。
根據台灣 {datetime.now().year} 年真實統計，生成統計上合理的虛構台灣人。

【台灣統計背景】
- 青年失業率：{stats['youth_unemployment_rate']}%
- 台北房價所得比：{stats['house_price_income_ratio']['台北市']} 倍
- 全國生育率：{stats['total_fertility_rate']}（全球最低之一）
- 大專以上比率：{stats['higher_edu_rate']}%
- 男性初婚年齡中位數：{stats['median_age_first_marriage']['male']} 歲

【生成規則】
1. 出生地依人口比例：台北/新北30% > 桃竹中20% > 台南高雄20% > 其他
2. 家庭收入依五等份機率分配（各20%）
3. 職業依產業結構分配（服務業60%、製造業27%、農業3%）
4. 角色出生在 1985-2005 年間（適合模擬當代台灣人生）

嚴格輸出 JSON，不含多餘文字：
{{
  "name": "台灣常見姓名",
  "birth_year": 年份數字,
  "birth_place": "縣市",
  "family_background": "一句話描述家庭（例：雲林農家次子，父母務農）",
  "income_tier": "低收入/中低/中等/中高/高收入",
  "education_path": "技職/普通高中/大學/研究所",
  "personality": "個性特質一句話",
  "initial_dream": null
}}"""
    return system, "請生成一個角色"
```

#### Prompt 2：動態節點生成（核心）

```python
def prompt_next_node(character: dict, history: list, stats: dict) -> tuple[str, str]:
    past = "\n".join([
        f"  {h['year']}年（{h['age']}歲）[{h['node']}] → 選擇「{h['choice']}」"
        for h in history
    ]) or "  （人生剛開始）"
    
    current_age = 22 if not history else int(history[-1]['age']) + 4
    
    system = """你是台灣版人生模擬的關卡設計師。
根據角色背景與選擇歷史，生成下一個人生決策節點。

【設計原則】
1. 因果邏輯：選擇高薪科技業→下一節點可能出現過勞/職涯天花板
2. 年份推進：每節點間隔 3-8 年，以民國年表示
3. 台灣特色：融入真實台灣困境（健保、房價、北漂、少子化等）
4. 真實取捨：選項之間不能有明顯「正確答案」
5. 退休觸發：角色年齡達 65-70 歲時，設 is_terminal: true

嚴格輸出 JSON：
{
  "year": 民國年數字,
  "age": 年齡數字,
  "title": "節點標題（10字以內）",
  "situation": "情境描述（100字，第二人稱，不含統計數字）",
  "choices": [
    {"label": "選項（15字以內）", "hint": "這條路的暗示（不顯示給玩家）"},
    ...
  ],
  "is_terminal": false
}"""
    
    user = f"""角色：{json.dumps(character, ensure_ascii=False)}
已走過的人生：
{past}
當前大約年齡：{current_age} 歲
台灣現況：青年失業率 {stats['youth_unemployment_rate']}%，台北房價所得比 {stats['house_price_income_ratio']['台北市']} 倍

請生成下一個節點。"""
    return system, user
```

#### Prompt 3：退休結局

```python
def prompt_ending(character: dict, history: list) -> tuple[str, str]:
    trajectory = "\n".join([
        f"  {h['year']}年（{h['age']}歲）{h['node']}：「{h['choice']}」"
        for h in history
    ])
    system = "你是台灣人生故事的結局撰寫者，風格溫柔誠實，不說教，不評判選擇。"
    user = f"""
{character['name']}，出生於{character['birth_place']}。
夢想：{character.get('dream', '未說出的夢想')}

人生軌跡：
{trajectory}

請用 200-250 字、第二人稱，描述這個人退休時回望人生的心情。
最後一句話呼應他當初的夢想，但不要說「你實現了夢想」或「你沒有實現夢想」。
讓讀者自己感受。"""
    return system, user
```

### 3.4 LLM 客戶端（多供應商）

```python
import anthropic, json
import google.generativeai as genai

class LLMClient:
    def __init__(self, provider="gemini"):
        self.provider = provider
        if provider == "gemini":
            genai.configure(api_key="GEMINI_API_KEY")
            self.model = genai.GenerativeModel("gemini-2.0-flash")
        elif provider == "claude":
            self.client = anthropic.Anthropic(api_key="ANTHROPIC_API_KEY")
    
    def generate(self, system: str, user: str,
                 max_tokens: int = 1024) -> str:
        if self.provider == "gemini":
            resp = self.model.generate_content(f"{system}\n\n{user}")
            return resp.text.strip()
        elif self.provider == "claude":
            resp = self.client.messages.create(
                model="claude-haiku-4-5",
                max_tokens=max_tokens,
                system=system,
                messages=[{"role": "user", "content": user}]
            )
            return resp.content[0].text.strip()
    
    def generate_json(self, system: str, user: str) -> dict:
        """生成並解析 JSON，失敗時自動重試一次"""
        for attempt in range(2):
            raw = self.generate(system, user)
            try:
                # 去除可能的 markdown code block
                clean = raw.strip().removeprefix("```json").removesuffix("```").strip()
                return json.loads(clean)
            except json.JSONDecodeError:
                if attempt == 0:
                    user += "\n\n請確保輸出為合法 JSON，不含任何額外文字。"
        raise ValueError(f"LLM 無法輸出合法 JSON: {raw[:200]}")
```

### 3.5 核心遊戲引擎

```python
class TaiwanLifeGame:
    RELIVE_LIMIT = 1
    
    def __init__(self, llm_provider="gemini"):
        self.fetcher = TaiwanStatsFetcher()
        self.llm = LLMClient(provider=llm_provider)
        self.stats = self.fetcher.load_or_refresh()
    
    def new_game(self, dream: str) -> dict:
        sys_p, usr_p = prompt_character(self.stats)
        character = self.llm.generate_json(sys_p, usr_p)
        character["dream"] = dream
        
        sys_p, usr_p = prompt_next_node(character, [], self.stats)
        first_node = self.llm.generate_json(sys_p, usr_p)
        
        return {
            "character": character,
            "current_node": first_node,
            "history": [],
            "relive_remaining": self.RELIVE_LIMIT,
            "is_over": False,
            "ending": None
        }
    
    def make_choice(self, state: dict, choice_index: int) -> dict:
        node = state["current_node"]
        choice = node["choices"][choice_index]
        
        state["history"].append({
            "year":      f"民國{node['year']}年",
            "age":       str(node["age"]),
            "node":      node["title"],
            "choice":    choice["label"],
            "situation": node["situation"]
        })
        
        if node.get("is_terminal"):
            state["is_over"] = True
            sys_p, usr_p = prompt_ending(
                state["character"], state["history"]
            )
            state["ending"] = self.llm.generate(sys_p, usr_p)
            state["current_node"] = None
        else:
            sys_p, usr_p = prompt_next_node(
                state["character"], state["history"], self.stats
            )
            state["current_node"] = self.llm.generate_json(sys_p, usr_p)
        
        return state
    
    def relive(self, state: dict) -> dict:
        if state["relive_remaining"] <= 0:
            return {"error": "RELIVE 次數已用盡。"}
        state["relive_remaining"] -= 1
        state["history"] = []
        state["is_over"] = False
        state["ending"] = None
        sys_p, usr_p = prompt_next_node(
            state["character"], [], self.stats
        )
        state["current_node"] = self.llm.generate_json(sys_p, usr_p)
        return state
```

---

## 四、前端視覺設計

### 風格規範（參考原作）

| 元素 | 設定 |
|------|------|
| 背景色 | `#000000` 純黑 |
| 文字色 | `#FFFFFF` 純白 |
| 字型 | `Courier New` / `monospace`（等寬，呼應終端機感） |
| 節點顏色 | 決策點：白色菱形 ◇ / 終點：白色圓形 ○ |
| 走過的路徑 | 實線 |
| 未走的路徑 | 虛線（遊戲結束後顯示） |
| 動畫 | `Generating future...` 文字在 AI 生成時顯示於右上角 |
| Loading | 顯示「Generating character with AI...」＋下方列出資料來源 |

### 畫面結構

**頁面一：Loading（角色生成中）**
```
Generating character with AI...


  主計總處：2024年人力資源調查（薪資、失業率）
  內政部：2024年人口統計（結婚率、出生率）
  主計總處：2023年家庭收支調查（所得分位）
```

**頁面二：角色展示**
```
Here are the details of this person
> NEXT

[像素剪影]   陳怡君                    24 yrs
             門市服務員                 高雄市

  陳怡君，24 歲，高雄人。父親是工廠作業員，母親
  在市場賣菜。技職體系畢業後沒有繼續升學，在百貨
  公司化妝品專櫃工作。工作穩定但薪水不高，她常常
  在想，自己是不是可以有不一樣的人生。
```

**頁面三：輸入夢想**
```
這個人心裡有一個夢想。

你來替她說出來。

> ___________________________
```

**頁面四：人生節點**
```
民國 120 年  [Generating future...]

  你 28 歲。在百貨公司做了四年，主管說你表現很好，
  可以升組長。但這時候你發現，一個網路創業的機會
  出現了——你的朋友邀你一起做跨境電商。

  ◆ 接受升遷，繼續穩定的工作
  ◆ 辭職加入創業，賭一把
  ◆ 邊做正職邊偷偷接單，兩邊試試
  ◆ 去進修，先考張證照再說
```

**頁面五：LIFE OVER**
```
LIFE OVER

[顯示完整分支樹，走過實線，未走虛線]

RELIVE (1 times left)
> QUIT
```

### 分支樹技術（D3.js）

```javascript
// 即時更新分支樹
function updateTree(history, currentNode) {
    const nodes = history.map((h, i) => ({
        id: i,
        label: h.node,
        year: h.year,
        type: "visited"
    }));
    
    // 當前未選的選項顯示為虛線分支（LIFE OVER 時顯示）
    const links = history.slice(1).map((h, i) => ({
        source: i,
        target: i + 1,
        style: "solid"
    }));
    
    // D3 tree layout 渲染
    const treeLayout = d3.tree().size([width, height]);
    // ... 渲染邏輯
}
```

---

## 五、成本估算

### LLM 費用（每局遊戲）

| 呼叫類型 | 次數 | Token/次 | Gemini Flash 費用 |
|---------|------|---------|-----------------|
| 角色生成 | 1 | ~800 | ~$0.00008 |
| 節點生成 | 10-14 | ~600 | ~$0.0006 |
| 結局生成 | 1 | ~700 | ~$0.00007 |
| **合計** | 16 | — | **≈ $0.001/局** |

> Gemini 2.0 Flash：Input $0.10/1M tokens，Output $0.40/1M tokens
> Claude Haiku 3.5：約 4x 費用，但穩定度更高

### 台灣統計 API

全部免費，無需 API Key，每日快取一次即可。

---

## 六、開發時程

### Phase 1：資料與後端（第 1-2 週）

- [ ] 實作 `TaiwanStatsFetcher`，驗證所有 API 端點可正常抓取
- [ ] 建立每日快取機制
- [ ] 測試 Prompt，確保角色 JSON 格式穩定（≥95% 成功率）
- [ ] 測試節點生成，確認因果邏輯合理
- [ ] 實作完整 `TaiwanLifeGame` 引擎（CLI 版可玩）

### Phase 2：前端（第 3-4 週）

- [ ] 實作黑底白字基本介面
- [ ] Loading 畫面 + 資料來源顯示
- [ ] 角色展示頁
- [ ] 節點選擇頁
- [ ] D3.js 分支樹（基本版：只顯示走過的節點）

### Phase 3：精緻化（第 5-6 週）

- [ ] 分支樹進階：LIFE OVER 後顯示未走的虛線路徑
- [ ] `RELIVE` 計數器機制
- [ ] 隨機台灣社會事件插入
- [ ] 縣市差異系統
- [ ] 展覽 kiosk 模式（全螢幕、觸控）

### Phase 4：測試與部署（第 7-8 週）

- [ ] 多人測試，收集故事品質回饋
- [ ] Prompt 微調
- [ ] 錯誤處理（API 失敗 fallback、LLM JSON 解析失敗重試）
- [ ] 部署（Vercel 前端 + Render/Railway 後端）

---

## 七、延伸功能（後續考量）

### 自己模式（參考原作）

讓玩家輸入自己的真實背景資料，模擬自己的人生走向。
需注意個資敏感性——建議不保存任何輸入資料。

### 學術研究整合

你的研究背景（ML + 財務分析）可以讓這個遊戲多一層意義：
收集玩家的**匿名選擇數據**，分析台灣不同世代/縣市背景的人，面對相同節點時的決策差異。這是原作沒有的附加研究價值。

### 多語言

中文主版本 + 英文版（海外台灣人或外籍玩家），觸角更廣。

---

## 八、核心程式碼索引

| 模組 | 功能 |
|------|------|
| `TaiwanStatsFetcher` | 抓取並快取台灣統計數據 |
| `LLMClient` | Gemini/Claude 統一介面 |
| `prompt_character()` | 角色生成 Prompt |
| `prompt_next_node()` | 動態節點生成 Prompt |
| `prompt_ending()` | 退休結局 Prompt |
| `TaiwanLifeGame` | 遊戲主引擎 |
| `updateTree()` (JS) | D3.js 分支樹渲染 |

