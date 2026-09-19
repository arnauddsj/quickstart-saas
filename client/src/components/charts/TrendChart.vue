<script setup lang="ts">
// docs/analytics.md
import { computed, ref } from 'vue'
import {
  BarElement,
  CategoryScale,
  Chart,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
  type ChartOptions,
  type Plugin,
} from 'chart.js'
import { Bar, Line } from 'vue-chartjs'

Chart.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Tooltip, Legend)

const props = defineProps<{
  kind: 'bar' | 'line'
  label: string
  labels: string[]
  series: { name: string; values: number[] }[]
}>()

const showTable = ref(false)

const token = (name: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#888'

const crosshair: Plugin = {
  id: 'crosshair',
  afterDatasetsDraw(chart) {
    const active = chart.tooltip?.getActiveElements() ?? []
    if (!active.length) return
    const { ctx, chartArea } = chart
    const x = active[0]!.element.x
    ctx.save()
    ctx.strokeStyle = token('--chart-axis')
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(x, chartArea.top)
    ctx.lineTo(x, chartArea.bottom)
    ctx.stroke()
    ctx.restore()
  },
}

const data = computed(() => ({
  labels: props.labels,
  datasets: props.series.map((s, i) => {
    const color = token(`--chart-${i + 1}`)
    return props.kind === 'bar'
      ? {
          label: s.name,
          data: s.values,
          backgroundColor: color,
          maxBarThickness: 24,
          borderRadius: { topLeft: 4, topRight: 4 },
          borderSkipped: 'start' as const,
        }
      : {
          label: s.name,
          data: s.values,
          borderColor: color,
          backgroundColor: color,
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 4,
          pointHitRadius: 12,
          tension: 0,
        }
  }),
}))

const options = computed(
  () =>
    ({
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          display: props.series.length > 1,
          position: 'top',
          align: 'start',
          labels: {
            color: token('--muted-foreground'),
            boxWidth: 12,
            boxHeight: props.kind === 'line' ? 2 : 12,
          },
        },
        tooltip: { boxWidth: 12, boxHeight: 2 },
      },
      scales: {
        x: {
          grid: { display: false },
          border: { color: token('--chart-grid') },
          ticks: { color: token('--chart-axis'), maxRotation: 0, autoSkipPadding: 12 },
        },
        y: {
          beginAtZero: true,
          grid: { color: token('--chart-grid') },
          border: { display: false },
          ticks: { color: token('--chart-axis'), precision: 0 },
        },
      },
    }) as ChartOptions<'bar'> & ChartOptions<'line'>,
)
</script>

<template>
  <div>
    <div v-if="!showTable" class="h-56" role="img" :aria-label="label">
      <Bar v-if="kind === 'bar'" :data="data" :options="options" :plugins="[crosshair]" />
      <Line v-else :data="data" :options="options" :plugins="[crosshair]" />
    </div>
    <table v-else class="w-full text-sm">
      <thead>
        <tr class="border-b text-left text-muted-foreground">
          <th class="py-1 pr-3 font-medium">Week</th>
          <th v-for="s in series" :key="s.name" class="py-1 pr-3 text-right font-medium">
            {{ s.name }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(l, i) in labels" :key="l" class="border-b last:border-0">
          <td class="py-1 pr-3">{{ l }}</td>
          <td v-for="s in series" :key="s.name" class="py-1 pr-3 text-right tabular-nums">
            {{ s.values[i] }}
          </td>
        </tr>
      </tbody>
    </table>
    <button
      type="button"
      class="mt-2 text-xs text-muted-foreground underline-offset-2 hover:underline"
      @click="showTable = !showTable"
    >
      {{ showTable ? 'Show chart' : 'Show table' }}
    </button>
  </div>
</template>
