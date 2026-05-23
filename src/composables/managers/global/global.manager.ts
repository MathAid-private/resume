import { GLOBAL_ERROR_EVENT } from "@/constants/global-state.manager.const";

import type { FunctionLike } from "@/modules/util.dto";
import type { App } from "vue";
import type { PlatformErrorEvent } from "../manager.dto";
import type { IGlobalEventMap } from "./global.dto";

import { detectBrowser } from "@/libs/user-agent";
import { runCleanup, tryRun } from "../util";

import { useGlobalStore } from "./global.store";

import { usePortal } from "./portal/portal";
import { useTab } from "./tab/tab";

function detectWorkers() {
  return {
    webWorker: typeof Worker !== 'undefined',
    sharedWorker: typeof SharedWorker !== 'undefined',
    serviceWorker: typeof navigator !== 'undefined' && 'serviceWorker' in navigator
  };
}

export function useGlobalManager() {
  const tab = useTab()
  const portal = usePortal()
  const store = useGlobalStore()

  /*---------------------------------------
   * Private
   *-------------------------------------*/
  function defineEvent<K extends keyof IGlobalEventMap>(
    key: K,
    callback: FunctionLike<[IGlobalEventMap[K]], void>
  ) {
    document.addEventListener(key as keyof DocumentEventMap, callback as unknown as EventListener)
  }
  function declareEvents() {
    defineEvent(GLOBAL_ERROR_EVENT, onManagerError)
  }
  async function scaffoldSupportTable() {
    const detectedWorkers = detectWorkers()
    store.support.workers = {
      service: {
        native: detectedWorkers.serviceWorker
      },
      shared: {
        native: detectedWorkers.sharedWorker
      },
      web: {
        native: detectedWorkers.webWorker
      }
    }
    store.support.userAgent = await detectBrowser()
  }

  /*---------------------------------------
   * Public
   *-------------------------------------*/
  function onManagerError(e: PlatformErrorEvent) {
    store.errors.push(e.detail)
  }
  async function preInitialize() {
    declareEvents()
    await scaffoldSupportTable()

    tab.preInitialize(store)
  }
  async function bootstrap(app: App<HTMLBodyElement>) {
    const tabCleanup = (await tab.bootstrap())!
    return async () => {
      await tryRun(async() => await runCleanup(tabCleanup, app))
    }
  }
  async function show() {
    await tab.show()
  }
  async function hide() {
    await tab.hide()
  }
  async function restart() {
    await tab.restart()
  }
  async function stop() {
    await tab.stop()
  }

  return {
    tab,
    portal,

    preInitialize,
    bootstrap,
    restart,
    stop,
    show,
    hide
  }
}

export type GlobalManager = ReturnType<typeof useGlobalManager>;
