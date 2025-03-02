<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useUserStore } from '../stores/userStore';

// Components
import UserManagement from '../components/admin/UserManagement.vue';
import LogViewer from '../components/admin/LogViewer.vue';

const router = useRouter();
const userStore = useUserStore();
const activeTab = ref('users'); // Default active tab

onMounted(async () => {
  // Check if user is admin
  await userStore.fetchUser();
  
  if (!userStore.user || userStore.user.role !== 'admin') {
    // If not admin, redirect to dashboard
    router.push('/');
  }
});

function changeTab(tab: string) {
  activeTab.value = tab;
}
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Header -->
    <header class="bg-white shadow">
      <div class="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 flex justify-between items-center">
        <h1 class="text-3xl font-bold tracking-tight text-gray-900">Admin Panel</h1>
        <div class="flex items-center gap-4">
          <span class="text-sm text-gray-700">{{ userStore.userName }}</span>
          <button 
            @click="router.push('/')" 
            class="btn btn-secondary text-sm"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    </header>
    
    <!-- Main content -->
    <main class="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <!-- Loading state -->
      <div v-if="userStore.loading" class="py-4 text-center">
        <div class="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
        <p class="text-gray-600">Loading admin panel...</p>
      </div>
      
      <!-- Error state -->
      <div v-else-if="userStore.error" class="rounded-md bg-red-50 p-4">
        <div class="flex">
          <div class="flex-shrink-0">
            <svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
            </svg>
          </div>
          <div class="ml-3">
            <p class="text-sm font-medium text-red-800">{{ userStore.error }}</p>
          </div>
        </div>
      </div>
      
      <!-- Admin Content -->
      <div v-else class="space-y-6">
        <!-- Tabs -->
        <div class="border-b border-gray-200">
          <nav class="-mb-px flex space-x-8" aria-label="Tabs">
            <button 
              @click="changeTab('users')" 
              :class="[
                activeTab === 'users' 
                  ? 'border-blue-500 text-blue-600' 
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
                'whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm'
              ]"
            >
              User Management
            </button>
            <button 
              @click="changeTab('logs')" 
              :class="[
                activeTab === 'logs' 
                  ? 'border-blue-500 text-blue-600' 
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
                'whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm'
              ]"
            >
              System Logs
            </button>
          </nav>
        </div>
        
        <!-- Tab content -->
        <div v-if="activeTab === 'users'">
          <UserManagement />
        </div>
        <div v-else-if="activeTab === 'logs'">
          <LogViewer />
        </div>
      </div>
    </main>
  </div>
</template> 