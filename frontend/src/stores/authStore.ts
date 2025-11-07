import { defineStore } from 'pinia';
import { ref } from 'vue';
import { authApi, adminApi } from '@/api';

export interface AuthUser { id: string; username: string; role: 'admin' | 'user'; }

export const useAuthStore = defineStore('auth', () => {
  const authEnabled = ref<boolean>(false);
  const user = ref<AuthUser | null>(null);
  const loading = ref<boolean>(false);
  const error = ref<string | null>(null);

  async function fetchStatus() {
    try {
      const res = await authApi.status();
      if (res?.success) {
        authEnabled.value = !!res.data?.authEnabled;
        user.value = (res.data as any)?.user || null;
      }
    } catch (e) {
      // ignore
    }
  }

  async function login(username: string, password: string) {
    loading.value = true; error.value = null;
    try {
      const res = await authApi.login(username, password);
      if (!res?.success) throw new Error(res?.error || '登录失败');
      await fetchStatus();
      return true;
    } catch (e: any) {
      error.value = e?.message || '登录失败';
      return false;
    } finally { loading.value = false; }
  }

  async function register(username: string, password: string) {
    loading.value = true; error.value = null;
    try {
      const res = await authApi.register(username, password);
      if (!res?.success) throw new Error(res?.error || '注册失败');
      await fetchStatus();
      return true;
    } catch (e: any) {
      error.value = e?.message || '注册失败';
      return false;
    } finally { loading.value = false; }
  }

  async function logout() {
    await authApi.logout();
    await fetchStatus();
  }

  async function toggleAuthEnabled(next: boolean) {
    const res = await adminApi.updateSettings(next);
    if (res?.success) authEnabled.value = next;
    return !!res?.success;
  }

  async function bootstrapAdmin(username: string, password: string) {
    const res = await adminApi.bootstrap(username, password);
    return !!res?.success;
  }

  return {
    authEnabled,
    user,
    loading,
    error,
    fetchStatus,
    login,
    register,
    logout,
    toggleAuthEnabled,
    bootstrapAdmin
  };
});


