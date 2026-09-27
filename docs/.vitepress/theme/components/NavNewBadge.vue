<script setup lang="ts">
/**
 * Top-nav "New" badge — visible until NEW_UNTIL (7 days from 2026-09-27).
 * Client-side check so static builds still expire without a redeploy.
 */
import { computed, onMounted, ref } from 'vue'
import { useData, withBase } from 'vitepress'

/** Exclusive end: 2026-10-04 23:59:59 UTC (7 days after 2026-09-27). */
const NEW_UNTIL_MS = Date.UTC(2026, 9, 4, 23, 59, 59)

const { lang, isDark } = useData()
const visible = ref(false)

onMounted(() => {
  visible.value = Date.now() <= NEW_UNTIL_MS
})

const isFa = computed(() => lang.value.startsWith('fa'))
const label = computed(() => (isFa.value ? 'جدید' : 'New'))
const title = computed(() =>
  isFa.value ? 'مستندات جدید توزیع‌شده' : 'New distributed docs',
)
const href = computed(() =>
  withBase(
    isFa.value
      ? '/fa/architecture/fallacies-pacelc'
      : '/architecture/fallacies-pacelc',
  ),
)
</script>

<template>
  <a
    v-if="visible"
    class="NavNewBadge"
    :href="href"
    :title="title"
  >
    <span class="NavNewBadge-text">{{ isFa ? 'توزیع‌شده' : 'Distributed' }}</span>
    <span class="VPBadge tip NavNewBadge-pill" :class="{ dark: isDark }">{{ label }}</span>
  </a>
</template>

<style scoped>
.NavNewBadge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-inline-start: 8px;
  padding: 0 10px;
  height: var(--vp-nav-height);
  font-size: 13px;
  font-weight: 500;
  color: var(--vp-c-text-1);
  text-decoration: none;
  transition: color 0.2s;
}

.NavNewBadge:hover {
  color: var(--vp-c-brand-1);
}

.NavNewBadge-pill {
  margin-left: 0;
  transform: none;
  line-height: 18px;
  padding: 0 7px;
  font-size: 10px;
  border-radius: 999px;
}

@media (max-width: 768px) {
  .NavNewBadge-text {
    display: none;
  }
}
</style>
