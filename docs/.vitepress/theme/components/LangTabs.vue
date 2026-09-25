<script setup lang="ts">
import { computed } from 'vue'
import { useData, withBase } from 'vitepress'

const { lang, page } = useData()

const isFa = computed(() => lang.value.startsWith('fa'))

const relative = computed(() => page.value.relativePath.replace(/\\/g, '/'))

/** Map current page → EN/FA counterparts (locale path without base). */
const pair = computed(() => {
  const rel = relative.value
  if (rel === 'fundamentals/big-o.md' || rel === 'fa/fundamentals/big-o.md') {
    return { en: '/fundamentals/big-o', fa: '/fa/fundamentals/big-o' }
  }
  if (rel === 'index.md' || rel === 'fa/index.md') {
    return { en: '/', fa: '/fa/' }
  }
  return null
})

const show = computed(() => pair.value !== null)

const enHref = computed(() => withBase(pair.value?.en ?? '/'))
const faHref = computed(() => withBase(pair.value?.fa ?? '/fa/'))
</script>

<template>
  <div
    v-if="show"
    class="lang-tabs"
    role="tablist"
    aria-label="Language"
    :dir="isFa ? 'rtl' : 'ltr'"
  >
    <a
      role="tab"
      class="lang-tabs__tab"
      :class="{ 'is-active': !isFa }"
      :aria-selected="!isFa"
      :href="enHref"
      lang="en"
      dir="ltr"
    >
      English
    </a>
    <a
      role="tab"
      class="lang-tabs__tab"
      :class="{ 'is-active': isFa }"
      :aria-selected="isFa"
      :href="faHref"
      lang="fa"
      dir="rtl"
    >
      فارسی
    </a>
  </div>
</template>
