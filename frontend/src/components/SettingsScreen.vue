<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { useSettingsStore } from '../stores/settings.js'
import { useGameStore } from '../stores/game.js'

const props = defineProps({
  guide: { type: Boolean, default: false }
})

const settings = useSettingsStore()
const game = useGameStore()
const emit = defineEmits(['close'])

const localKey = ref(settings.apiKey)
const showKey  = ref(false)
const keyInput = ref(null)
const guideStep = ref(0)   // 0 = banner, 1 = tutorial open, 2 = filled
const showTutorial = ref(props.guide)
const justSaved = ref(false)

const aiStudioUrl = 'https://aistudio.google.com/app/apikey'

const placeholder = computed(() =>
  settings.provider === 'gemini' ? 'AIza...' : 'sk-ant-...'
)
const tutorialFor = computed(() => settings.provider)

watch(localKey, (v) => {
  if (props.guide && v.trim().length > 8) guideStep.value = 2
})

onMounted(() => {
  if (props.guide) {
    keyInput.value?.focus()
    guideStep.value = 1
  }
})

const save = () => {
  settings.apiKey = localKey.value.trim()
  if (props.guide && settings.isConfigured) {
    justSaved.value = true
    setTimeout(() => {
      emit('close')
      game.startNewGame()
    }, 700)
    return
  }
  emit('close')
}

const clearAll = () => {
  if (!confirm('清除所有資料（角色、進度、設定、API Key）？')) return
  game.quit()
  settings.reset()
  localStorage.clear()
  localKey.value = ''
  alert('已清除。')
}

const clearSave = () => {
  if (!confirm('清除目前進度（保留 API Key）？')) return
  game.quit()
}

const openProviderConsole = () => {
  const url = settings.provider === 'gemini'
    ? aiStudioUrl
    : 'https://console.anthropic.com/settings/keys'
  window.open(url, '_blank', 'noopener')
}
</script>

<template>
  <main class="screen settings" :class="{ 'guide-mode': guide }">
    <!-- Guide banner — only visible when player hit START without a key. -->
    <transition name="banner">
      <div v-if="guide" class="guide-banner">
        <div class="banner-pulse" aria-hidden="true">
          <span></span><span></span><span></span>
        </div>
        <div class="banner-text">
          <h2>需要一支 API KEY 才能開始</h2>
          <p>免費，三分鐘內搞定 ── 跟著下面的步驟走</p>
        </div>
      </div>
    </transition>

    <h2 v-if="!guide" class="title">設定 / Settings</h2>

    <section class="config" :class="{ highlight: guide && guideStep < 2 }">
      <label class="row">
        <span class="label">LLM Provider</span>
        <select v-model="settings.provider">
          <option value="gemini">Google Gemini（推薦・免費）</option>
          <option value="claude">Anthropic Claude（付費）</option>
        </select>
      </label>

      <label class="row api-row">
        <span class="label">API Key</span>
        <div class="key-input">
          <input
            ref="keyInput"
            v-model="localKey"
            :type="showKey ? 'text' : 'password'"
            :placeholder="placeholder"
            spellcheck="false"
            autocomplete="off"
          />
          <button type="button" class="ghost" @click="showKey = !showKey">
            {{ showKey ? 'hide' : 'show' }}
          </button>
        </div>
        <!-- Animated arrow pointer that disappears once user has typed. -->
        <div v-if="guide && guideStep < 2" class="arrow-pointer" aria-hidden="true">
          <span class="arrow-tip">▶</span>
          <span class="arrow-text">貼這邊</span>
        </div>
      </label>

      <label class="row">
        <span class="label">Model</span>
        <input v-if="settings.provider === 'gemini'" v-model="settings.geminiModel" />
        <input v-else v-model="settings.claudeModel" />
      </label>

      <details v-if="!guide" class="advanced">
        <summary>進階</summary>
        <label class="row">
          <span class="label">Stats API base URL</span>
          <input v-model="settings.statsBaseUrl" placeholder="/api or empty" />
        </label>
        <p class="hint dim">留空 = 用內建離線快照。/api = 走 Worker。</p>

        <label class="row checkbox">
          <input type="checkbox" v-model="settings.kioskMode" />
          <span>Kiosk 模式（隱藏設定連結）</span>
        </label>
      </details>
    </section>

    <!-- Tutorial — Gemini route uses AI Studio; collapsible if not in guide. -->
    <section
      v-if="tutorialFor === 'gemini'"
      class="tutorial"
      :class="{ 'tutorial-open': showTutorial }"
    >
      <div class="tutorial-head" @click="showTutorial = !showTutorial">
        <span class="tag">教學</span>
        <span>怎麼拿到 Gemini API KEY（免費）</span>
        <span class="caret">{{ showTutorial ? '▾' : '▸' }}</span>
      </div>
      <ol v-if="showTutorial" class="steps">
        <li>
          <span class="step-num">1</span>
          <div class="step-body">
            <p>打開 <strong>Google AI Studio</strong>（用任何 Google 帳號登入即可）。</p>
            <button class="open-link" @click="openProviderConsole">
              &gt; 開啟 aistudio.google.com/app/apikey ↗
            </button>
          </div>
        </li>
        <li>
          <span class="step-num">2</span>
          <div class="step-body">
            <p>點 <strong>「Create API key」</strong> 或 <strong>「建立 API 金鑰」</strong>。</p>
            <p class="dim">第一次使用會問你要不要建立新專案，按確定即可。</p>
          </div>
        </li>
        <li>
          <span class="step-num">3</span>
          <div class="step-body">
            <p>複製產生的金鑰（以 <code>AIza...</code> 開頭）。</p>
            <p class="dim">這支 key 只會存在你的瀏覽器，不會傳到任何伺服器。</p>
          </div>
        </li>
        <li>
          <span class="step-num">4</span>
          <div class="step-body">
            <p>貼回上面 <strong>API Key</strong> 欄位，按 SAVE 開始遊戲。</p>
          </div>
        </li>
      </ol>
    </section>

    <section v-else class="tutorial tutorial-open">
      <div class="tutorial-head static">
        <span class="tag">教學</span>
        <span>Anthropic Claude API KEY</span>
      </div>
      <ol class="steps">
        <li>
          <span class="step-num">1</span>
          <div class="step-body">
            <p>到 <strong>Anthropic Console</strong> 註冊 / 登入。</p>
            <button class="open-link" @click="openProviderConsole">
              &gt; 開啟 console.anthropic.com ↗
            </button>
          </div>
        </li>
        <li>
          <span class="step-num">2</span>
          <div class="step-body">
            <p>API Keys → <strong>Create Key</strong>，複製 <code>sk-ant-...</code>。</p>
            <p class="dim">需要先儲值（最低 $5）才能呼叫 API。</p>
          </div>
        </li>
        <li>
          <span class="step-num">3</span>
          <div class="step-body">
            <p>貼回上面欄位，按 SAVE。</p>
          </div>
        </li>
      </ol>
    </section>

    <hr v-if="!guide" class="divider" />

    <section v-if="!guide">
      <h3>資料管理</h3>
      <div class="danger-row">
        <button @click="clearSave">清除目前進度</button>
        <button @click="clearAll" class="danger">清除全部（含 API Key）</button>
      </div>
      <p class="hint dim">所有資料都存在你的瀏覽器 localStorage，不會傳到任何伺服器。</p>
    </section>

    <hr v-if="!guide" class="divider" />

    <section v-if="!guide" class="caveat">
      <h3>⚠ 安全提醒</h3>
      <p class="hint">
        這個版本把 LLM 呼叫直接從前端發出，API Key 會在使用者瀏覽器中暴露。
        適合單機 / 展覽 kiosk / 個人測試。
      </p>
    </section>

    <div class="actions" :class="{ pulsing: guide && guideStep === 2 && !justSaved }">
      <button @click="save" class="save" :disabled="guide && !localKey.trim()">
        {{ justSaved ? '✓ 開始' : (guide ? '> SAVE & START' : 'SAVE') }}
      </button>
      <button v-if="!guide" @click="emit('close')">CANCEL</button>
    </div>
  </main>
</template>

<style scoped>
.settings {
  gap: 1.2rem;
  padding-top: 4rem;
  max-width: 720px;
  position: relative;
}
.title {
  letter-spacing: 0.2em;
  margin: 0 0 1rem;
  font-size: 1.4rem;
}

/* ---------- Guide banner ---------- */
.guide-banner {
  position: relative;
  border: 1px solid var(--fg);
  padding: 1.4rem 1.5rem 1.4rem 4.2rem;
  margin-bottom: 1rem;
  overflow: hidden;
  background: var(--bg);
}
.guide-banner::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(110deg,
    transparent 0%,
    transparent 40%,
    rgba(255,255,255,0.06) 50%,
    transparent 60%,
    transparent 100%);
  background-size: 300% 100%;
  animation: sweep 3.2s linear infinite;
  pointer-events: none;
}
@keyframes sweep {
  0%   { background-position: 200% 0; }
  100% { background-position: -100% 0; }
}
.banner-pulse {
  position: absolute;
  left: 1.4rem;
  top: 50%;
  transform: translateY(-50%);
  width: 1.6rem;
  height: 1.6rem;
}
.banner-pulse span {
  position: absolute;
  inset: 0;
  border: 1px solid var(--fg);
  border-radius: 50%;
  animation: pulse 1.6s ease-out infinite;
}
.banner-pulse span:nth-child(2) { animation-delay: 0.55s; }
.banner-pulse span:nth-child(3) { animation-delay: 1.1s; }
@keyframes pulse {
  0%   { transform: scale(0.4); opacity: 1; }
  100% { transform: scale(1.6); opacity: 0; }
}
.banner-text h2 {
  margin: 0 0 0.3rem;
  font-size: 1.15rem;
  letter-spacing: 0.1em;
}
.banner-text p {
  margin: 0;
  color: var(--dim);
  font-size: 0.9rem;
}

/* Banner enter animation */
.banner-enter-from { opacity: 0; transform: translateY(-8px); }
.banner-enter-active { transition: all 0.4s ease-out; }

/* ---------- Form rows ---------- */
.config {
  border: 1px solid transparent;
  padding: 0.6rem 0.9rem;
  transition: border-color 0.4s, box-shadow 0.4s;
}
.config.highlight {
  border-color: var(--fg);
  box-shadow:
    0 0 0 1px var(--fg) inset,
    0 0 28px rgba(255,255,255,0.08);
  animation: glow 2s ease-in-out infinite;
}
@keyframes glow {
  0%, 100% { box-shadow: 0 0 0 1px var(--fg) inset, 0 0 18px rgba(255,255,255,0.06); }
  50%      { box-shadow: 0 0 0 1px var(--fg) inset, 0 0 36px rgba(255,255,255,0.14); }
}

.row {
  display: flex;
  gap: 1rem;
  align-items: center;
  margin: 0.8rem 0;
  flex-wrap: wrap;
  position: relative;
}
.row.checkbox { gap: 0.6rem; }
.label {
  flex: 0 0 130px;
  color: var(--dim);
  font-size: 0.9rem;
  letter-spacing: 0.05em;
}
.row input, .row select {
  flex: 1;
  min-width: 200px;
}
.api-row { position: relative; }

.key-input {
  flex: 1;
  display: flex;
  gap: 0.5rem;
}
.key-input input { flex: 1; }
.key-input .ghost {
  border-color: var(--dim);
  color: var(--dim);
  padding: 0.4em 0.8em;
}

/* ---------- Arrow pointer (guide mode) ---------- */
.arrow-pointer {
  position: absolute;
  right: -2.6rem;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  pointer-events: none;
  animation: nudge 1.1s ease-in-out infinite;
}
.arrow-tip {
  font-size: 1.3rem;
  color: var(--fg);
  transform: scaleX(-1);
}
.arrow-text {
  font-size: 0.7rem;
  color: var(--fg);
  letter-spacing: 0.1em;
  margin-top: 2px;
}
@keyframes nudge {
  0%, 100% { transform: translate(0, -50%); opacity: 1; }
  50%      { transform: translate(-6px, -50%); opacity: 0.6; }
}

/* ---------- Tutorial ---------- */
.tutorial {
  border: 1px solid var(--line);
  padding: 0.8rem 1rem;
}
.tutorial-head {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  cursor: pointer;
  font-size: 0.95rem;
  letter-spacing: 0.05em;
  user-select: none;
}
.tutorial-head.static { cursor: default; }
.tutorial-head .tag {
  font-size: 0.7rem;
  letter-spacing: 0.2em;
  border: 1px solid var(--fg);
  padding: 2px 6px;
}
.tutorial-head .caret {
  margin-left: auto;
  color: var(--dim);
  font-size: 0.85rem;
}
.tutorial-open { padding-bottom: 1.2rem; }

.steps {
  list-style: none;
  padding: 0;
  margin: 1rem 0 0;
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}
.steps li {
  display: flex;
  gap: 0.9rem;
  align-items: flex-start;
}
.step-num {
  flex: 0 0 1.6rem;
  width: 1.6rem;
  height: 1.6rem;
  border: 1px solid var(--fg);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.85rem;
  font-family: var(--font-mono);
}
.step-body {
  flex: 1;
  font-size: 0.92rem;
  line-height: 1.7;
}
.step-body p { margin: 0; }
.step-body p + p { margin-top: 0.3rem; }
.step-body code {
  font-family: var(--font-mono);
  background: var(--line);
  padding: 1px 5px;
}
.open-link {
  margin-top: 0.4rem;
  letter-spacing: 0.05em;
  font-size: 0.85rem;
  padding: 0.4em 0.8em;
}

/* ---------- Misc ---------- */
.advanced { margin: 0.8rem 0; }
.advanced summary {
  color: var(--dim);
  cursor: pointer;
  font-size: 0.85rem;
  letter-spacing: 0.1em;
  padding: 0.4rem 0;
}
.hint {
  font-size: 0.82rem;
  margin: 0.2rem 0 0;
  line-height: 1.6;
}
h3 { letter-spacing: 0.1em; margin: 0 0 0.6rem; font-size: 1rem; }
.danger-row { display: flex; gap: 1rem; flex-wrap: wrap; }
.danger { border-color: #ff7777; color: #ff7777; }
.danger:hover { background: #ff7777; color: var(--bg); }
.caveat { color: var(--dim); }

.actions {
  display: flex;
  gap: 1rem;
  margin-top: 1rem;
  position: relative;
}
.actions button {
  letter-spacing: 0.2em;
  padding: 0.7em 1.6em;
}
.actions button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.actions.pulsing .save {
  animation: ready 1.4s ease-in-out infinite;
}
@keyframes ready {
  0%, 100% { box-shadow: 0 0 0 0 rgba(255,255,255,0.4); }
  50%      { box-shadow: 0 0 0 8px rgba(255,255,255,0); }
}

@media (max-width: 600px) {
  .label { flex: 1 0 100%; }
  .arrow-pointer { display: none; }
}
</style>
