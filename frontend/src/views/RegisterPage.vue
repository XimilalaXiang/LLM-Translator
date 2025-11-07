<template>
  <div class="max-w-md mx-auto space-y-6">
    <h2 class="text-2xl font-bold">注册</h2>
    <form @submit.prevent="doRegister" class="space-y-4">
      <input v-model="username" placeholder="用户名（≥3位）" class="input w-full" />
      <input v-model="password" placeholder="密码（≥6位）" type="password" class="input w-full" />
      <button class="btn w-full">注册并登录</button>
      <p v-if="store.error" class="text-red-600 text-sm">{{ store.error }}</p>
    </form>
    <p class="text-sm text-gray-600 dark:text-gray-400">已有账号？<router-link class="underline" to="/login">去登录</router-link></p>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/authStore';

const router = useRouter();
const store = useAuthStore();
const username = ref('');
const password = ref('');

async function doRegister() {
  if (username.value.trim().length < 3 || password.value.length < 6) return;
  const ok = await store.register(username.value.trim(), password.value);
  if (ok) router.push('/');
}
</script>

<style scoped>
.input { @apply px-3 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-md bg-transparent outline-none focus:border-black dark:focus:border-white; }
.btn { @apply px-3 py-2 border-2 border-black dark:border-white rounded-md hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-colors; }
</style>


