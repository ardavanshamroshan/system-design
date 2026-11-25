<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useData } from 'vitepress'

type Filter = 'all' | 'important' | 'must'

const { lang } = useData()
const fa = computed(() => lang.value.startsWith('fa'))
const root = ref<HTMLElement | null>(null)
const filter = ref<Filter>('all')
const counts = ref({ must: 0, important: 0, extra: 0 })

const t = computed(() =>
  fa.value
    ? {
        open: 'بازکردن همهٔ پاسخ‌ها',
        close: 'بستن همه (خودآزمایی)',
        show: 'نمایش:',
        all: 'همه',
        important: 'حیاتی + مهم',
        must: 'فقط حیاتی',
        l1: 'حیاتی',
        l2: 'مهم',
        l3: 'تکمیلی',
        l1d: 'تقریباً در هر مصاحبه پرسیده می‌شود',
        l2d: 'پرتکرار؛ برای سطح ارشد لازم است',
        l3d: 'عمق بیشتر؛ تمایز ایجاد می‌کند',
      }
    : {
        open: 'Open all answers',
        close: 'Close all (self-test)',
        show: 'Show:',
        all: 'All',
        important: 'Must-know + Important',
        must: 'Must-know only',
        l1: 'Must-know',
        l2: 'Important',
        l3: 'Good to know',
        l1d: 'asked in almost every interview',
        l2d: 'frequent; expected at senior level',
        l3d: 'extra depth that sets you apart',
      },
)

function doc(): HTMLElement | null {
  return root.value?.closest<HTMLElement>('.vp-doc') ?? null
}

function questions(): { heading: HTMLElement; level: 1 | 2 | 3 }[] {
  const container = doc()
  if (!container) return []
  return Array.from(container.querySelectorAll<HTMLElement>('h3[id^="q-"]')).map((heading) => {
    const badge = heading.querySelector('.VPBadge')
    const level = badge?.classList.contains('danger') ? 1 : badge?.classList.contains('warning') ? 2 : 3
    return { heading, level }
  })
}

function setOpen(open: boolean) {
  doc()
    ?.querySelectorAll<HTMLDetailsElement>('details')
    .forEach((d) => (d.open = open))
}

function applyFilter(next: Filter) {
  filter.value = next
  const max = next === 'must' ? 1 : next === 'important' ? 2 : 3
  for (const { heading, level } of questions()) {
    const hidden = level > max
    heading.hidden = hidden
    const answer = heading.nextElementSibling
    if (answer instanceof HTMLElement && answer.tagName === 'DETAILS') answer.hidden = hidden
  }
}

onMounted(() => {
  const c = { must: 0, important: 0, extra: 0 }
  for (const { level } of questions()) {
    if (level === 1) c.must++
    else if (level === 2) c.important++
    else c.extra++
  }
  counts.value = c
})
</script>

<template>
  <div ref="root" class="qa-controls">
    <div class="qa-controls__row">
      <button type="button" @click="setOpen(true)">{{ t.open }}</button>
      <button type="button" @click="setOpen(false)">{{ t.close }}</button>
    </div>
    <div class="qa-controls__row">
      <span class="qa-controls__label">{{ t.show }}</span>
      <button type="button" :class="{ active: filter === 'all' }" @click="applyFilter('all')">{{ t.all }}</button>
      <button type="button" :class="{ active: filter === 'important' }" @click="applyFilter('important')">
        {{ t.important }}
      </button>
      <button type="button" :class="{ active: filter === 'must' }" @click="applyFilter('must')">{{ t.must }}</button>
    </div>
    <ul class="qa-controls__legend">
      <li><Badge type="danger" :text="t.l1" /> {{ t.l1d }} <span v-if="counts.must">({{ counts.must }})</span></li>
      <li>
        <Badge type="warning" :text="t.l2" /> {{ t.l2d }} <span v-if="counts.important">({{ counts.important }})</span>
      </li>
      <li><Badge type="info" :text="t.l3" /> {{ t.l3d }} <span v-if="counts.extra">({{ counts.extra }})</span></li>
    </ul>
  </div>
</template>
