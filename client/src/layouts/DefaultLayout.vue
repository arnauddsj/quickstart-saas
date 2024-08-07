<script setup lang="ts">
import TopBar from "@/components/TopBar.vue";
</script>

<template>
  <div class="default-layout">
    <TopBar />
    <slot></slot>
  </div>
</template>

<style scoped lang="scss">
.default-layout {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}
</style>
