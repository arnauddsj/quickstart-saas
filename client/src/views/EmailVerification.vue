<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { trpc } from '../api/trpcClient';

const route = useRoute();
const router = useRouter();
const loading = ref(true);
const error = ref('');

onMounted(async () => {
  // Get token from URL query parameter
  const token = route.query.token as string;
  
  if (!token) {
    error.value = 'Invalid or missing authentication token';
    loading.value = false;
    return;
  }
  
  try {
    // Verify the token with the server
    await trpc.auth.verifyToken.mutate({ token });
    
    // Token is valid, redirect to dashboard
    router.push('/');
  } catch (err: any) {
    error.value = err?.message || 'Authentication failed. Please try logging in again.';
    loading.value = false;
  }
});
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-gray-50">
    <div class="w-full max-w-md">
      <div class="rounded-lg bg-white px-8 pb-8 pt-6 shadow-md">
        <div class="mb-6 text-center">
          <h1 class="text-2xl font-bold">Verifying your login</h1>
        </div>
        
        <div v-if="loading" class="py-4 text-center">
          <div class="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
          <p class="text-gray-600">Please wait while we verify your email...</p>
        </div>
        
        <div v-else-if="error" class="rounded-md bg-red-50 p-4">
          <div class="flex">
            <div class="flex-shrink-0">
              <!-- Error icon -->
              <svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
              </svg>
            </div>
            <div class="ml-3">
              <p class="text-sm font-medium text-red-800">{{ error }}</p>
              <div class="mt-4">
                <router-link to="/login" class="btn btn-secondary text-sm">
                  Return to Login
                </router-link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template> 