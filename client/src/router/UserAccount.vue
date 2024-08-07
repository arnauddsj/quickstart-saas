<script setup lang="ts">
import { storeToRefs } from "pinia";
import { useRouter } from "vue-router";
import { useUserStore } from "@/stores/user";
import DefaultLayout from "@/layouts/DefaultLayout.vue";

const userStore = useUserStore();
const { user } = storeToRefs(userStore);
const router = useRouter();

const handleLogout = async () => {
  try {
    await userStore.logout();
    router.push("/auth");
  } catch (error) {
    console.error("Logout error:", error);
  }
};
</script>

<template>
  <DefaultLayout>
    <div class="user-account">
      <h1>User Account</h1>
      <h2>Welcome, {{ user.email }}!</h2>
      <p>Email: {{ user.email }}</p>
      <p>This is the members-only area.</p>
      <button @click="handleLogout">Logout</button>
    </div>
  </DefaultLayout>
</template>

<style scoped lang="scss"></style>
