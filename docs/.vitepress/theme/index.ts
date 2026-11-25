import DefaultTheme from 'vitepress/theme'
import Layout from './Layout.vue'
import NavNewBadge from './components/NavNewBadge.vue'
import QaControls from './components/QaControls.vue'
import ComplexityChart from './components/ComplexityChart.vue'
import './custom.css'
import type { EnhanceAppContext } from 'vitepress'

export default {
  extends: DefaultTheme,
  Layout,
  enhanceApp({ app }: EnhanceAppContext) {
    app.component('NavNewBadge', NavNewBadge)
    app.component('QaControls', QaControls)
    app.component('ComplexityChart', ComplexityChart)
  },
}
