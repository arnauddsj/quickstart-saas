<script setup lang="ts">
import { RouterView } from "vue-router";
import { onMounted } from "vue";
import { useUserStore } from "@/stores/user";

const userStore = useUserStore();

onMounted(async () => {
  const user = await userStore.fetchUser();
  if (!user) {
    console.log("User not authenticated");
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
