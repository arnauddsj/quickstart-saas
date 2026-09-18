import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { VueQueryPlugin } from '@tanstack/vue-query'
import App from './App.vue'
import { router } from './router'
import { queryClient } from './services/server'
import { setupConsent } from './lib/consent'
import 'vue-sonner/style.css'
import './styles.css'

createApp(App).use(createPinia()).use(VueQueryPlugin, { queryClient }).use(router).mount('#app')
router.isReady().then(() => setupConsent())
