import { reactive, ref } from "vue"

import type { Router } from "vue-router";

import { defineStore } from "pinia"

export enum PortalKind {
  WEBSITE,
  LEGAL,
  USER,
  CORPORATE = 4,
  INTERNAL = 8,
}
export enum PortalContext {
  IDLE,
  BLOCKING,
  BUSY,
}

export type IPathReferer = Parameters<Router['push']>[0]

function composePortalStore() {
  const kind = ref(0)
  const referer = reactive<IPathReferer[]>([])
  const context = ref<PortalContext>(PortalContext.BUSY)
  return {
    /** A bitmap using one of the values from `PortalKind` */
    kind,
    context,
    referer,
  }
}

export const usePortalStore = defineStore('global.portal', composePortalStore)

export type PortalStore = ReturnType<typeof usePortalStore>
