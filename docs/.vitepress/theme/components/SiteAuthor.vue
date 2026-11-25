<script setup lang="ts">
import { computed } from 'vue'
import { useData, withBase } from 'vitepress'
const { lang } = useData()
const isFa = computed(() => lang.value.startsWith('fa'))
</script>

<template>
  <div class="sidebar-profile" :dir="isFa ? 'rtl' : 'ltr'">
    <a class="sidebar-profile__main" href="https://ardavanshamroshan.ir" target="_blank" rel="noopener noreferrer">
      <img class="sidebar-profile__avatar" :src="withBase('/images/avatar.jpg')" alt="" width="36" height="36" />
      <span class="sidebar-profile__meta">
        <strong>Ardavan ShamRoshan</strong>
        <em>{{ isFa ? 'ارتباط با من' : 'Contact me' }}</em>
      </span>
    </a>
    <div class="sidebar-profile__links">
      <a href="https://ardavanshamroshan.ir" target="_blank" rel="noopener noreferrer">{{ isFa ? 'وب‌سایت' : 'Website' }}</a>
      <a href="https://github.com/ardavanshamroshan" target="_blank" rel="noopener noreferrer">GitHub</a>
      <a href="mailto:ardavanshamroshan@yahoo.com">{{ isFa ? 'ایمیل' : 'Email' }}</a>
    </div>
  </div>
</template>
