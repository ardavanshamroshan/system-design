<script setup lang="ts">
import { computed } from 'vue'
import { useData, withBase } from 'vitepress'

const { lang, page } = useData()

const isFa = computed(() => lang.value.startsWith('fa'))

const relative = computed(() => page.value.relativePath.replace(/\\/g, '/'))

/** Every page has EN + FA counterparts under the same relative path. */
const pair = computed(() => {
  const rel = relative.value
  if (rel === 'index.md' || rel === 'fa/index.md') {
    return { en: '/', fa: '/fa/' }
  }
  const bare = rel.replace(/^fa\//, '').replace(/\.md$/, '')
  return {
    en: `/${bare}`,
    fa: `/fa/${bare}`,
  }
})

const enHref = computed(() => withBase(pair.value.en))
const faHref = computed(() => withBase(pair.value.fa))
</script>

<template>
  <div
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
