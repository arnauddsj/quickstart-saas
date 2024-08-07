<script setup lang="ts">
defineProps<{ message: string }>();
</script>

<template>
  <div class="error-message">
    {{ message }}
  </div>
</template>

<style scoped>
.error-message {
  color: var(--danger-color);
  background-color: var(--danger-bg-color);
  padding: 0.5rem;
  border-radius: var(--border-radius);
  margin-top: 1rem;
}
</style>
