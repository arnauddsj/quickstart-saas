<script setup lang="ts">
import { ref } from 'vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

defineProps<{ pending?: boolean }>()
const emit = defineEmits<{ submit: [email: string] }>()

const email = ref('')

function onSubmit() {
  const value = email.value.trim()
  if (value) emit('submit', value)
}
</script>

<template>
  <form class="flex flex-col gap-4" @submit.prevent="onSubmit">
    <div class="flex flex-col gap-2">
      <Label for="email">Email</Label>
      <Input
        id="email"
        v-model="email"
        type="email"
        placeholder="you@example.com"
        required
        autocomplete="email"
      />
    </div>
    <Button type="submit" :disabled="pending">
      {{ pending ? 'Sending...' : 'Send magic link' }}
    </Button>
  </form>
</template>
