<script setup lang="ts">
import { RouterView } from "vue-router";
import { onMounted } from "vue";
import { useUserStore } from "@/stores/user";

const userStore = useUserStore();

onMounted(async () => {
  const token = localStorage.getItem("authToken");
  if (token) {
    try {
      const user = await userStore.fetchUser();
      if (user) {
        userStore.setUser(user.email);
      } else {
        await userStore.logout();
        localStorage.removeItem("authToken");
      }
    } catch (error) {
      console.error("Failed to authenticate user:", error);
      await userStore.logout();
      localStorage.removeItem("authToken");
    }
  }
});
</script>

<template>
  <RouterView />
</template>

<style lang="scss">
@import "@/style.scss";

#app {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  max-width: 1280px;
  margin: 0 auto;
  padding: 2rem;
  text-align: center;
}
</style>
