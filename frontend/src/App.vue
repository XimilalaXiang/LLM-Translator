<template>
  <div class="app min-h-screen bg-white dark:bg-black text-black dark:text-gray-100">
    <!-- Header Navigation -->
    <header class="border-b border-gray-300 dark:border-gray-700 hidden sm:block">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between items-center h-16">
          <div class="flex items-center space-x-8">
            <h1 class="text-xl font-bold text-black dark:text-white">法律翻译审核系统</h1>
            <nav class="flex space-x-4">
              <router-link
                to="/"
                class="nav-link"
                active-class="nav-link-active"
              >
                翻译
              </router-link>
              <router-link
                to="/models"
                class="nav-link"
                active-class="nav-link-active"
              >
                模型配置
              </router-link>
              <router-link
                to="/knowledge"
                class="nav-link"
                active-class="nav-link-active"
              >
                知识库
              </router-link>
              <router-link
                to="/history"
                class="nav-link"
                active-class="nav-link-active"
              >
                历史记录
              </router-link>
              <router-link
                v-if="route.path === '/admin'"
                to="/admin"
                class="nav-link"
                active-class="nav-link-active"
              >
                管理员
              </router-link>
            </nav>
          </div>
          <div class="flex items-center space-x-3">
            <template v-if="auth.authEnabled">
              <span v-if="auth.user" class="text-sm">{{ auth.user.username }}</span>
              <router-link v-else to="/login" class="px-3 py-1 text-sm border-2 border-gray-300 dark:border-gray-600 rounded-md hover:border-black dark:hover:border-white transition-colors">登录</router-link>
              <button v-if="auth.user" @click="logout" class="px-3 py-1 text-sm border-2 border-gray-300 dark:border-gray-600 rounded-md hover:border-black dark:hover:border-white transition-colors">退出</button>
            </template>
            <button @click="toggleTheme" class="px-3 py-1 text-sm border-2 border-gray-300 dark:border-gray-600 rounded-md hover:border-black dark:hover:border-white transition-colors">
              {{ isDark ? '切换到亮色' : '切换到暗色' }}
            </button>
          </div>
        </div>
      </div>
    </header>

    <!-- Main Content -->
    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-20 sm:pb-8">
      <router-view />
    </main>
    <MobileTabBar class="sm:hidden" />
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import MobileTabBar from '@/components/MobileTabBar.vue';
import { useModelStore } from '@/stores/modelStore';
import { useKnowledgeStore } from '@/stores/knowledgeStore';
import { useAuthStore } from '@/stores/authStore';

const modelStore = useModelStore();
const knowledgeStore = useKnowledgeStore();
const auth = useAuthStore();
const route = useRoute();

onMounted(async () => {
  // initialize theme
  const saved = localStorage.getItem('theme');
  const preferDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const enableDark = saved ? saved === 'dark' : preferDark;
  setDark(enableDark);
  // 先获取鉴权状态，再加载与用户相关的数据，避免首次登录后需要刷新
  await auth.fetchStatus();
  (window as any).__currentUserId = auth.user?.id;
  await Promise.all([
    modelStore.fetchModels(),
    knowledgeStore.fetchKnowledgeBases()
  ]);
});

// 监听登录/注销切换，自动刷新与用户相关的数据
watch(() => auth.user?.id, async () => {
  (window as any).__currentUserId = auth.user?.id;
  await Promise.all([
    modelStore.fetchModels(),
    knowledgeStore.fetchKnowledgeBases()
  ]);
});

const isDark = ref(false);
function setDark(v: boolean) {
  isDark.value = v;
  const root = document.documentElement;
  if (v) root.classList.add('dark'); else root.classList.remove('dark');
  localStorage.setItem('theme', v ? 'dark' : 'light');
}
function toggleTheme() {
  setDark(!isDark.value);
}

async function logout() {
  await auth.logout();
}
</script>

<style scoped>
.nav-link {
  @apply px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors;
}

.nav-link-active {
  @apply text-black bg-gray-100 dark:text-white dark:bg-gray-800;
}
</style>
