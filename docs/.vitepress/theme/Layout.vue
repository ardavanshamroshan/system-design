<script setup lang="ts">
import DefaultTheme from 'vitepress/theme'
import LangTabs from './components/LangTabs.vue'
import SiteAuthor from './components/SiteAuthor.vue'

const { Layout } = DefaultTheme

function onSidebarNavigation(event: MouseEvent) {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
  if (!(event.target instanceof Element)) return
  const link = event.target.closest<HTMLAnchorElement>('.VPSidebar.open a[href]')
  if (!link || link.target === '_blank') return
  const destination = new URL(link.href)
  if (destination.origin !== window.location.origin) return
  // Close mobile drawer after navigating (same UX as Database Engineering)
  document.querySelector<HTMLElement>('.VPBackdrop')?.click()
}
</script>

<template>
  <Layout @click.capture="onSidebarNavigation">
    <template #doc-before>
      <LangTabs />
    </template>
    <template #sidebar-nav-after>
      <SiteAuthor />
    </template>
  </Layout>
</template>
