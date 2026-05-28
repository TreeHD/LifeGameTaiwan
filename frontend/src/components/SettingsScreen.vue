<script setup>
import { ref } from 'vue'
import { useSettingsStore } from '../stores/settings.js'
import { useGameStore } from '../stores/game.js'

const settings = useSettingsStore()
const game = useGameStore()
const emit = defineEmits(['close'])

const localKey = ref(settings.apiKey)
const showKey  = ref(false)

const save = () => {
  settings.apiKey = localKey.value.trim()
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
</script>

<template>
  <main class="screen settings">
    <h2 class="title">設定 / Settings</h2>

    <section>
      <label class="row">
        <span class="label">LLM Provider</span>
        <select v-model="settings.provider">
          <option value="gemini">Google Gemini</option>
          <option value="claude">Anthropic Claude</option>
        </select>
      </label>

      <label class="row">
        <span class="label">API Key</span>
        <div class="key-input">
          <input
            v-model="localKey"
            :type="showKey ? 'text' : 'password'"
            :placeholder="settings.provider === 'gemini' ? 'AIza...' : 'sk-ant-...'"
            spellcheck="false"
            autocomplete="off"
          />
          <button type="button" class="ghost" @click="showKey = !showKey">
            {{ showKey ? 'hide' : 'show' }}
          </button>
        </div>
      </label>

      <label class="row">
        <span class="label">Model</span>
        <input v-if="settings.provider === 'gemini'" v-model="settings.geminiModel" />
        <input v-else v-model="settings.claudeModel" />
      </label>

      <label class="row">
        <span class="label">Stats API base URL</span>
        <input v-model="settings.statsBaseUrl" placeholder="/api or https://your.workers.dev/api or empty" />
      </label>
      <p class="hint dim">留空 = 使用內建離線快照（不打後端）。/api = 走 vite 代理到本機 :8000。</p>

      <label class="row checkbox">
        <input type="checkbox" v-model="settings.kioskMode" />
        <span>Kiosk 模式（隱藏設定連結，適合展覽）</span>
      </label>
    </section>

    <hr class="divider" />

    <section>
      <h3>資料管理</h3>
      <div class="danger-row">
        <button @click="clearSave">清除目前進度</button>
        <button @click="clearAll" class="danger">清除全部（含 API Key）</button>
      </div>
      <p class="hint dim">所有資料都存在你的瀏覽器 localStorage，不會傳到任何伺服器。</p>
    </section>

    <hr class="divider" />

    <section class="caveat">
      <h3>⚠ 安全提醒</h3>
      <p class="hint">
        這個版本把 LLM 呼叫直接從前端發出，API Key 會在使用者瀏覽器中暴露。
        適合單機 / 展覽 kiosk / 個人測試。<br>
        若要正式公開部署，請把 LLM 呼叫移到後端。
      </p>
    </section>

    <div class="actions">
      <button @click="save">SAVE</button>
      <button @click="emit('close')">CANCEL</button>
    </div>
  </main>
</template>

<style scoped>
.settings { gap: 1.2rem; padding-top: 4rem; max-width: 720px; }
.title {
  letter-spacing: 0.2em;
  margin: 0 0 1rem;
  font-size: 1.4rem;
}

.row {
  display: flex;
  gap: 1rem;
  align-items: center;
  margin: 0.8rem 0;
  flex-wrap: wrap;
}
.row.checkbox { gap: 0.6rem; }
.label {
  flex: 0 0 160px;
  color: var(--dim);
  font-size: 0.9rem;
  letter-spacing: 0.05em;
}
.row input, .row select {
  flex: 1;
  min-width: 200px;
}

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

.hint {
  font-size: 0.82rem;
  margin: 0.2rem 0 0 calc(160px + 1rem);
  line-height: 1.6;
}

h3 { letter-spacing: 0.1em; margin: 0 0 0.6rem; font-size: 1rem; }

.danger-row { display: flex; gap: 1rem; flex-wrap: wrap; }
.danger { border-color: #ff7777; color: #ff7777; }
.danger:hover { background: #ff7777; color: var(--bg); }

.caveat { color: var(--dim); }
.caveat .hint { margin-left: 0; }

.actions {
  display: flex;
  gap: 1rem;
  margin-top: 1rem;
}
.actions button {
  letter-spacing: 0.2em;
  padding: 0.7em 1.6em;
}

@media (max-width: 600px) {
  .label { flex: 1 0 100%; }
  .hint { margin-left: 0; }
}
</style>
