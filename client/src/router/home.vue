<script setup lang="ts">
import { onMounted } from "vue";
import { storeToRefs } from "pinia";
import { useUserStore } from "@/stores/user";

const userStore = useUserStore();
const { user } = storeToRefs(userStore);

onMounted(async () => {
  try {
    await userStore.fetchUser();
  } catch (error) {
    console.error("Error fetching user:", error);
  }
});
</script>

<template>
  <div>
    <h1>Welcome, {{ user.name }}!</h1>
    <p>Email: {{ user.email }}</p>
    <p>Logged in: {{ user.isLoggedIn ? "Yes" : "No" }}</p>
  </div>
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
