import { reactive, ref, shallowReactive } from "vue";

import { defineStore } from "pinia";

import type { FunctionLike } from "@/modules";
import type { ITabCountStrategy, ITabCountResponseData } from "./tab.types";

export function composeTabStore<M extends object = Record<string, unknown>>() {
  const count = ref(0)
  const strategy = ref<ITabCountStrategy>()
  const metadata = reactive<M>({} as M)
  const countCallbacks = shallowReactive<Record<string, FunctionLike<[ITabCountResponseData | unknown], void>>>({})

  return {
    count, countCallbacks, strategy, metadata
  }
}
export const useTabStore = defineStore('global.tab', composeTabStore)
