<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { trpc } from '../../api/trpcClient';
import { useUserStore } from '../../stores/userStore';
import type { User } from '../../stores/userStore';

const userStore = useUserStore();
const users = ref<User[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const selectedUser = ref<User | null>(null);
const editMode = ref(false);

// Form fields
const editForm = ref({
  name: '',
  email: '',
  role: ''
});

// Fetch all users
async function fetchUsers() {
  loading.value = true;
  error.value = null;
  
  try {
    // Fetch users from the server
    users.value = await trpc.admin.getAllUsers.query();
  } catch (err: any) {
    error.value = err.message || 'Failed to fetch users';
    console.error('Error fetching users:', err);
  } finally {
    loading.value = false;
  }
}

// Load data on component mount
onMounted(fetchUsers);

// Select a user for editing
function selectUser(user: User) {
  selectedUser.value = user;
  editForm.value = {
    name: user.name || '',
    email: user.email,
    role: user.role
  };
  editMode.value = true;
}

// Cancel editing
function cancelEdit() {
  selectedUser.value = null;
  editMode.value = false;
}

// Save user changes
async function saveUser() {
  if (!selectedUser.value) return;
  
  loading.value = true;
  error.value = null;
  
  try {
    // Update the user on the server
    await trpc.admin.updateUser.mutate({
      id: selectedUser.value.id,
      ...editForm.value
    });
    
    // Refresh the users list
    await fetchUsers();
    
    // Close the edit form
    cancelEdit();
  } catch (err: any) {
    error.value = err.message || 'Failed to update user';
    console.error('Error updating user:', err);
  } finally {
    loading.value = false;
  }
}

// Delete a user
async function deleteUser(id: string) {
  if (!confirm('Are you sure you want to delete this user?')) return;
  
  loading.value = true;
  error.value = null;
  
  try {
    // Delete the user on the server
    await trpc.admin.deleteUser.mutate({ userId: id });
    
    // Refresh the users list
    await fetchUsers();
  } catch (err: any) {
    error.value = err.message || 'Failed to delete user';
    console.error('Error deleting user:', err);
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex justify-between items-center">
      <h2 class="text-2xl font-semibold text-gray-900">User Management</h2>
      <button 
        @click="fetchUsers" 
        class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
        :disabled="loading"
      >
        Refresh Users
      </button>
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
      <span class="ml-3 text-gray-600">Loading users...</span>
    </div>
    
    <!-- Edit User Form -->
    <div v-if="editMode && selectedUser" class="bg-white shadow rounded-md p-6 mb-6">
      <h3 class="text-lg font-medium mb-4">Edit User</h3>
      <form @submit.prevent="saveUser" class="space-y-4">
        <div>
          <label for="name" class="block text-sm font-medium text-gray-700">Name</label>
          <input 
            id="name" 
            v-model="editForm.name" 
            type="text" 
            class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
          />
        </div>
        
        <div>
          <label for="email" class="block text-sm font-medium text-gray-700">Email</label>
          <input 
            id="email" 
            v-model="editForm.email" 
            type="email" 
            class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
          />
        </div>
        
        <div>
          <label for="role" class="block text-sm font-medium text-gray-700">Role</label>
          <select 
            id="role" 
            v-model="editForm.role" 
            class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
          >
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        
        <div class="flex justify-end space-x-3">
          <button 
            type="button" 
            @click="cancelEdit" 
            class="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            Cancel
          </button>
          <button 
            type="submit" 
            class="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
          >
            Save Changes
          </button>
        </div>
      </form>
    </div>
    
    <!-- Users Table -->
    <div v-if="users.length > 0 && !loading" class="bg-white shadow rounded-md overflow-hidden">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              User
            </th>
            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Role
            </th>
            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              ID
            </th>
            <th scope="col" class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-200">
          <tr v-for="user in users" :key="user.id" class="hover:bg-gray-50">
            <td class="px-6 py-4 whitespace-nowrap">
              <div class="flex items-center">
                <div>
                  <div class="text-sm font-medium text-gray-900">
                    {{ user.name || 'No Name' }}
                  </div>
                  <div class="text-sm text-gray-500">{{ user.email }}</div>
                </div>
              </div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
              <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full" 
                :class="user.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-green-100 text-green-800'">
                {{ user.role }}
              </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
              <span class="truncate block max-w-[140px]">{{ user.id }}</span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
              <button 
                @click="selectUser(user)" 
                class="text-blue-600 hover:text-blue-900 mr-3"
              >
                Edit
              </button>
              <button 
                @click="deleteUser(user.id)" 
                class="text-red-600 hover:text-red-900"
                :disabled="user.id === userStore.user?.id"
              >
                Delete
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    
    <!-- Empty state -->
    <div v-if="users.length === 0 && !loading" class="bg-white shadow rounded-md p-8 text-center">
      <p class="text-gray-500">No users found.</p>
    </div>
  </div>
</template> 