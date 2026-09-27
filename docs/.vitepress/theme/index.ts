import DefaultTheme from 'vitepress/theme'
import Layout from './Layout.vue'
import NavNewBadge from './components/NavNewBadge.vue'
import './custom.css'
import type { EnhanceAppContext } from 'vitepress'

export default {
  extends: DefaultTheme,
  Layout,
  enhanceApp({ app }: EnhanceAppContext) {
    app.component('NavNewBadge', NavNewBadge)
  },
}
