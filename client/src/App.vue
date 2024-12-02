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