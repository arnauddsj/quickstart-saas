<script setup lang="ts">
import { onMounted, computed } from "vue";
import { storeToRefs } from "pinia";
import { useUserStore } from "@/stores/user";

const userStore = useUserStore();
const { user } = storeToRefs(userStore);

const isLoggedIn = computed(() => user.value.isLoggedIn);

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
    <template v-if="isLoggedIn">
      <h1>Welcome, {{ user.name || user.email }}!</h1>
      <p>Email: {{ user.email }}</p>
      <p>This is the members-only area.</p>
    </template>
    <template v-else>
      <h1>Welcome to Our App</h1>
      <p>Please log in to see your personalized content.</p>
    </template>
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
