<script setup lang="ts">
// docs/billing.md
import { workspace } from '@/lib/brand'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import { errorMessage, trpc, useTRPCMutation, useTRPCQuery } from '@/services/server'
import { runAction } from '@/lib/monitoring'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

const route = useRoute()
const router = useRouter()

const org = useTRPCQuery(() => trpc.org.current.query(), ['org', 'current'])
const canManage = computed(
  () => org.data.value?.myRole === 'owner' || org.data.value?.myRole === 'admin',
)

const CONFIRM_POLL_MS = 2_000
const CONFIRM_TIMEOUT_MS = 60_000

const confirming = ref(false)
const confirmSlow = ref(false)
let confirmTimer: ReturnType<typeof setTimeout> | undefined

const subscription = useTRPCQuery(
  () => trpc.billing.getSubscription.query(),
  ['billing', 'subscription'],
  { refetchInterval: computed(() => (confirming.value ? CONFIRM_POLL_MS : false)) },
)

watch(
  () => subscription.data.value?.plan,
  (plan) => {
    if (!confirming.value || !plan || plan === 'FREE') return
    confirming.value = false
    clearTimeout(confirmTimer)
    toast.success(`You are on ${plan} now`)
  },
)
onUnmounted(() => clearTimeout(confirmTimer))

const pastDue = computed(() => subscription.data.value?.status === 'past_due')

const checkout = useTRPCMutation<void, { url: string }>(
  () =>
    runAction('billing.checkout', (actionId) =>
      trpc.billing.createCheckout.mutate(undefined, { context: { actionId } }),
    ),
  {
    onSuccess: ({ url }) => window.location.assign(url),
    onError: (e) => toast.error(errorMessage(e)),
  },
)
const portal = useTRPCMutation<void, { url: string }>(() => trpc.billing.createPortal.mutate(), {
  onSuccess: ({ url }) => window.location.assign(url),
  onError: (e) => toast.error(errorMessage(e)),
})

onMounted(() => {
  const status = route.query.status
  if (status === 'success') {
    confirming.value = true
    confirmTimer = setTimeout(() => {
      confirming.value = false
      confirmSlow.value = true
    }, CONFIRM_TIMEOUT_MS)
  }
  if (status === 'cancelled') toast.info('Checkout cancelled')
  if (status) void router.replace({ query: {} })
})

function formatDate(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString() : null
}
</script>

<template>
  <div class="flex max-w-2xl flex-col gap-6">
    <h1 class="text-2xl font-semibold">Billing</h1>
    <p v-if="confirming" role="status" class="rounded-md border bg-muted px-4 py-3 text-sm">
      Payment received by Stripe. Waiting for the confirmation to reach us; this takes a few
      seconds.
    </p>
    <p v-else-if="confirmSlow" role="status" class="rounded-md border px-4 py-3 text-sm">
      Stripe has not confirmed the subscription yet. Reload this page in a minute; paying again is
      not needed.
    </p>
    <div
      v-if="pastDue"
      role="alert"
      class="flex flex-wrap items-center justify-between gap-3 rounded-md border border-destructive/40 px-4 py-3 text-sm"
    >
      <span>
        The last payment failed. Stripe will retry; update the card to keep the
        {{ subscription.data.value?.plan }} plan.
      </span>
      <Button
        v-if="canManage"
        size="sm"
        variant="destructive"
        :disabled="portal.isPending.value"
        @click="portal.mutate()"
      >
        Update payment method
      </Button>
    </div>
    <Card>
      <CardHeader>
        <CardTitle class="flex items-center gap-2">
          Current plan
          <Badge v-if="subscription.data.value" variant="secondary">{{
            subscription.data.value.plan
          }}</Badge>
        </CardTitle>
        <CardDescription v-if="subscription.data.value">
          Status: {{ subscription.data.value.status }}
          <template v-if="subscription.data.value.currentPeriodEnd">
            · {{ subscription.data.value.cancelAtPeriodEnd ? 'Ends' : 'Renews' }} on
            {{ formatDate(subscription.data.value.currentPeriodEnd) }}
          </template>
        </CardDescription>
      </CardHeader>
      <CardContent class="flex gap-2">
        <Skeleton v-if="subscription.isPending.value" class="h-9 w-40" />
        <p v-else-if="subscription.data.value && !canManage" class="text-sm text-muted-foreground">
          Only owners and admins of this {{ workspace.one }} can change its plan.
        </p>
        <template v-else-if="subscription.data.value">
          <Button
            v-if="subscription.data.value.plan !== 'PRO' && !confirming"
            :disabled="checkout.isPending.value"
            @click="checkout.mutate()"
          >
            Upgrade to Pro
          </Button>
          <Button
            v-if="subscription.data.value.hasStripeCustomer"
            variant="outline"
            :disabled="portal.isPending.value"
            @click="portal.mutate()"
          >
            Manage billing
          </Button>
        </template>
        <p v-else-if="subscription.error.value" class="text-sm text-destructive">
          {{ errorMessage(subscription.error.value) }}
        </p>
      </CardContent>
    </Card>
    <Card v-if="subscription.data.value?.usage.length">
      <CardHeader>
        <CardTitle>Usage</CardTitle>
        <CardDescription>What this {{ workspace.one }} uses against its plan.</CardDescription>
      </CardHeader>
      <CardContent class="flex flex-col gap-4">
        <div v-for="u in subscription.data.value.usage" :key="u.limit" class="flex flex-col gap-1">
          <div class="flex justify-between text-sm">
            <span class="capitalize">{{ u.limit }}</span>
            <span
              :class="u.used >= u.max ? 'font-medium text-destructive' : 'text-muted-foreground'"
              >{{ u.used }} of {{ u.max }}</span
            >
          </div>
          <div class="h-2 overflow-hidden rounded-full bg-muted">
            <div
              class="h-full rounded-full"
              :class="u.used >= u.max ? 'bg-destructive' : 'bg-primary'"
              :style="{ width: `${Math.min(100, (u.used / u.max) * 100)}%` }"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  </div>
</template>
