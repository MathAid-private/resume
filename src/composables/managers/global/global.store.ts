import { reactive, ref } from "vue";

import { defineStore } from "pinia";

import { PlatformManagerExecutionState } from "../manager.dto";

import type { IPlatformManagerError } from "../manager.dto";
import type { ISupport } from "./global.types";

function composeGlobalStore() {
  // Default
  const errors = reactive<IPlatformManagerError[]>([])
  const weight = 2048 as const;
  const state = ref<PlatformManagerExecutionState>(PlatformManagerExecutionState.INIT)

  const support = reactive<ISupport>({})

  return {
    errors,
    weight,
    state,

    support
  }
}
export const useGlobalStore = defineStore('global', composeGlobalStore)
export type GlobalStore = ReturnType<typeof useGlobalStore>;
