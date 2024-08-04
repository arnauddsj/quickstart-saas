import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { VueQueryPlugin as vueQuery } from '@tanstack/vue-query'
import router from './router'
import App from '@/App.vue'

const app = createApp(App)
app.use(vueQuery, {
  queryClientConfig: {
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
      },
    },
  },
})
app.use(router)
app.use(createPinia())
app.mount('#app')