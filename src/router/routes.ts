import type { RouteRecordSingleViewWithChildren } from 'vue-router'

import StorageDashboard from '@/views/test/other/StorageDashboard.vue'
import TestDashboard from '@/views/test/TestDashboard.vue'
import DefaultView from '@/views/debug/DefaultView.vue'

export default [
  { path: '/', component: DefaultView },
  { path: '/debug/storage', component: StorageDashboard },
  { path: '/debug/storage2', component: TestDashboard }
] as RouteRecordSingleViewWithChildren[]
