import './assets/styles/main.css'
import '@formatjs/intl-durationformat/polyfill.js';

import { createApp, type App as AppComponent } from 'vue'

import { createPinia } from 'pinia';

import { useGlobalManager } from './composables/managers/global/global.manager';

import App from './App.vue'

const app = createApp(App) as AppComponent<HTMLBodyElement>
const stores = createPinia()

app.use(stores)// install Pinia store

bootstrap(app)
  .then(cleanup => {
    app.mount('#app')
    app.onUnmount(cleanup)
  })

// const preset = definePreset(lara)


async function bootstrap(a: AppComponent<HTMLBodyElement>) {
  const globalManager = useGlobalManager()
  await globalManager.preInitialize()

  const globalCleanup = await globalManager.bootstrap(a)

  return () => {
    globalCleanup()
  }
}
