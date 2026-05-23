import type { App } from "vue";

import type { GlobalStore } from "../global.store";
import type { TabOperative } from "./tab.types";

import { runCleanup } from "../../util";
import { useBroadcastStrategy, useSequentialStrategy, useWorkerStrategy } from "./tab-count.strategy";

export function useTabCount(tab: TabOperative) {

  function preInitialize(globalState: GlobalStore) {
    // if(globalState.support.workers?.shared?.native) {
    //   // load worker
    //   tab.store.strategy = useWorkerStrategy()
    // } else if(globalState.support.notification?.broadcastChannel?.native) {
    //   // load BroadcastChannel-type
      // tab.store.strategy = useBroadcastStrategy()
    // } else {
    //   // run cloudflare's rv store
      tab.store.strategy = useSequentialStrategy()
    // }
  }
  function bootstrap(tab: TabOperative) {
    const cleanup = tab.store.strategy?.bootstrap(tab)
    async function tabShow() { await show(tab) }
    async function tabHide() { await hide(tab) }
    async function onVisible() {
      if(document.hidden || document.visibilityState === 'hidden') await tabHide()
      else if(document.visibilityState === 'visible') await tabShow()
    }
    // async function tabClose(e: BeforeUnloadEvent) { e.preventDefault(); await tabHide(); e. }
    // window.addEventListener('pagereveal', tabShow)
    // window.addEventListener('pageshow', tabShow)
    // window.addEventListener('pagehide', tabHide)
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('beforeunload', tabHide)
    return async (app: App<HTMLBodyElement>) => {
      await runCleanup(cleanup!, app)

      // window.removeEventListener('pagereveal', tabShow)
      // window.removeEventListener('pageshow', tabShow)
      // window.removeEventListener('pagehide', tabHide)
      window.removeEventListener('beforeunload', tabHide)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }
  function hide(tab: TabOperative) {
    return tab.store.strategy?.hide(tab)
  }
  function show(tab: TabOperative) {
    return tab.store.strategy?.show(tab)
  }
  /**
   * A check for whether or not this platform is open on other tabs
   * @returns {boolean} returns`true` if the current tab is the one and only tab open else returns false
   */
  function isSingle(): boolean { return tab.store.count === 1 }

  return { isSingle, preInitialize, bootstrap, hide, show }
}
