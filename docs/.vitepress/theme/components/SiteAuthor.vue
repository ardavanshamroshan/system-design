<script setup lang="ts">
import { computed } from 'vue'
import { useData } from 'vitepress'

const { lang } = useData()
const isFa = computed(() => lang.value.startsWith('fa'))
</script>

<template>
  <div class="site-author" :dir="isFa ? 'rtl' : 'ltr'" :lang="isFa ? 'fa' : 'en'">
    <p class="site-author__label">{{ isFa ? 'نویسنده' : 'Author' }}</p>
    <a
      class="site-author__name"
      href="https://ardavanshamroshan.ir"
      target="_blank"
      rel="noopener"
    >
      Ardavan ShamRoshan
    </a>
    <a
      class="site-author__github"
      href="https://github.com/ardavanshamroshan"
      target="_blank"
      rel="noopener"
    >
      GitHub
    </a>
  </div>
</template>
