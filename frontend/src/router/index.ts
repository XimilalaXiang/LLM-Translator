import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '@/stores/authStore';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('@/views/HomePage.vue')
    },
    {
      path: '/models',
      name: 'models',
      component: () => import('@/views/ModelsPage.vue')
    },
    {
      path: '/knowledge',
      name: 'knowledge',
      component: () => import('@/views/KnowledgePage.vue')
    },
    {
      path: '/history',
      name: 'history',
      component: () => import('@/views/HistoryPage.vue')
    },
    {
      path: '/admin',
      name: 'admin',
      component: () => import('@/views/AdminPage.vue')
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginPage.vue')
    },
    {
      path: '/register',
      name: 'register',
      component: () => import('@/views/RegisterPage.vue')
    }
  ]
});

let statusFetched = false;
router.beforeEach(async (to, _from, next) => {
  const store = useAuthStore();
  if (!statusFetched) {
    await store.fetchStatus();
    statusFetched = true;
  }
  // Admin gate when auth enabled
  if (to.path === '/admin' && store.authEnabled && (!store.user || store.user.role !== 'admin')) {
    return next('/login');
  }
  // App-wide gate when auth is enabled
  const publicPaths = ['/login', '/register'];
  if (store.authEnabled && !store.user && !publicPaths.includes(to.path)) {
    return next('/login');
  }
  return next();
});

export default router;
