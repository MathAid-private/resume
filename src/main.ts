import '@formatjs/intl-durationformat/polyfill.js';
import './assets/styles/main.css';

import { createApp, type App as AppComponent } from 'vue';

import { createPinia } from 'pinia';

import { useGlobalManager } from './composables/managers/global/global.manager';

import App from './App.vue';
import router from './router';

const app = createApp(App) as AppComponent<HTMLBodyElement>
const stores = createPinia()

app.use(stores)// install Pinia store

bootstrap(app)
  .then(cleanup => {
    app.use(router)
    router.isReady().then(() => {
      app.mount('#app')
      app.onUnmount(cleanup)
    })
  })

// const preset = definePreset(lara)


async function bootstrap(a: AppComponent<HTMLBodyElement>) {
  const globalManager = useGlobalManager()
  await globalManager.preInitialize()

  const globalCleanup = await globalManager.bootstrap(a)

  // const storage = new MemoryBackend()
  // const capability = await storage.probe()
  // console.log('capability:', capability)
  // await storage.initialize()
  // const tx = await storage.beginTransaction()
  // const data = Array.from({ length: 20 }).map((_, i) => i)
  // data[Symbol.iterator]().forEach(v => {
  //   storage.write(buildCanonicalKey({
  //     actualKey: `index:${v}`,
  //     callingModule: 'main',
  //     domain: 'platform',
  //     platform: 'chrome',
  //     platformVersion: 148
  //   }), {
  //     backend: 'memory',
  //     expires_at: null,
  //     payload: String(v),
  //     schema_version: 1,
  //     weight: v,
  //     written_at: Date.now(),
  //   }, {
  //     transactionId: tx.id
  //   })
  // })
  // await tx.commit()

  return () => {
    globalCleanup()
  }
}
