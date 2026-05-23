import type { GlobalStore } from "../global.store";
import { useTabCount } from "./tab-count";
import { useTabStore } from "./tab-store";
import type { TabCountOperative, TabStore } from "./tab.types";

export function useTab() {
  let store: TabStore | null = null;
  let tabCount: TabCountOperative | null = null;

  function preInitialize(state: GlobalStore) {
    store = useTabStore()
    tabCount = useTabCount({
      getOrCreateTabId,
      store
    })

    tabCount.preInitialize(state)
  }
  async function bootstrap() {
    const cleanup = tabCount?.bootstrap({
      getOrCreateTabId,
      store: store!
    })
    await show()
    return cleanup
  }
  function show() {
    return tabCount?.show({
      getOrCreateTabId,
      store: store!
    })
  }
  function hide() {
    return tabCount?.hide({
      getOrCreateTabId,
      store: store!
    })
  }
  function stop() {}
  async function restart() {
    await bootstrap()
    await show()
  }

  /** Generates or reuses a stable ID for this tab instance. */
  function getOrCreateTabId(): string {
      const STORAGE_KEY = "latest_tab_id";

      // window.name survives navigation, sessionStorage survives refresh.
      // If both agree, we have a confirmed identity.
      const nameId = window.name;
      const storageId = sessionStorage.getItem(STORAGE_KEY);

      if (nameId && nameId === storageId) {
          // Confirmed stable identity from a previous load in this tab
          return nameId;
      }

      // Generate a new ID (first visit, or tab was duplicated and needs its own)
      const newId = `tab_${crypto.randomUUID()}`;
      window.name = newId;
      sessionStorage.setItem(STORAGE_KEY, newId);
      return newId;
  }

  return {
    getOrCreateTabId,
    store: store!,
    tabCount: tabCount!,
    show,
    bootstrap,
    hide,
    stop,
    restart,
    preInitialize,
  }
}
