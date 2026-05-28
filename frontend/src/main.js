import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { persistPlugin } from './stores/persist.js'
import './styles/global.css'

const pinia = createPinia()
pinia.use(persistPlugin)

const app = createApp(App)
app.use(pinia)
app.mount('#app')
