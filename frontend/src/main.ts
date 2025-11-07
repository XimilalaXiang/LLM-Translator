import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import App from './App.vue'
import './style.css'
import { useAuthStore } from './stores/authStore'

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.mount('#app')

// expose current user id for quick ownership checks in stores
try {
  const store = useAuthStore();
  store.fetchStatus().finally(() => {
    (window as any).__currentUserId = store.user?.id;
  });
} catch {}
