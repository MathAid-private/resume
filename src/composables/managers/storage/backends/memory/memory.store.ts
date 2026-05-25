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
    /**
     * Read-access counter for LFU eviction.
     *
     * It is the access frequency counter for **LFU (Least Frequently Used)** eviction.
     * Every successful `read()` call increments `_readCount[key]`. When `evict()` is
     * called with `policy: 'lfu'`, the tie-breaking comparator sorts by ascending read
     * count — entries read fewest times are evicted first. It resets to zero on overwrite
     * (a rewritten entry is treated as new). It is in-memory only and resets on page
     * reload, which means LFU is a within-session heuristic. Both backends track it for
     * the same reason; Memory just happens to be the only backend where LFU is cheap and
     * reliable since all reads are guaranteed to go through the same process.
     */
    _readCount
  }
}

export const useMemoryStore = defineStore('storage.memory', composeStore)
export type MemoryStore = ReturnType<typeof useMemoryStore>;
