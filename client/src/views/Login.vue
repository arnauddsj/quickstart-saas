<script setup lang="ts">
import { ref } from 'vue';
import { trpc } from '../api/trpcClient';

const email = ref('');
const loading = ref(false);
const message = ref('');
const error = ref('');

async function sendMagicLink() {
  if (!email.value) {
    error.value = 'Please enter your email address';
    return;
  }
  
  loading.value = true;
  error.value = '';
  message.value = '';
  
  try {
    await trpc.auth.sendMagicLink.mutate({ email: email.value });
    message.value = 'Check your email for a login link!';
    email.value = '';
  } catch (err: any) {
    error.value = err?.message || 'Failed to send login link. Please try again.';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-gray-50">
    <div class="w-full max-w-md">
      <div class="rounded-lg bg-white px-8 pb-8 pt-6 shadow-md">
        <div class="mb-6 text-center">
          <h1 class="text-3xl font-bold">Welcome</h1>
          <p class="mt-2 text-gray-600">Login or sign up with your email</p>
        </div>
        
        <form @submit.prevent="sendMagicLink" class="space-y-6">
          <div>
            <label class="block text-sm font-medium text-gray-700" for="email">
              Email Address
            </label>
            <input
              v-model="email"
              id="email"
              type="email"
              required
              class="form-input mt-1"
              placeholder="you@example.com"
            />
          </div>
          
          <div v-if="message" class="rounded-md bg-green-50 p-4">
            <div class="flex">
              <div class="flex-shrink-0">
                <!-- Success icon -->
                <svg class="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                </svg>
              </div>
              <div class="ml-3">
                <p class="text-sm font-medium text-green-800">{{ message }}</p>
              </div>
            </div>
          </div>
          
          <div v-if="error" class="rounded-md bg-red-50 p-4">
            <div class="flex">
              <div class="flex-shrink-0">
                <!-- Error icon -->
                <svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
                </svg>
              </div>
              <div class="ml-3">
                <p class="text-sm font-medium text-red-800">{{ error }}</p>
              </div>
            </div>
          </div>
          
          <button
            type="submit"
            class="btn btn-primary w-full"
            :disabled="loading"
          >
            <span v-if="loading">Sending...</span>
            <span v-else>Send Login Link</span>
          </button>
        </form>
      </div>
    </div>
  </div>
</template> 