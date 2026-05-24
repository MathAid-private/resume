import { computed, ref } from "vue"

import { defineStore } from "pinia"

import type { BackendKind, CanonicalKey, StorageEnvelope, TransactionStrength } from "../../storage.types"
import type { MemoryTransaction } from "./transaction"

function composeStore() {
  const kind                                     = computed<BackendKind>(() => 'memory')
  const transactionStrength                      = computed<TransactionStrength>(() => 'best-effort')
  const priority                                 = computed(() => 3)

  const _store        = ref(new Map<CanonicalKey, StorageEnvelope<unknown>>())
  const _initialized  = ref(false)

  /** Active transactions indexed by id. */
  const _transactions = ref(new Map<string, MemoryTransaction<unknown>>())

  /** Read-access counter for LFU eviction. */
  const _readCount    = ref(new Map<CanonicalKey, number>())

  return {
    kind,
    transactionStrength,
    priority,
    _store,
    _initialized,

    /** Active transactions indexed by id. */
    _transactions,
    /** Read-access counter for LFU eviction. */
    _readCount
  }
}

export const useMemoryStore = defineStore('storage.memory', composeStore)
export type MemoryStore = ReturnType<typeof useMemoryStore>;
