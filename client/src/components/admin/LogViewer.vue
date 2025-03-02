<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { trpc } from '../../api/trpcClient';

interface LogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  context?: string;
  userId?: string;
}

const logs = ref<LogEntry[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const logLevelFilter = ref<string>('all');
const searchQuery = ref<string>('');
const page = ref(1);
const pageSize = ref(20);
const totalLogs = ref(0);

// Load logs on component mount
onMounted(fetchLogs);

// Fetch logs from the server
async function fetchLogs() {
  loading.value = true;
  error.value = null;
  
  try {
    // Call the server to get logs
    const response = await trpc.admin.getLogs.query({
      page: page.value,
      pageSize: pageSize.value,
      level: logLevelFilter.value === 'all' ? undefined : logLevelFilter.value,
      search: searchQuery.value || undefined
    });
    
    logs.value = response.logs;
    totalLogs.value = response.total;
  } catch (err: any) {
    error.value = err.message || 'Failed to fetch logs';
    console.error('Error fetching logs:', err);
  } finally {
    loading.value = false;
  }
}

// Apply filters and refresh logs
function applyFilters() {
  page.value = 1; // Reset to page 1 when changing filters
  fetchLogs();
}

// Clear all filters
function clearFilters() {
  logLevelFilter.value = 'all';
  searchQuery.value = '';
  page.value = 1;
  fetchLogs();
}

// Navigate to next page
function nextPage() {
  if (page.value * pageSize.value < totalLogs.value) {
    page.value++;
    fetchLogs();
  }
}

// Navigate to previous page
function prevPage() {
  if (page.value > 1) {
    page.value--;
    fetchLogs();
  }
}

// Get log level badge class
function getLogLevelClass(level: string): string {
  switch (level) {
    case 'error':
      return 'bg-red-100 text-red-800';
    case 'warn':
      return 'bg-yellow-100 text-yellow-800';
    case 'info':
      return 'bg-blue-100 text-blue-800';
    case 'debug':
      return 'bg-gray-100 text-gray-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

// Format timestamp 
function formatTimestamp(timestamp: string): string {
  return new Date(timestamp).toLocaleString();
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex justify-between items-center">
      <h2 class="text-2xl font-semibold text-gray-900">System Logs</h2>
      <button 
        @click="fetchLogs" 
        class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
        :disabled="loading"
      >
        Refresh Logs
      </button>
    </div>
    
    <!-- Filters -->
    <div class="bg-white shadow rounded-md p-6">
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label for="level-filter" class="block text-sm font-medium text-gray-700">Log Level</label>
          <select
            id="level-filter"
            v-model="logLevelFilter"
            class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
          >
            <option value="all">All Levels</option>
            <option value="debug">Debug</option>
            <option value="info">Info</option>
            <option value="warn">Warning</option>
            <option value="error">Error</option>
          </select>
        </div>
        
        <div class="md:col-span-2">
          <label for="search" class="block text-sm font-medium text-gray-700">Search</label>
          <input
            id="search"
            v-model="searchQuery"
            type="text"
            placeholder="Search in logs..."
            class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
          />
        </div>
        
        <div class="flex items-end space-x-2">
          <button
            @click="applyFilters"
            class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
            :disabled="loading"
          >
            Apply Filters
          </button>
          <button
            @click="clearFilters"
            class="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 text-sm"
            :disabled="loading"
          >
            Clear
          </button>
        </div>
      </div>
    </div>
    
    <!-- Error message -->
    <div v-if="error" class="rounded-md bg-red-50 p-4">
      <div class="flex">
        <div class="flex-shrink-0">
          <svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
          </svg>
        </div>
        <div class="ml-3">
          <p class="text-sm font-medium text-red-800">{{ error }}</p>
        </div>
      </div>
    </div>
    
    <!-- Loading state -->
    <div v-if="loading" class="flex justify-center items-center py-8">
      <div class="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
      <span class="ml-3 text-gray-600">Loading logs...</span>
    </div>
    
    <!-- Logs Table -->
    <div v-if="logs.length > 0 && !loading" class="bg-white shadow rounded-md overflow-hidden">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Timestamp
            </th>
            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Level
            </th>
            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Message
            </th>
            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Context
            </th>
          </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-200">
          <tr v-for="log in logs" :key="log.id" class="hover:bg-gray-50">
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
              {{ formatTimestamp(log.timestamp) }}
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
              <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full" :class="getLogLevelClass(log.level)">
                {{ log.level }}
              </span>
            </td>
            <td class="px-6 py-4 text-sm text-gray-500">
              <div class="max-w-lg break-words">{{ log.message }}</div>
            </td>
            <td class="px-6 py-4 text-sm text-gray-500">
              <div v-if="log.context" class="max-w-xs break-words">
                {{ log.context }}
              </div>
              <div v-if="log.userId" class="text-xs text-gray-400 mt-1">
                User: {{ log.userId }}
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      
      <!-- Pagination -->
      <div class="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
        <div class="flex-1 flex justify-between sm:hidden">
          <button
            @click="prevPage"
            :disabled="page === 1"
            class="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            :class="{ 'opacity-50 cursor-not-allowed': page === 1 }"
          >
            Previous
          </button>
          <button
            @click="nextPage"
            :disabled="page * pageSize >= totalLogs"
            class="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            :class="{ 'opacity-50 cursor-not-allowed': page * pageSize >= totalLogs }"
          >
            Next
          </button>
        </div>
        <div class="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
          <div>
            <p class="text-sm text-gray-700">
              Showing <span class="font-medium">{{ (page - 1) * pageSize + 1 }}</span> to 
              <span class="font-medium">{{ Math.min(page * pageSize, totalLogs) }}</span> of 
              <span class="font-medium">{{ totalLogs }}</span> results
            </p>
          </div>
          <div>
            <nav class="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
              <button
                @click="prevPage"
                :disabled="page === 1"
                class="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
                :class="{ 'opacity-50 cursor-not-allowed': page === 1 }"
              >
                <span class="sr-only">Previous</span>
                <svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fill-rule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clip-rule="evenodd" />
                </svg>
              </button>
              <span class="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">
                {{ page }}
              </span>
              <button
                @click="nextPage"
                :disabled="page * pageSize >= totalLogs"
                class="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
                :class="{ 'opacity-50 cursor-not-allowed': page * pageSize >= totalLogs }"
              >
                <span class="sr-only">Next</span>
                <svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd" />
                </svg>
              </button>
            </nav>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Empty state -->
    <div v-if="logs.length === 0 && !loading" class="bg-white shadow rounded-md p-8 text-center">
      <p class="text-gray-500">No logs found matching your criteria.</p>
    </div>
  </div>
</template> 