<script setup lang="ts">
// Add any auth-specific imports here if needed
</script>

<template>
  <div class="auth-layout">
    <main class="auth-content">
      <slot></slot>
    </main>
  </div>
</template>

<style scoped lang="scss">
.auth-layout {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
}

.auth-content {
  width: 100%;
  max-width: 400px;
  padding: 2rem;
}
</style>
