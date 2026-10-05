<script setup lang="ts">
// docs/analytics.md
import { computed, defineAsyncComponent } from 'vue'
import { workspace } from '@/lib/brand'
import { trpc, useTRPCQuery } from '@/services/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

const TrendChart = defineAsyncComponent(() => import('@/components/charts/TrendChart.vue'))

const analytics = useTRPCQuery(() => trpc.admin.analytics.query(), ['admin', 'analytics'], {
  staleTime: 60_000,
})
const a = computed(() => analytics.data.value)

const pct = (v: number | null | undefined) => (v == null ? '—' : `${Math.round(v * 100)}%`)
const week = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })

const tiles = computed(() => {
  const d = a.value
  if (!d) return []
  return [
    { label: 'Active users, 7 days', value: d.headline.activeUsers7d.toLocaleString() },
    { label: 'Active users, 28 days', value: d.headline.activeUsers28d.toLocaleString() },
    { label: 'Stickiness (daily ÷ monthly)', value: pct(d.headline.stickiness) },
    {
      label: `Activation: ${d.activation.event} within ${d.activation.windowDays} days`,
      value: pct(d.activation.rate),
      note: `${d.activation.cohort} sign-ups measured`,
    },
    { label: `Paid ${workspace.many}`, value: pct(d.plans.paidRate) },
    { label: 'Checkouts started, 30 days', value: d.plans.checkouts30d.toLocaleString() },
    { label: 'Cancellations, 30 days', value: d.plans.cancelled30d.toLocaleString() },
  ]
})

const weekLabels = computed(() => (a.value?.weeks ?? []).map((w) => week(w.week)))

const eventSeries = computed(() => {
  const d = a.value
  if (!d) return []
  const types = [...new Set(d.events.map((e) => e.type))].sort()
  return types.map((type) => ({
    name: type,
    values: d.weeks.map(
      (w) => d.events.find((e) => e.type === type && e.week === w.week)?.events ?? 0,
    ),
  }))
})

const RAMP = [
  { bg: '#cde2fb', ink: '#0b0b0b' },
  { bg: '#9ec5f4', ink: '#0b0b0b' },
  { bg: '#6da7ec', ink: '#0b0b0b' },
  { bg: '#2a78d6', ink: '#ffffff' },
  { bg: '#184f95', ink: '#ffffff' },
]
function heat(rate: number | null) {
  if (rate === null) return {}
  const step = RAMP[Math.min(RAMP.length - 1, Math.floor(rate * RAMP.length))]!
  return { backgroundColor: step.bg, color: step.ink }
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-semibold">Analytics</h1>
      <p class="text-sm text-muted-foreground">
        First-party usage over the last 12 weeks. A person is active on a day when they use the app
        while signed in.
      </p>
    </div>

    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <template v-if="analytics.isPending.value">
        <Skeleton v-for="i in 4" :key="i" class="h-24" />
      </template>
      <Card v-for="t in tiles" :key="t.label">
        <CardHeader class="pb-2">
          <CardTitle class="text-sm font-medium text-muted-foreground">{{ t.label }}</CardTitle>
        </CardHeader>
        <CardContent>
          <div class="text-3xl font-semibold">{{ t.value }}</div>
          <p v-if="t.note" class="text-xs text-muted-foreground">{{ t.note }}</p>
        </CardContent>
      </Card>
    </div>

    <div v-if="a" class="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Sign-ups per week</CardTitle>
        </CardHeader>
        <CardContent>
          <TrendChart
            kind="bar"
            label="Sign-ups per week"
            :labels="weekLabels"
            :series="[{ name: 'Sign-ups', values: a.weeks.map((w) => w.signups) }]"
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Active users per week</CardTitle>
        </CardHeader>
        <CardContent>
          <TrendChart
            kind="line"
            label="Active users per week"
            :labels="weekLabels"
            :series="[{ name: 'Active users', values: a.weeks.map((w) => w.active) }]"
          />
        </CardContent>
      </Card>
    </div>

    <Card v-if="a">
      <CardHeader>
        <CardTitle>Retention by sign-up week</CardTitle>
        <CardDescription>
          Share of each week's new users who were active again N weeks later. A curve that flattens
          instead of falling to zero is the clearest sign of product-market fit.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p v-if="a.retention.length === 0" class="text-sm text-muted-foreground">
          No sign-ups in the last 12 weeks yet.
        </p>
        <Table v-else>
          <TableHeader>
            <TableRow>
              <TableHead>Signed up</TableHead>
              <TableHead class="text-right">Users</TableHead>
              <TableHead v-for="r in a.retention[0]!.retained" :key="r.weeks" class="text-center">
                Week {{ r.weeks }}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="c in a.retention" :key="c.week">
              <TableCell>{{ week(c.week) }}</TableCell>
              <TableCell class="text-right tabular-nums">{{ c.size }}</TableCell>
              <TableCell
                v-for="r in c.retained"
                :key="r.weeks"
                class="text-center tabular-nums"
                :style="heat(r.rate)"
                :title="r.rate === null ? 'Not reached yet' : undefined"
              >
                {{ pct(r.rate) }}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>

    <Card v-if="a">
      <CardHeader>
        <CardTitle>Plans against their limits</CardTitle>
        <CardDescription>
          If most free {{ workspace.many }} never approach a limit, the free plan may be too
          generous. If paid {{ workspace.many }} rarely use more than the free plan allows, the paid
          plan is not yet delivering its value.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Plan</TableHead>
              <TableHead class="text-right">{{ workspace.Many }}</TableHead>
              <TableHead>Limit</TableHead>
              <TableHead class="text-right">Median used</TableHead>
              <TableHead class="text-right">At 80% or more</TableHead>
              <TableHead class="text-right">At the limit</TableHead>
              <TableHead class="text-right">Beyond the free limit</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <template v-for="p in a.plans.byPlan" :key="p.plan">
              <TableRow v-for="l in p.limits" :key="`${p.plan}-${l.limit}`">
                <TableCell class="font-medium">{{ p.label }}</TableCell>
                <TableCell class="text-right tabular-nums">{{ p.workspaces }}</TableCell>
                <TableCell>{{ l.limit }} (max {{ l.max }})</TableCell>
                <TableCell class="text-right tabular-nums">{{ l.median }}</TableCell>
                <TableCell class="text-right tabular-nums">{{ pct(l.nearLimit) }}</TableCell>
                <TableCell class="text-right tabular-nums">{{ pct(l.atLimit) }}</TableCell>
                <TableCell class="text-right tabular-nums">{{ pct(l.beyondFree) }}</TableCell>
              </TableRow>
            </template>
          </TableBody>
        </Table>
      </CardContent>
    </Card>

    <Card v-if="a">
      <CardHeader>
        <CardTitle>Tracked events per week</CardTitle>
        <CardDescription>The five most frequent event types.</CardDescription>
      </CardHeader>
      <CardContent>
        <p v-if="eventSeries.length === 0" class="text-sm text-muted-foreground">
          No events tracked yet.
        </p>
        <TrendChart
          v-else
          kind="line"
          label="Tracked events per week"
          :labels="weekLabels"
          :series="eventSeries"
        />
      </CardContent>
    </Card>

    <div v-if="a" class="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Most active {{ workspace.many }}, 30 days</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{{ workspace.One }}</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead class="text-right">Active users</TableHead>
                <TableHead class="text-right">Events</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="w in a.topWorkspaces" :key="w.id">
                <TableCell>{{ w.name }}</TableCell>
                <TableCell>{{ w.plan }}</TableCell>
                <TableCell class="text-right tabular-nums">{{ w.activeUsers }}</TableCell>
                <TableCell class="text-right tabular-nums">{{ w.events }}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Feature use by plan, 30 days</CardTitle>
          <CardDescription>What paying {{ workspace.many }} rely on.</CardDescription>
        </CardHeader>
        <CardContent>
          <p v-if="a.featuresByPlan.length === 0" class="text-sm text-muted-foreground">
            No events tracked yet.
          </p>
          <Table v-else>
            <TableHeader>
              <TableRow>
                <TableHead>Event</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead class="text-right">Events</TableHead>
                <TableHead class="text-right">Users</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="f in a.featuresByPlan" :key="`${f.type}-${f.plan}`">
                <TableCell>{{ f.type }}</TableCell>
                <TableCell>{{ f.plan }}</TableCell>
                <TableCell class="text-right tabular-nums">{{ f.events }}</TableCell>
                <TableCell class="text-right tabular-nums">{{ f.users }}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  </div>
</template>
