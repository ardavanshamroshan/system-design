<script setup lang="ts">
import DefaultTheme from 'vitepress/theme'
import LangTabs from './components/LangTabs.vue'

const { Layout } = DefaultTheme
</script>

<template>
  <Layout>
    <template #doc-before>
      <LangTabs />
    </template>
  </Layout>
</template>
