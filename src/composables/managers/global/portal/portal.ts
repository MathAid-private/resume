import type { Router } from "vue-router";

import { tryRun } from "../../util";
import { PortalContext, usePortalStore, type IPathReferer } from "./portal-store";

export function usePortal() {
  const store = usePortalStore()
  const weight = 512 as const;

  function startLoading() {
    store.context = PortalContext.BUSY
  }
  function stopLoading() {
    store.context = PortalContext.IDLE
  }

  function generateReference(from: IPathReferer) {
    tryRun(() => store.referer.push(from))
  }

  async function consumeReference(router: Router, alt = '') {
    await tryRun(async () => {
      await router.push(store.referer.pop() || alt)
    })
  }

  return {
    weight,

    consumeReference,
    generateReference,
    startLoading,
    stopLoading,
  }
}
