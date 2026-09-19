<script setup lang="ts">
import { workspace } from '@/lib/brand'
import { computed, onMounted } from 'vue'
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

const subscription = useTRPCQuery(
  () => trpc.billing.getSubscription.query(),
  ['billing', 'subscription'],
)

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
  if (status === 'success') toast.success('Subscription updated')
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
            v-if="subscription.data.value.plan !== 'PRO'"
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
  </div>
</template>
