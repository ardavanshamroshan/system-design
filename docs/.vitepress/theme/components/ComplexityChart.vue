<script setup lang="ts">
import { computed, ref } from 'vue'
import { useData } from 'vitepress'

const { lang } = useData()
const fa = computed(() => lang.value.startsWith('fa'))

interface Curve {
  key: string
  label: string
  color: string
  /** log10 of the operation count for input size n */
  log10: (n: number) => number
  fa: string
  en: string
}

const LOG10_2 = Math.log10(2)

function log10Factorial(n: number): number {
  if (n < 2) return 0
  // Stirling's approximation, accurate enough for a growth illustration
  return (n * Math.log(n) - n + 0.5 * Math.log(2 * Math.PI * n)) / Math.LN10
}

const curves: Curve[] = [
  { key: 'c', label: 'O(1)', color: '#2e9e6b', log10: () => 0, fa: 'عالی', en: 'excellent' },
  { key: 'log', label: 'O(log n)', color: '#1f9aa8', log10: (n) => Math.log10(Math.max(1, Math.log2(n))), fa: 'عالی', en: 'excellent' },
  { key: 'n', label: 'O(n)', color: '#3b78d8', log10: (n) => Math.log10(n), fa: 'خوب', en: 'good' },
  { key: 'nlog', label: 'O(n log n)', color: '#8a5cd6', log10: (n) => Math.log10(n * Math.max(1, Math.log2(n))), fa: 'قابل‌قبول', en: 'fair' },
  { key: 'n2', label: 'O(n²)', color: '#d98a1f', log10: (n) => 2 * Math.log10(n), fa: 'بد', en: 'bad' },
  { key: '2n', label: 'O(2ⁿ)', color: '#d9482b', log10: (n) => n * LOG10_2, fa: 'فاجعه', en: 'terrible' },
  { key: 'fact', label: 'O(n!)', color: '#a3123a', log10: (n) => log10Factorial(n), fa: 'فاجعه', en: 'terrible' },
]

// ---- chart -------------------------------------------------------------
const W = 640
const H = 360
const PAD = { l: 48, r: 16, t: 16, b: 40 }
const maxN = ref(30)
const yMax = computed(() => maxN.value * maxN.value * 0.6)

function path(curve: Curve): string {
  const pts: string[] = []
  const steps = 120
  for (let i = 0; i <= steps; i++) {
    const n = 1 + ((maxN.value - 1) * i) / steps
    const ops = Math.pow(10, Math.min(curve.log10(n), 12))
    const x = PAD.l + ((n - 1) / (maxN.value - 1)) * (W - PAD.l - PAD.r)
    const clipped = Math.min(ops, yMax.value * 1.05)
    const y = H - PAD.b - (clipped / yMax.value) * (H - PAD.t - PAD.b)
    pts.push(`${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${Math.max(y, PAD.t - 6).toFixed(1)}`)
    if (ops > yMax.value * 1.05) break
  }
  return pts.join(' ')
}

const xTicks = computed(() => [0.25, 0.5, 0.75, 1].map((f) => Math.round(1 + (maxN.value - 1) * f)))
const xOf = (n: number) => PAD.l + ((n - 1) / (maxN.value - 1)) * (W - PAD.l - PAD.r)

// ---- time table --------------------------------------------------------
const sizes = [10, 20, 50, 100, 1_000, 1_000_000, 1_000_000_000]
const sizeIndex = ref(4)
const n = computed(() => sizes[sizeIndex.value])
const OPS_PER_SEC_LOG10 = 9 // ~1 billion simple operations per second

function fmtInt(v: number): string {
  return v.toLocaleString('en-US')
}

function fmtOps(log10: number): string {
  if (log10 < 15) return fmtInt(Math.round(Math.pow(10, log10)))
  return `≈ 10^${Math.round(log10)}`
}

function fmtTime(log10ops: number): string {
  const s = log10ops - OPS_PER_SEC_LOG10 // log10 seconds
  const f = fa.value
  const unit = (v: number, en: string, faUnit: string) => `${v < 10 ? v.toFixed(1) : Math.round(v)} ${f ? faUnit : en}`
  if (s > 17.6) return f ? 'بیشتر از عمر کیهان' : 'longer than the age of the universe'
  const sec = Math.pow(10, s)
  if (sec < 1e-6) return unit(sec * 1e9, 'ns', 'نانوثانیه')
  if (sec < 1e-3) return unit(sec * 1e6, 'µs', 'میکروثانیه')
  if (sec < 1) return unit(sec * 1e3, 'ms', 'میلی‌ثانیه')
  if (sec < 60) return unit(sec, 's', 'ثانیه')
  if (sec < 3600) return unit(sec / 60, 'min', 'دقیقه')
  if (sec < 86400) return unit(sec / 3600, 'hours', 'ساعت')
  if (sec < 86400 * 365) return unit(sec / 86400, 'days', 'روز')
  const years = sec / (86400 * 365)
  if (years < 1e6) return `${fmtInt(Math.round(years))} ${f ? 'سال' : 'years'}`
  return `≈ 10^${Math.round(Math.log10(years))} ${f ? 'سال' : 'years'}`
}

const rows = computed(() =>
  curves.map((c) => {
    const l = c.log10(n.value)
    return { ...c, ops: fmtOps(l), time: fmtTime(l), verdict: fa.value ? c.fa : c.en }
  }),
)

const t = computed(() =>
  fa.value
    ? {
        chartTitle: 'رشد تعداد عملیات با بزرگ‌شدن ورودی',
        range: 'بازهٔ n روی نمودار',
        x: 'اندازهٔ ورودی (n)',
        y: 'تعداد عملیات',
        pick: 'اندازهٔ ورودی را انتخاب کن',
        cls: 'مرتبه',
        ops: 'تعداد عملیات',
        time: 'زمان تقریبی',
        verdict: 'ارزیابی',
        note: 'فرض: حدود یک میلیارد عملیات ساده در ثانیه روی یک هسته. عددها برای حس‌گرفتن از مرتبهٔ بزرگی‌اند، نه بنچمارک.',
      }
    : {
        chartTitle: 'How the operation count grows with input size',
        range: 'n range on the chart',
        x: 'Input size (n)',
        y: 'Operations',
        pick: 'Pick an input size',
        cls: 'Class',
        ops: 'Operations',
        time: 'Approx. time',
        verdict: 'Verdict',
        note: 'Assumes about one billion simple operations per second on one core. The numbers convey orders of magnitude; they are not a benchmark.',
      },
)
</script>

<template>
  <div class="cx-chart" dir="ltr">
    <figure>
      <figcaption :dir="fa ? 'rtl' : 'ltr'">{{ t.chartTitle }}</figcaption>
      <svg :viewBox="`0 0 ${W} ${H}`" role="img" :aria-label="t.chartTitle">
        <line :x1="PAD.l" :y1="H - PAD.b" :x2="W - PAD.r" :y2="H - PAD.b" class="cx-axis" />
        <line :x1="PAD.l" :y1="PAD.t" :x2="PAD.l" :y2="H - PAD.b" class="cx-axis" />
        <g v-for="f in [0.25, 0.5, 0.75, 1]" :key="f">
          <line
            :x1="PAD.l"
            :x2="W - PAD.r"
            :y1="H - PAD.b - f * (H - PAD.t - PAD.b)"
            :y2="H - PAD.b - f * (H - PAD.t - PAD.b)"
            class="cx-grid"
          />
          <text :x="PAD.l - 6" :y="H - PAD.b - f * (H - PAD.t - PAD.b) + 4" text-anchor="end" class="cx-tick">
            {{ Math.round(yMax * f) }}
          </text>
        </g>
        <text v-for="x in xTicks" :key="x" :x="xOf(x)" :y="H - PAD.b + 16" text-anchor="middle" class="cx-tick">
          {{ x }}
        </text>
        <text :x="(W + PAD.l) / 2" :y="H - 6" text-anchor="middle" class="cx-label">{{ t.x }}</text>
        <path v-for="c in curves" :key="c.key" :d="path(c)" :stroke="c.color" fill="none" stroke-width="2.5" />
      </svg>
      <div class="cx-legend">
        <span v-for="c in curves" :key="c.key"><i :style="{ background: c.color }" />{{ c.label }}</span>
      </div>
      <label class="cx-range" :dir="fa ? 'rtl' : 'ltr'">
        {{ t.range }}: <b dir="ltr">1 … {{ maxN }}</b>
        <input v-model.number="maxN" type="range" min="8" max="100" step="1" />
      </label>
    </figure>

    <div class="cx-table" :dir="fa ? 'rtl' : 'ltr'">
      <div class="cx-sizes">
        <span>{{ t.pick }}:</span>
        <button
          v-for="(s, i) in sizes"
          :key="s"
          type="button"
          :class="{ active: i === sizeIndex }"
          dir="ltr"
          @click="sizeIndex = i"
        >
          n = {{ fmtInt(s) }}
        </button>
      </div>
      <table>
        <thead>
          <tr>
            <th>{{ t.cls }}</th>
            <th>{{ t.ops }}</th>
            <th>{{ t.time }}</th>
            <th>{{ t.verdict }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in rows" :key="r.key">
            <td dir="ltr"><i class="cx-dot" :style="{ background: r.color }" /><code>{{ r.label }}</code></td>
            <td dir="ltr">{{ r.ops }}</td>
            <td>{{ r.time }}</td>
            <td>{{ r.verdict }}</td>
          </tr>
        </tbody>
      </table>
      <p class="cx-note">{{ t.note }}</p>
    </div>
  </div>
</template>
