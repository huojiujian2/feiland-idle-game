import { createApp } from 'vue'
import App from './App.vue'
import './style.css'
import './themes.css'
import { initTheme } from './theme'

initTheme()
createApp(App).mount('#app')
