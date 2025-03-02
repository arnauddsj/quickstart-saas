<script setup lang="ts">
import { useRouter } from 'vue-router';

const router = useRouter();

function goBack() {
  router.back();
}

function goHome() {
  router.push('/');
}
</script>

<template>
  <div class="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 text-center">
    <h1 class="mb-2 text-9xl font-bold text-blue-600">404</h1>
    <h2 class="mb-8 text-3xl font-bold text-gray-900">Page Not Found</h2>
    <p class="mb-8 text-gray-600">
      The page you are looking for doesn't exist or has been moved.
    </p>
    <div class="flex space-x-4">
      <button @click="goBack" class="btn btn-secondary">
        Go Back
      </button>
      <button @click="goHome" class="btn btn-primary">
        Go Home
      </button>
    </div>
  </div>
</template> 