<script setup lang="ts">
import DefaultTheme from 'vitepress/theme'
import LangTabs from './components/LangTabs.vue'
import SiteAuthor from './components/SiteAuthor.vue'

const { Layout } = DefaultTheme
</script>

<template>
  <Layout>
    <template #doc-before>
      <LangTabs />
    </template>
    <template #sidebar-nav-after>
      <SiteAuthor />
    </template>
  </Layout>
</template>
