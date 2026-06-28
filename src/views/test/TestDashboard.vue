<!-- eslint-disable @typescript-eslint/no-explicit-any -->
<script lang="ts" setup>
import { computed, ref, shallowRef, watch } from 'vue'

// ── Storage backends ────────────────────────────────────────────────────────
import { MemoryBackend } from '@/composables/managers/storage/backends/memory/memory'
import { OPFSBackend } from '@/composables/managers/storage/backends/opfs/opfs'
import type {
  CanonicalKey,
  EvictionPolicy,
  ITransaction,
  Platform,
  QuotaEstimate,
  StorageEnvelope,
  StorageQuery,
} from '@/composables/managers/storage/storage.types'
import { buildCanonicalKey } from '@/composables/managers/storage/storage.util'

// ── Tab count ───────────────────────────────────────────────────────────────
import { useGlobalStore } from '@/composables/managers/global/global.store'
import { useTabStore } from '@/composables/managers/global/tab/tab-store'

// ── Sub-components ──────────────────────────────────────────────────────────
import LogPane from './LogPane.vue'
import MetricCard from './MetricCard.vue'
import ValueEditor from './ValueEditor.vue'

// ════════════════════════════════════════════════════════════════════════════
// Active section
// ════════════════════════════════════════════════════════════════════════════
type Section = 'memory' | 'opfs' | 'tabs'
const activeSection = ref<Section>('memory')

// ════════════════════════════════════════════════════════════════════════════
// SHARED: canonical key form helpers
// ════════════════════════════════════════════════════════════════════════════
const PLATFORMS: Platform[] = [
  'android','ios','win','unix','mac','safari','chrome','edge','firefox','opera','browser','iot'
]

// ════════════════════════════════════════════════════════════════════════════
// MEMORY BACKEND
// ════════════════════════════════════════════════════════════════════════════
const memBackend    = shallowRef<MemoryBackend | null>(null)
const memReady      = ref(false)
const memBusy       = ref(false)
const memLog        = ref<InstanceType<typeof LogPane> | null>(null)
const memQuota      = ref<QuotaEstimate | null>(null)
const memCount      = ref(0)
const memTxId       = ref<string | null>(null)
const memTxSettled  = ref(true)

// Write form
const memKeyDomain   = ref('testapp')
const memKeyPlat     = ref<Platform>('browser')
const memKeyVersion  = ref(1)
const memKeyModule   = ref('dashboard')
const memKeyActual   = ref('')
const memValueEditor = ref<InstanceType<typeof ValueEditor> | null>(null)
const memWeight      = ref(1)
const memTtl         = ref<number | null>(null)
const memSchemaVer   = ref(1)

// Read/delete form
const memReadKey   = ref('')
const memDeleteKey = ref('')

// Query form
const memQPrefix      = ref('')
const memQLimit       = ref(20)
const memQOffset      = ref(0)
const memQExcludeExp  = ref(true)
const memQueryResults = ref<Array<{ key: CanonicalKey; envelope: StorageEnvelope<unknown> }>>([])

// Eviction form
const memEvictTarget  = ref(1024)
const memEvictPolicy  = ref<EvictionPolicy>('lru')

function memCanonical(): CanonicalKey | null {
  if (!memKeyActual.value.trim()) return null
  try {
    return buildCanonicalKey({
      domain: memKeyDomain.value, platform: memKeyPlat.value,
      platformVersion: memKeyVersion.value, callingModule: memKeyModule.value,
      actualKey: memKeyActual.value,
    })
  } catch { return null }
}

async function memInit() {
  memBusy.value = true
  try {
    if (!memBackend.value) memBackend.value = new MemoryBackend()
    const probe = await memBackend.value.probe()
    memLog.value?.push({ level: 'info', op: 'probe', message: `latency ${probe.latency?.toFixed(2)}ms`, data: probe })
    await memBackend.value.initialize()
    memReady.value = true
    memLog.value?.push({ level: 'ok', op: 'initialize', message: 'memory backend ready' })
    await memRefreshMetrics()
  } catch(e) {
    memLog.value?.push({ level: 'error', op: 'initialize', message: String(e) })
  } finally { memBusy.value = false }
}

async function memRefreshMetrics() {
  if (!memBackend.value || !memReady.value) return
  try {
    const [q, c] = await Promise.all([memBackend.value.estimateQuota(), memBackend.value.count()])
    memQuota.value = q; memCount.value = c
  } catch { /**/ }
}

async function memClose() {
  if (!memBackend.value) return
  await memBackend.value.close()
  memReady.value = false; memCount.value = 0; memQuota.value = null
  memTxId.value = null; memTxSettled.value = true
  memLog.value?.push({ level: 'warn', op: 'close', message: 'memory backend closed — all data lost' })
}

async function memWrite() {
  const key = memCanonical()
  if (!key) return memLog.value?.push({ level: 'warn', op: 'write', message: 'invalid canonical key' })
  const parsed = memValueEditor.value?.parsed
  if (!parsed || (parsed.value as any).error) return
  memBusy.value = true
  const start = performance.now()
  try {
    const envelope: StorageEnvelope<unknown> = {
      payload:        (parsed.value as any).value,
      schema_version: memSchemaVer.value,
      written_at:     Date.now(),
      expires_at:     memTtl.value ? Date.now() + memTtl.value * 1000 : null,
      weight:         memWeight.value,
      backend:        'memory',
    }
    await memBackend.value!.write(key, envelope, memTxId.value ? { transactionId: memTxId.value } : undefined)
    const ms = (performance.now() - start).toFixed(2)
    memLog.value?.push({ level: 'ok', op: 'write', message: `${ms}ms${memTxId.value ? ' [tx buffered]' : ''}`, data: { key, envelope } })
    await memRefreshMetrics()
  } catch(e) {
    memLog.value?.push({ level: 'error', op: 'write', message: String(e) })
  } finally { memBusy.value = false }
}

async function memRead() {
  if (!memReadKey.value.trim()) return
  memBusy.value = true
  const start = performance.now()
  try {
    const result = await memBackend.value!.read(memReadKey.value as CanonicalKey)
    const ms = (performance.now() - start).toFixed(2)
    if (result === null) {
      memLog.value?.push({ level: 'warn', op: 'read', message: `${ms}ms — key not found or expired`, data: { key: memReadKey.value } })
    } else {
      memLog.value?.push({ level: 'ok', op: 'read', message: `${ms}ms`, data: result })
    }
  } catch(e) {
    memLog.value?.push({ level: 'error', op: 'read', message: String(e) })
  } finally { memBusy.value = false }
}

async function memDelete() {
  if (!memDeleteKey.value.trim()) return
  memBusy.value = true
  const start = performance.now()
  try {
    await memBackend.value!.delete(memDeleteKey.value as CanonicalKey, memTxId.value ? { transactionId: memTxId.value } : undefined)
    const ms = (performance.now() - start).toFixed(2)
    memLog.value?.push({ level: 'ok', op: 'delete', message: `${ms}ms${memTxId.value ? ' [tx buffered]' : ''}`, data: { key: memDeleteKey.value } })
    await memRefreshMetrics()
  } catch(e) {
    memLog.value?.push({ level: 'error', op: 'delete', message: String(e) })
  } finally { memBusy.value = false }
}

async function memClear(prefix?: string) {
  memBusy.value = true
  try {
    await memBackend.value!.clear(prefix || undefined)
    memLog.value?.push({ level: 'ok', op: 'clear', message: prefix ? `prefix "${prefix}"` : 'entire store' })
    await memRefreshMetrics()
  } catch(e) {
    memLog.value?.push({ level: 'error', op: 'clear', message: String(e) })
  } finally { memBusy.value = false }
}

async function memQuery() {
  memBusy.value = true
  const start = performance.now()
  try {
    const q: StorageQuery = {
      prefix:         memQPrefix.value || undefined,
      excludeExpired: memQExcludeExp.value,
      limit:          memQLimit.value,
      offset:         memQOffset.value,
    }
    const results = await memBackend.value!.query(q)
    const ms = (performance.now() - start).toFixed(2)
    memQueryResults.value = results
    memLog.value?.push({ level: 'ok', op: 'query', message: `${ms}ms — ${results.length} result(s)`, data: q })
  } catch(e) {
    memLog.value?.push({ level: 'error', op: 'query', message: String(e) })
  } finally { memBusy.value = false }
}

async function memEvict() {
  memBusy.value = true
  const start = performance.now()
  try {
    const freed = await memBackend.value!.evict(memEvictTarget.value, memEvictPolicy.value)
    const ms = (performance.now() - start).toFixed(2)
    memLog.value?.push({ level: 'ok', op: 'evict', message: `${ms}ms — freed ${freed} entries`, data: { targetBytes: memEvictTarget.value, policy: memEvictPolicy.value } })
    await memRefreshMetrics()
  } catch(e) {
    memLog.value?.push({ level: 'error', op: 'evict', message: String(e) })
  } finally { memBusy.value = false }
}

// Transactions
async function memBeginTx() {
  memBusy.value = true
  try {
    const tx = await memBackend.value!.beginTransaction('best-effort')
    memTxId.value = tx.id
    memTxSettled.value = false
    memLog.value?.push({ level: 'accent' as any, op: 'beginTx', message: `tx ${tx.id.slice(0,8)}… opened` })
    // stash tx ref for commit/rollback
    activeTx.value = tx
  } catch(e) {
    memLog.value?.push({ level: 'error', op: 'beginTx', message: String(e) })
  } finally { memBusy.value = false }
}

async function memCommitTx() {
  if (!activeTx.value) return
  memBusy.value = true
  try {
    await activeTx.value.commit()
    memLog.value?.push({ level: 'ok', op: 'commitTx', message: `tx ${memTxId.value?.slice(0,8)}… committed` })
    memTxId.value = null; memTxSettled.value = true; activeTx.value = null
    await memRefreshMetrics()
  } catch(e) {
    memLog.value?.push({ level: 'error', op: 'commitTx', message: String(e) })
  } finally { memBusy.value = false }
}

async function memRollbackTx() {
  if (!activeTx.value) return
  memBusy.value = true
  try {
    await activeTx.value.rollback()
    memLog.value?.push({ level: 'warn', op: 'rollbackTx', message: `tx ${memTxId.value?.slice(0,8)}… rolled back` })
    memTxId.value = null; memTxSettled.value = true; activeTx.value = null
  } catch(e) {
    memLog.value?.push({ level: 'error', op: 'rollbackTx', message: String(e) })
  } finally { memBusy.value = false }
}

const activeTx = shallowRef<ITransaction | null>(null)

// ════════════════════════════════════════════════════════════════════════════
// OPFS BACKEND
// ════════════════════════════════════════════════════════════════════════════
const opfsBackend   = shallowRef<OPFSBackend | null>(null)
const opfsReady     = ref(false)
const opfsBusy      = ref(false)
const opfsLog       = ref<InstanceType<typeof LogPane> | null>(null)
const opfsQuota     = ref<QuotaEstimate | null>(null)
const opfsCount     = ref(0)
const opfsRootDir   = ref('storage')
const opfsTxId      = ref<string | null>(null)
const opfsActiveTx  = shallowRef<ITransaction | null>(null)

// Write form
const opfsKeyDomain   = ref('testapp')
const opfsKeyPlat     = ref<Platform>('browser')
const opfsKeyVersion  = ref(1)
const opfsKeyModule   = ref('dashboard')
const opfsKeyActual   = ref('')
const opfsValueEditor = ref<InstanceType<typeof ValueEditor> | null>(null)
const opfsWeight      = ref(1)
const opfsTtl         = ref<number | null>(null)
const opfsSchemaVer   = ref(1)

// Read/delete
const opfsReadKey   = ref('')
const opfsDeleteKey = ref('')

// Query
const opfsQPrefix      = ref('')
const opfsQLimit       = ref(20)
const opfsQOffset      = ref(0)
const opfsQExcExp      = ref(true)
const opfsQueryResults = ref<Array<{ key: CanonicalKey; envelope: StorageEnvelope<string> }>>([])

// Evict
const opfsEvictTarget = ref(1024)
const opfsEvictPolicy = ref<EvictionPolicy>('lru')

function opfsCanonical(): CanonicalKey | null {
  if (!opfsKeyActual.value.trim()) return null
  try {
    return buildCanonicalKey({
      domain: opfsKeyDomain.value, platform: opfsKeyPlat.value,
      platformVersion: opfsKeyVersion.value, callingModule: opfsKeyModule.value,
      actualKey: opfsKeyActual.value,
    })
  } catch { return null }
}

async function opfsInit() {
  opfsBusy.value = true
  try {
    if (!opfsBackend.value) opfsBackend.value = new OPFSBackend({ rootDirName: opfsRootDir.value })
    const probe = await opfsBackend.value.probe()
    opfsLog.value?.push({ level: probe.available ? 'ok' : 'error', op: 'probe', message: probe.available ? `latency ${probe.latency?.toFixed(2)}ms` : (probe.reason ?? 'unavailable'), data: probe })
    if (!probe.available) return
    await opfsBackend.value.initialize()
    opfsReady.value = true
    opfsLog.value?.push({ level: 'ok', op: 'initialize', message: `OPFS backend ready (root: ${opfsRootDir.value})` })
    await opfsRefreshMetrics()
  } catch(e) {
    opfsLog.value?.push({ level: 'error', op: 'initialize', message: String(e) })
  } finally { opfsBusy.value = false }
}

async function opfsRefreshMetrics() {
  if (!opfsBackend.value || !opfsReady.value) return
  try {
    const [q, c] = await Promise.all([opfsBackend.value.estimateQuota(), opfsBackend.value.count()])
    opfsQuota.value = q; opfsCount.value = c
  } catch { /**/ }
}

async function opfsClose() {
  if (!opfsBackend.value) return
  await opfsBackend.value.close()
  opfsReady.value = false; opfsCount.value = 0; opfsQuota.value = null
  opfsTxId.value = null; opfsActiveTx.value = null
  opfsLog.value?.push({ level: 'warn', op: 'close', message: 'OPFS backend closed (data persists on disk)' })
}

async function opfsWrite() {
  const key = opfsCanonical()
  if (!key) return opfsLog.value?.push({ level: 'warn', op: 'write', message: 'invalid canonical key' })
  const parsed = opfsValueEditor.value?.parsed
  if (!parsed) return
  opfsBusy.value = true
  const start = performance.now()
  try {
    // OPFS backend takes string payloads — serialize here (simulating what pipeline would do)
    let payload: string
    if ((parsed.value as any).isFile && (parsed.value as any).file) {
      payload = await readFileAsDataURL((parsed.value as any).file)
    } else {
      payload = typeof (parsed.value as any).value === 'string'
        ? (parsed.value as any).value
        : JSON.stringify((parsed.value as any).value)
    }
    const envelope: StorageEnvelope<string> = {
      payload,
      schema_version: opfsSchemaVer.value,
      written_at:     Date.now(),
      expires_at:     opfsTtl.value ? Date.now() + opfsTtl.value * 1000 : null,
      weight:         opfsWeight.value,
      backend:        'opfs',
    }
    await opfsBackend.value!.write(key, envelope, opfsTxId.value ? { transactionId: opfsTxId.value } : undefined)
    const ms = (performance.now() - start).toFixed(2)
    opfsLog.value?.push({ level: 'ok', op: 'write', message: `${ms}ms${opfsTxId.value ? ' [tx buffered]' : ''} · ${payload.length} chars`, data: { key, byteLen: new TextEncoder().encode(payload).byteLength } })
    await opfsRefreshMetrics()
  } catch(e) {
    opfsLog.value?.push({ level: 'error', op: 'write', message: String(e) })
  } finally { opfsBusy.value = false }
}

function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload  = () => resolve(r.result as string)
    r.onerror = () => reject(r.error)
    r.readAsDataURL(file)
  })
}

async function opfsRead() {
  if (!opfsReadKey.value.trim()) return
  opfsBusy.value = true
  const start = performance.now()
  try {
    const result = await opfsBackend.value!.read(opfsReadKey.value as CanonicalKey)
    const ms = (performance.now() - start).toFixed(2)
    if (result === null) {
      opfsLog.value?.push({ level: 'warn', op: 'read', message: `${ms}ms — key not found or expired` })
    } else {
      // Try to detect if it's a dataURL (file) for preview
      const isDataUrl = result.payload.startsWith('data:')
      opfsLog.value?.push({ level: 'ok', op: 'read', message: `${ms}ms · ${result.payload.length} chars${isDataUrl ? ' (file/dataURL)' : ''}`, data: { ...result, payload: result.payload.slice(0, 300) + (result.payload.length > 300 ? '…' : '') } })
    }
  } catch(e) {
    opfsLog.value?.push({ level: 'error', op: 'read', message: String(e) })
  } finally { opfsBusy.value = false }
}

async function opfsDelete() {
  if (!opfsDeleteKey.value.trim()) return
  opfsBusy.value = true
  const start = performance.now()
  try {
    await opfsBackend.value!.delete(opfsDeleteKey.value as CanonicalKey, opfsTxId.value ? { transactionId: opfsTxId.value } : undefined)
    const ms = (performance.now() - start).toFixed(2)
    opfsLog.value?.push({ level: 'ok', op: 'delete', message: `${ms}ms${opfsTxId.value ? ' [tx buffered]' : ''}` })
    await opfsRefreshMetrics()
  } catch(e) {
    opfsLog.value?.push({ level: 'error', op: 'delete', message: String(e) })
  } finally { opfsBusy.value = false }
}

async function opfsClear(prefix?: string) {
  opfsBusy.value = true
  try {
    await opfsBackend.value!.clear(prefix || undefined)
    opfsLog.value?.push({ level: 'ok', op: 'clear', message: prefix ? `prefix "${prefix}"` : 'entire store' })
    await opfsRefreshMetrics()
  } catch(e) {
    opfsLog.value?.push({ level: 'error', op: 'clear', message: String(e) })
  } finally { opfsBusy.value = false }
}

async function opfsQuery() {
  opfsBusy.value = true
  const start = performance.now()
  try {
    const q: StorageQuery = {
      prefix: opfsQPrefix.value || undefined,
      excludeExpired: opfsQExcExp.value,
      limit: opfsQLimit.value,
      offset: opfsQOffset.value,
    }
    const results = await opfsBackend.value!.query(q)
    const ms = (performance.now() - start).toFixed(2)
    opfsQueryResults.value = results
    opfsLog.value?.push({ level: 'ok', op: 'query', message: `${ms}ms — ${results.length} result(s)`, data: q })
  } catch(e) {
    opfsLog.value?.push({ level: 'error', op: 'query', message: String(e) })
  } finally { opfsBusy.value = false }
}

async function opfsEvict() {
  opfsBusy.value = true
  const start = performance.now()
  try {
    const freed = await opfsBackend.value!.evict(opfsEvictTarget.value, opfsEvictPolicy.value)
    const ms = (performance.now() - start).toFixed(2)
    opfsLog.value?.push({ level: 'ok', op: 'evict', message: `${ms}ms — freed ${freed} bytes approx`, data: { targetBytes: opfsEvictTarget.value, policy: opfsEvictPolicy.value } })
    await opfsRefreshMetrics()
  } catch(e) {
    opfsLog.value?.push({ level: 'error', op: 'evict', message: String(e) })
  } finally { opfsBusy.value = false }
}

async function opfsBeginTx() {
  opfsBusy.value = true
  try {
    const tx = await opfsBackend.value!.beginTransaction('compensating')
    opfsTxId.value = tx.id
    opfsActiveTx.value = tx
    opfsLog.value?.push({ level: 'info', op: 'beginTx', message: `compensating tx ${tx.id.slice(0,8)}… opened` })
  } catch(e) {
    opfsLog.value?.push({ level: 'error', op: 'beginTx', message: String(e) })
  } finally { opfsBusy.value = false }
}

async function opfsCommitTx() {
  if (!opfsActiveTx.value) return
  opfsBusy.value = true
  try {
    await opfsActiveTx.value.commit()
    opfsLog.value?.push({ level: 'ok', op: 'commitTx', message: `tx ${opfsTxId.value?.slice(0,8)}… committed — WAL cleared` })
    opfsTxId.value = null; opfsActiveTx.value = null
    await opfsRefreshMetrics()
  } catch(e) {
    opfsLog.value?.push({ level: 'error', op: 'commitTx', message: String(e) })
  } finally { opfsBusy.value = false }
}

async function opfsRollbackTx() {
  if (!opfsActiveTx.value) return
  opfsBusy.value = true
  try {
    await opfsActiveTx.value.rollback()
    opfsLog.value?.push({ level: 'warn', op: 'rollbackTx', message: `tx ${opfsTxId.value?.slice(0,8)}… rolled back — no files written` })
    opfsTxId.value = null; opfsActiveTx.value = null
  } catch(e) {
    opfsLog.value?.push({ level: 'error', op: 'rollbackTx', message: String(e) })
  } finally { opfsBusy.value = false }
}

// ════════════════════════════════════════════════════════════════════════════
// TAB COUNT
// ════════════════════════════════════════════════════════════════════════════
const tabStore   = useTabStore()
const globalStore = useGlobalStore()
const tabLog     = ref<InstanceType<typeof LogPane> | null>(null)

const tabCount       = computed(() => tabStore.count)
const tabStrategy    = computed(() => {
  const s = globalStore.support
  if (s.workers?.shared?.native)              return 'SharedWorker'
  if (s.notification?.broadcastChannel?.native) return 'BroadcastChannel'
  return 'localStorage'
})
// const tabCapabilities = computed(() => globalStore.support)

// function logTabEvent(msg: string) {
//   tabLog.value?.push({ level: 'info', op: 'count', message: msg, data: { count: tabStore.count } })
// }

// Watch the count and log changes
watch(tabCount, (n, o) => {
  if (o !== undefined) {
    tabLog.value?.push({
      level: n > o ? 'ok' : 'warn',
      op: n > o ? 'tab opened' : 'tab closed',
      message: `count: ${o} → ${n}`,
      data: { strategy: tabStrategy.value }
    })
  }
}, { immediate: false })

// Formatted support table
const supportRows = computed(() => [
  { label: 'SharedWorker',     val: globalStore.support.workers?.shared?.native  ?? false },
  { label: 'WebWorker',        val: globalStore.support.workers?.web?.native      ?? false },
  { label: 'ServiceWorker',    val: globalStore.support.workers?.service?.native  ?? false },
  { label: 'BroadcastChannel', val: globalStore.support.notification?.broadcastChannel?.native ?? false },
])

const userAgent = computed(() => globalStore.support.userAgent)

// ════════════════════════════════════════════════════════════════════════════
// Stress tests
// ════════════════════════════════════════════════════════════════════════════
const stressN       = ref(100)
const stressBusy    = ref(false)

async function runMemStress() {
  if (!memBackend.value || !memReady.value || stressBusy.value) return
  stressBusy.value = true
  const n = stressN.value
  memLog.value?.push({ level: 'info', op: 'stress', message: `writing ${n} entries…` })
  const t0 = performance.now()
  try {
    for (let i = 0; i < n; i++) {
      const key = buildCanonicalKey({ domain: 'stress', platform: 'browser', platformVersion: 1, callingModule: 'test', actualKey: `item-${i}` })
      await memBackend.value!.write(key, {
        payload: { i, r: Math.random(), s: 'x'.repeat(64) },
        schema_version: 1, written_at: Date.now(), expires_at: null, weight: 1, backend: 'memory'
      })
    }
    const ms = (performance.now() - t0).toFixed(1)
    memLog.value?.push({ level: 'ok', op: 'stress', message: `${n} writes in ${ms}ms (${(n / (Number(ms)/1000)).toFixed(0)} ops/s)` })
    await memRefreshMetrics()
  } catch(e) {
    memLog.value?.push({ level: 'error', op: 'stress', message: String(e) })
  } finally { stressBusy.value = false }
}

async function runOpfsStress() {
  if (!opfsBackend.value || !opfsReady.value || stressBusy.value) return
  stressBusy.value = true
  const n = stressN.value
  opfsLog.value?.push({ level: 'info', op: 'stress', message: `writing ${n} entries to OPFS…` })
  const t0 = performance.now()
  try {
    for (let i = 0; i < n; i++) {
      const key = buildCanonicalKey({ domain: 'stress', platform: 'browser', platformVersion: 1, callingModule: 'test', actualKey: `item-${i}` })
      await opfsBackend.value!.write(key, {
        payload: JSON.stringify({ i, r: Math.random(), s: 'x'.repeat(64) }),
        schema_version: 1, written_at: Date.now(), expires_at: null, weight: 1, backend: 'opfs'
      })
    }
    const ms = (performance.now() - t0).toFixed(1)
    opfsLog.value?.push({ level: 'ok', op: 'stress', message: `${n} writes in ${ms}ms (${(n / (Number(ms)/1000)).toFixed(0)} ops/s)` })
    await opfsRefreshMetrics()
  } catch(e) {
    opfsLog.value?.push({ level: 'error', op: 'stress', message: String(e) })
  } finally { stressBusy.value = false }
}

// ════════════════════════════════════════════════════════════════════════════
// Helpers
// ════════════════════════════════════════════════════════════════════════════
function fmtBytes(b: number) {
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b/1024).toFixed(1)} KB`
  return `${(b/(1024*1024)).toFixed(2)} MB`
}

const EVICTION_POLICIES: EvictionPolicy[] = ['lru','fifo','lfu','user']
</script>

<template>
  <div class="devtool-root">

    <!-- ── Header ──────────────────────────────────────────────────────── -->
    <header class="dv-header">
      <div class="dv-logo">
        <span class="dv-logo-mark">⬡</span>
        <span class="dv-logo-text">Storage<em>Lab</em></span>
      </div>
      <nav class="dv-nav">
        <button
          v-for="s in (['memory','opfs','tabs'] as Section[])"
          :key="s"
          :class="['nav-btn', { active: activeSection === s }]"
          @click="activeSection = s"
        >{{ s }}</button>
      </nav>
      <div class="dv-header-right">
        <span class="header-badge">no facade · no pipeline · raw backend</span>
      </div>
    </header>

    <!-- ══════════════════════════════════════════════════════════════════
         MEMORY SECTION
    ══════════════════════════════════════════════════════════════════ -->
    <section v-show="activeSection === 'memory'" class="dv-section">

      <!-- Metrics row -->
      <div class="metrics-row">
        <MetricCard label="status"   :value="memReady ? 'READY' : 'OFFLINE'" :variant="memReady ? 'ok' : 'danger'" />
        <MetricCard label="entries"  :value="memCount" variant="accent" />
        <MetricCard label="used"     :value="memQuota ? fmtBytes(memQuota.used) : '—'" />
        <MetricCard label="available" :value="memQuota ? fmtBytes(memQuota.available) : '—'" />
        <MetricCard label="ratio"    :value="memQuota ? (memQuota.ratio * 100).toFixed(1) : '—'" unit="%" :variant="memQuota && memQuota.ratio > 0.8 ? 'warn' : 'default'" />
        <MetricCard v-if="memTxId" label="tx active" :value="memTxId.slice(0,8) + '…'" variant="warn" />
      </div>

      <div class="section-body">

        <!-- Left panel: controls -->
        <div class="controls-panel">

          <!-- Init / Close -->
          <div class="ctrl-group">
            <div class="ctrl-group-title">lifecycle</div>
            <div class="btn-row">
              <button class="btn btn-ok" :disabled="memReady || memBusy" @click="memInit">initialize</button>
              <button class="btn btn-danger" :disabled="!memReady || memBusy" @click="memClose">close</button>
              <button class="btn" :disabled="!memReady || memBusy" @click="memRefreshMetrics">refresh</button>
            </div>
          </div>

          <!-- Transaction -->
          <div class="ctrl-group" v-if="memReady">
            <div class="ctrl-group-title">transaction <span class="strength-badge">best-effort</span></div>
            <div class="btn-row">
              <button class="btn btn-warn" :disabled="!!memTxId || memBusy" @click="memBeginTx">begin</button>
              <button class="btn btn-ok"   :disabled="!memTxId || memBusy" @click="memCommitTx">commit</button>
              <button class="btn btn-danger" :disabled="!memTxId || memBusy" @click="memRollbackTx">rollback</button>
            </div>
            <div v-if="memTxId" class="tx-indicator">
              tx {{ memTxId.slice(0,16) }}… — ops below are buffered until commit
            </div>
          </div>

          <!-- Write -->
          <div class="ctrl-group" v-if="memReady">
            <div class="ctrl-group-title">write</div>
            <div class="key-mini-form">
              <div class="mini-row"><span class="mini-label">domain</span><input v-model="memKeyDomain" /></div>
              <div class="mini-row"><span class="mini-label">platform</span>
                <select v-model="memKeyPlat">
                  <option v-for="p in PLATFORMS" :key="p" :value="p">{{ p }}</option>
                </select>
              </div>
              <div class="mini-row"><span class="mini-label">version</span><input v-model.number="memKeyVersion" type="number" min="0" /></div>
              <div class="mini-row"><span class="mini-label">module</span><input v-model="memKeyModule" /></div>
              <div class="mini-row"><span class="mini-label">key *</span><input v-model="memKeyActual" placeholder="required" /></div>
            </div>
            <div class="mini-row">
              <span class="mini-label">weight</span><input v-model.number="memWeight" type="number" min="0" />
              <span class="mini-label" style="margin-left:8px">ttl (s)</span>
              <input v-model.number="memTtl" type="number" min="0" placeholder="∞" />
              <span class="mini-label" style="margin-left:8px">schema v</span>
              <input v-model.number="memSchemaVer" type="number" min="1" style="width:48px" />
            </div>
            <ValueEditor ref="memValueEditor" />
            <div class="canonical-tag" :class="{ valid: memCanonical() }">
              {{ memCanonical() || '(incomplete key)' }}
            </div>
            <button class="btn btn-ok full-width" :disabled="!memKeyActual || memBusy" @click="memWrite">
              write{{ memTxId ? ' (buffered)' : '' }}
            </button>
          </div>

          <!-- Read -->
          <div class="ctrl-group" v-if="memReady">
            <div class="ctrl-group-title">read</div>
            <input v-model="memReadKey" class="full-input" placeholder="paste full canonical key" />
            <button class="btn btn-accent full-width" :disabled="!memReadKey || memBusy" @click="memRead">read</button>
          </div>

          <!-- Delete -->
          <div class="ctrl-group" v-if="memReady">
            <div class="ctrl-group-title">delete</div>
            <input v-model="memDeleteKey" class="full-input" placeholder="paste full canonical key" />
            <button class="btn btn-danger full-width" :disabled="!memDeleteKey || memBusy" @click="memDelete">delete{{ memTxId ? ' (buffered)' : '' }}</button>
          </div>

          <!-- Clear -->
          <div class="ctrl-group" v-if="memReady">
            <div class="ctrl-group-title">clear</div>
            <div class="btn-row">
              <button class="btn btn-danger" @click="memClear()">clear all</button>
              <button class="btn" @click="memClear('stress:')">clear stress:*</button>
            </div>
          </div>

          <!-- Evict -->
          <div class="ctrl-group" v-if="memReady">
            <div class="ctrl-group-title">evict</div>
            <div class="mini-row">
              <span class="mini-label">target bytes</span>
              <input v-model.number="memEvictTarget" type="number" min="1" style="width:80px" />
              <span class="mini-label" style="margin-left:8px">policy</span>
              <select v-model="memEvictPolicy">
                <option v-for="p in EVICTION_POLICIES" :key="p" :value="p">{{ p }}</option>
              </select>
            </div>
            <button class="btn full-width" @click="memEvict" :disabled="memBusy">evict</button>
          </div>

          <!-- Stress -->
          <div class="ctrl-group" v-if="memReady">
            <div class="ctrl-group-title">stress test</div>
            <div class="mini-row">
              <span class="mini-label">n entries</span>
              <input v-model.number="stressN" type="number" min="1" max="10000" style="width:80px" />
            </div>
            <button class="btn btn-warn full-width" :disabled="stressBusy" @click="runMemStress">
              {{ stressBusy ? 'running…' : `write ${stressN} entries` }}
            </button>
          </div>

        </div>

        <!-- Right panel: log + query results -->
        <div class="right-panel">
          <div class="query-panel" v-if="memReady">
            <div class="ctrl-group-title">query</div>
            <div class="query-form">
              <input v-model="memQPrefix"    placeholder="key prefix" class="flex-1" />
              <input v-model.number="memQLimit"  type="number" placeholder="limit" style="width:60px" />
              <input v-model.number="memQOffset" type="number" placeholder="offset" style="width:60px" />
              <label class="check-label">
                <input type="checkbox" v-model="memQExcludeExp" />
                excl. expired
              </label>
              <button class="btn btn-accent" @click="memQuery" :disabled="memBusy">query</button>
            </div>
            <div class="results-list" v-if="memQueryResults.length">
              <div class="results-header">{{ memQueryResults.length }} result(s)</div>
              <div v-for="r in memQueryResults" :key="r.key" class="result-row">
                <div class="result-key" @click="memReadKey = r.key; memDeleteKey = r.key">{{ r.key }}</div>
                <div class="result-meta">
                  schema v{{ r.envelope.schema_version }} ·
                  weight {{ r.envelope.weight }} ·
                  {{ r.envelope.expires_at ? `exp ${new Date(r.envelope.expires_at).toLocaleTimeString()}` : 'no ttl' }}
                </div>
                <pre class="result-payload">{{ JSON.stringify(r.envelope.payload).slice(0,200) }}</pre>
              </div>
            </div>
          </div>
          <LogPane ref="memLog" class="log-panel" />
        </div>

      </div>
    </section>

    <!-- ══════════════════════════════════════════════════════════════════
         OPFS SECTION
    ══════════════════════════════════════════════════════════════════ -->
    <section v-show="activeSection === 'opfs'" class="dv-section">

      <div class="metrics-row">
        <MetricCard label="status"    :value="opfsReady ? 'READY' : 'OFFLINE'" :variant="opfsReady ? 'ok' : 'danger'" />
        <MetricCard label="entries"   :value="opfsCount" variant="accent" />
        <MetricCard label="used"      :value="opfsQuota ? fmtBytes(opfsQuota.used) : '—'" />
        <MetricCard label="available" :value="opfsQuota ? fmtBytes(opfsQuota.available) : '—'" />
        <MetricCard label="ratio"     :value="opfsQuota ? (opfsQuota.ratio * 100).toFixed(1) : '—'" unit="%" :variant="opfsQuota && opfsQuota.ratio > 0.8 ? 'warn' : 'default'" />
        <MetricCard v-if="opfsTxId"  label="tx active" :value="opfsTxId.slice(0,8) + '…'" variant="warn" />
      </div>

      <div class="section-body">
        <div class="controls-panel">

          <!-- Init -->
          <div class="ctrl-group">
            <div class="ctrl-group-title">lifecycle</div>
            <div class="mini-row">
              <span class="mini-label">root dir</span>
              <input v-model="opfsRootDir" :disabled="opfsReady" placeholder="storage" />
            </div>
            <div class="btn-row">
              <button class="btn btn-ok" :disabled="opfsReady || opfsBusy" @click="opfsInit">initialize</button>
              <button class="btn btn-danger" :disabled="!opfsReady || opfsBusy" @click="opfsClose">close</button>
              <button class="btn" :disabled="!opfsReady || opfsBusy" @click="opfsRefreshMetrics">refresh</button>
            </div>
          </div>

          <!-- Transaction -->
          <div class="ctrl-group" v-if="opfsReady">
            <div class="ctrl-group-title">transaction <span class="strength-badge compensating">compensating (WAL)</span></div>
            <div class="btn-row">
              <button class="btn btn-warn"   :disabled="!!opfsTxId || opfsBusy" @click="opfsBeginTx">begin</button>
              <button class="btn btn-ok"     :disabled="!opfsTxId || opfsBusy" @click="opfsCommitTx">commit</button>
              <button class="btn btn-danger" :disabled="!opfsTxId || opfsBusy" @click="opfsRollbackTx">rollback</button>
            </div>
            <div v-if="opfsTxId" class="tx-indicator">
              tx {{ opfsTxId.slice(0,16) }}… — ops below buffer in memory; WAL written on commit
            </div>
          </div>

          <!-- Write -->
          <div class="ctrl-group" v-if="opfsReady">
            <div class="ctrl-group-title">write <small class="note">(payload auto-serialized to string)</small></div>
            <div class="key-mini-form">
              <div class="mini-row"><span class="mini-label">domain</span><input v-model="opfsKeyDomain" /></div>
              <div class="mini-row"><span class="mini-label">platform</span>
                <select v-model="opfsKeyPlat">
                  <option v-for="p in PLATFORMS" :key="p" :value="p">{{ p }}</option>
                </select>
              </div>
              <div class="mini-row"><span class="mini-label">version</span><input v-model.number="opfsKeyVersion" type="number" min="0" /></div>
              <div class="mini-row"><span class="mini-label">module</span><input v-model="opfsKeyModule" /></div>
              <div class="mini-row"><span class="mini-label">key *</span><input v-model="opfsKeyActual" placeholder="required" /></div>
            </div>
            <div class="mini-row">
              <span class="mini-label">weight</span><input v-model.number="opfsWeight" type="number" min="0" />
              <span class="mini-label" style="margin-left:8px">ttl (s)</span>
              <input v-model.number="opfsTtl" type="number" min="0" placeholder="∞" />
              <span class="mini-label" style="margin-left:8px">schema v</span>
              <input v-model.number="opfsSchemaVer" type="number" min="1" style="width:48px" />
            </div>
            <ValueEditor ref="opfsValueEditor" />
            <div class="canonical-tag" :class="{ valid: opfsCanonical() }">
              {{ opfsCanonical() || '(incomplete key)' }}
            </div>
            <button class="btn btn-ok full-width" :disabled="!opfsKeyActual || opfsBusy" @click="opfsWrite">
              write{{ opfsTxId ? ' (buffered)' : '' }}
            </button>
          </div>

          <!-- Read -->
          <div class="ctrl-group" v-if="opfsReady">
            <div class="ctrl-group-title">read</div>
            <input v-model="opfsReadKey" class="full-input" placeholder="paste full canonical key" />
            <button class="btn btn-accent full-width" :disabled="!opfsReadKey || opfsBusy" @click="opfsRead">read</button>
          </div>

          <!-- Delete -->
          <div class="ctrl-group" v-if="opfsReady">
            <div class="ctrl-group-title">delete</div>
            <input v-model="opfsDeleteKey" class="full-input" placeholder="paste full canonical key" />
            <button class="btn btn-danger full-width" :disabled="!opfsDeleteKey || opfsBusy" @click="opfsDelete">delete{{ opfsTxId ? ' (buffered)' : '' }}</button>
          </div>

          <!-- Clear -->
          <div class="ctrl-group" v-if="opfsReady">
            <div class="ctrl-group-title">clear</div>
            <div class="btn-row">
              <button class="btn btn-danger" @click="opfsClear()">clear all</button>
              <button class="btn" @click="opfsClear('stress:')">clear stress:*</button>
            </div>
          </div>

          <!-- Evict -->
          <div class="ctrl-group" v-if="opfsReady">
            <div class="ctrl-group-title">evict</div>
            <div class="mini-row">
              <span class="mini-label">target bytes</span>
              <input v-model.number="opfsEvictTarget" type="number" min="1" style="width:80px" />
              <span class="mini-label" style="margin-left:8px">policy</span>
              <select v-model="opfsEvictPolicy">
                <option v-for="p in EVICTION_POLICIES" :key="p" :value="p">{{ p }}</option>
              </select>
            </div>
            <button class="btn full-width" @click="opfsEvict" :disabled="opfsBusy">evict</button>
          </div>

          <!-- Stress -->
          <div class="ctrl-group" v-if="opfsReady">
            <div class="ctrl-group-title">stress test</div>
            <div class="mini-row">
              <span class="mini-label">n entries</span>
              <input v-model.number="stressN" type="number" min="1" max="1000" style="width:80px" />
              <span class="mini-label" style="margin-left:8px; color: var(--warn);">⚠ OPFS is slower</span>
            </div>
            <button class="btn btn-warn full-width" :disabled="stressBusy" @click="runOpfsStress">
              {{ stressBusy ? 'running…' : `write ${stressN} entries` }}
            </button>
          </div>

        </div>

        <div class="right-panel">
          <div class="query-panel" v-if="opfsReady">
            <div class="ctrl-group-title">query</div>
            <div class="query-form">
              <input v-model="opfsQPrefix" placeholder="key prefix" class="flex-1" />
              <input v-model.number="opfsQLimit" type="number" placeholder="limit" style="width:60px" />
              <input v-model.number="opfsQOffset" type="number" placeholder="offset" style="width:60px" />
              <label class="check-label">
                <input type="checkbox" v-model="opfsQExcExp" />
                excl. expired
              </label>
              <button class="btn btn-accent" @click="opfsQuery" :disabled="opfsBusy">query</button>
            </div>
            <div class="results-list" v-if="opfsQueryResults.length">
              <div class="results-header">{{ opfsQueryResults.length }} result(s)</div>
              <div v-for="r in opfsQueryResults" :key="r.key" class="result-row">
                <div class="result-key" @click="opfsReadKey = r.key; opfsDeleteKey = r.key">{{ r.key }}</div>
                <div class="result-meta">
                  schema v{{ r.envelope.schema_version }} ·
                  weight {{ r.envelope.weight }} ·
                  {{ r.envelope.expires_at ? `exp ${new Date(r.envelope.expires_at).toLocaleTimeString()}` : 'no ttl' }}
                </div>
                <pre class="result-payload">{{ r.envelope.payload.slice(0,200) }}</pre>
              </div>
            </div>
          </div>
          <LogPane ref="opfsLog" class="log-panel" />
        </div>
      </div>
    </section>

    <!-- ══════════════════════════════════════════════════════════════════
         TABS SECTION
    ══════════════════════════════════════════════════════════════════ -->
    <section v-show="activeSection === 'tabs'" class="dv-section">

      <div class="metrics-row">
        <MetricCard label="open tabs" :value="tabCount" variant="accent" />
        <MetricCard label="strategy"  :value="tabStrategy" />
        <MetricCard label="browser"   :value="userAgent?.name ?? '—'" />
        <MetricCard label="engine"    :value="userAgent?.engine ?? '—'" />
        <MetricCard label="os"        :value="userAgent?.os ?? '—'" />
      </div>

      <div class="section-body">
        <div class="controls-panel">

          <div class="ctrl-group">
            <div class="ctrl-group-title">tab counter</div>
            <div class="tab-counter-display">
              <div class="tab-big-number">{{ tabCount }}</div>
              <div class="tab-big-label">tabs open</div>
            </div>
            <div class="tab-hint">
              Open this page in multiple browser tabs and watch the count update in real time.
              The counter uses <strong>{{ tabStrategy }}</strong>.
            </div>
          </div>

          <div class="ctrl-group">
            <div class="ctrl-group-title">strategy selection logic</div>
            <div class="strategy-chain">
              <div v-for="(row, i) in supportRows" :key="row.label" class="strategy-row">
                <span class="strategy-check" :class="row.val ? 'yes' : 'no'">{{ row.val ? '✓' : '✗' }}</span>
                <span class="strategy-name">{{ row.label }}</span>
                <span v-if="i === 0 && row.val" class="strategy-active">→ using SharedWorker</span>
                <span v-else-if="i === 1 && !supportRows[0].val && row.val" class="strategy-active">→ using BroadcastChannel</span>
                <span v-else-if="i === 3 && !supportRows[0].val && row.val" class="strategy-active">→ using BroadcastChannel</span>
                <span v-else-if="i === 3 && !supportRows[0].val && !row.val" class="strategy-active">→ using localStorage</span>
              </div>
            </div>
          </div>

          <div class="ctrl-group">
            <div class="ctrl-group-title">capabilities</div>
            <div class="cap-table">
              <div v-for="row in supportRows" :key="row.label" class="cap-row">
                <span class="cap-name">{{ row.label }}</span>
                <span :class="['cap-badge', row.val ? 'yes' : 'no']">{{ row.val ? 'available' : 'unavailable' }}</span>
              </div>
            </div>
          </div>

          <div class="ctrl-group">
            <div class="ctrl-group-title">user agent</div>
            <div class="cap-table" v-if="userAgent">
              <div class="cap-row"><span class="cap-name">browser</span><span class="cap-value">{{ userAgent.name }} {{ userAgent.version }}</span></div>
              <div class="cap-row"><span class="cap-name">engine</span><span class="cap-value">{{ userAgent.engine }}</span></div>
              <div class="cap-row"><span class="cap-name">os</span><span class="cap-value">{{ userAgent.os }}</span></div>
              <div class="cap-row"><span class="cap-name">mobile</span><span class="cap-value">{{ userAgent.mobile }}</span></div>
              <div class="cap-row"><span class="cap-name">brave</span><span class="cap-value">{{ userAgent.isBrave }}</span></div>
            </div>
            <div v-else class="cap-table"><div class="cap-row"><span class="cap-name">loading…</span></div></div>
          </div>

        </div>

        <div class="right-panel">
          <div class="tabs-info-panel">
            <div class="ctrl-group-title">how it works</div>
            <div class="info-block">
              <div class="info-step">
                <span class="info-num">1</span>
                <span>On page load, <code>useTab</code> calls <code>bootstrap()</code> which selects a strategy and calls <code>show()</code> — incrementing the count via the active transport.</span>
              </div>
              <div class="info-step">
                <span class="info-num">2</span>
                <span>On <code>pagehide</code> (tab close, navigation, BFCache), <code>hide()</code> is called — decrementing the count.</span>
              </div>
              <div class="info-step">
                <span class="info-num">3</span>
                <span>The <strong>SharedWorker</strong> strategy keeps a single authoritative <code>tabs</code> map in the worker thread. All tabs connect via <code>MessagePort</code>.</span>
              </div>
              <div class="info-step">
                <span class="info-num">4</span>
                <span>The <strong>BroadcastChannel</strong> strategy uses leader election — the first tab self-elects as leader; followers register via INCR/DECR messages.</span>
              </div>
              <div class="info-step">
                <span class="info-num">5</span>
                <span>The <strong>localStorage</strong> strategy uses the same leader-election model but over LS keys, exploiting the fact that <code>storage</code> events don't fire in the writing tab.</span>
              </div>
            </div>
          </div>
          <LogPane ref="tabLog" class="log-panel" />
        </div>
      </div>
    </section>

  </div>
</template>

<style scoped>
/* ── Design tokens ──────────────────────────────────────────────────────── */
.devtool-root {
  --bg-0:    #0c0e12;
  --bg-1:    #10141a;
  --bg-2:    #171c24;
  --bg-3:    #1d242f;
  --border:  #252d3a;
  --fg:      #c8d8e8;
  --muted:   #4a6070;
  --accent:  #38bdf8;
  --ok:      #34d399;
  --warn:    #fbbf24;
  --danger:  #f87171;
  --mono:    'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Courier New', monospace;

  background:  var(--bg-0);
  color:       var(--fg);
  font-family: var(--mono);
  font-size:   12px;
  min-height:  100vh;
  display:     flex;
  flex-direction: column;
}

/* ── Header ─────────────────────────────────────────────────────────────── */
.dv-header {
  display: flex; align-items: center; gap: 16px;
  padding: 10px 20px; background: var(--bg-1);
  border-bottom: 1px solid var(--border); flex-shrink: 0;
}
.dv-logo { display: flex; align-items: center; gap: 8px; }
.dv-logo-mark { font-size: 18px; color: var(--accent); }
.dv-logo-text { font-size: 14px; font-weight: 700; color: var(--fg); letter-spacing: -.02em; }
.dv-logo-text em { color: var(--accent); font-style: normal; }
.dv-nav { display: flex; gap: 4px; margin-left: 16px; }
.nav-btn {
  padding: 5px 14px; font-family: var(--mono); font-size: 11px; cursor: pointer;
  background: transparent; border: 1px solid var(--border); border-radius: 4px;
  color: var(--muted); transition: all .15s;
}
.nav-btn:hover  { color: var(--fg); border-color: var(--muted); }
.nav-btn.active { background: var(--accent); border-color: var(--accent); color: #000; font-weight: 700; }
.dv-header-right { margin-left: auto; }
.header-badge { font-size: 9px; color: var(--muted); border: 1px solid var(--border); padding: 3px 8px; border-radius: 20px; }

/* ── Section layout ─────────────────────────────────────────────────────── */
.dv-section { flex: 1; display: flex; flex-direction: column; min-height: 0; padding: 16px; gap: 14px; overflow-y: auto; }

/* ── Metrics row ─────────────────────────────────────────────────────────── */
.metrics-row { display: flex; gap: 10px; flex-wrap: wrap; flex-shrink: 0; }

/* ── Two-column body ─────────────────────────────────────────────────────── */
.section-body {
  display: grid; grid-template-columns: 340px 1fr;
  gap: 14px; flex: 1; min-height: 0;
}
@media (max-width: 900px) {
  .section-body { grid-template-columns: 1fr; }
}

/* ── Controls panel ──────────────────────────────────────────────────────── */
.controls-panel { display: flex; flex-direction: column; gap: 10px; overflow-y: auto; }
.ctrl-group {
  background: var(--bg-1); border: 1px solid var(--border);
  border-radius: 6px; padding: 12px; display: flex; flex-direction: column; gap: 8px;
}
.ctrl-group-title {
  font-size: 9px; text-transform: uppercase; letter-spacing: .12em;
  color: var(--muted); border-bottom: 1px solid var(--border); padding-bottom: 6px; margin-bottom: 2px;
}
.note { text-transform: none; letter-spacing: 0; font-size: 9px; }

/* ── Mini form ────────────────────────────────────────────────────────────── */
.key-mini-form { display: flex; flex-direction: column; gap: 5px; }
.mini-row { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.mini-label { font-size: 9px; color: var(--muted); min-width: 48px; text-align: right; text-transform: uppercase; letter-spacing: .06em; }

input, select, textarea {
  background: var(--bg-2); border: 1px solid var(--border); color: var(--fg);
  font-family: var(--mono); font-size: 11px; padding: 5px 8px; border-radius: 4px;
  outline: none; flex: 1; min-width: 0; transition: border-color .15s;
}
input:focus, select:focus, textarea:focus { border-color: var(--accent); }
input[type=number] { flex: 0 0 auto; }

.full-input { width: 100%; box-sizing: border-box; }

/* ── Buttons ─────────────────────────────────────────────────────────────── */
.btn {
  padding: 6px 12px; font-family: var(--mono); font-size: 10px; cursor: pointer;
  background: var(--bg-3); border: 1px solid var(--border); color: var(--fg);
  border-radius: 4px; transition: all .15s; white-space: nowrap;
}
.btn:hover:not(:disabled) { border-color: var(--accent); color: var(--accent); }
.btn:disabled { opacity: .35; cursor: not-allowed; }
.btn.full-width { width: 100%; }
.btn-ok     { border-color: var(--ok);     color: var(--ok); }
.btn-ok:hover:not(:disabled) { background: color-mix(in srgb, var(--ok) 15%, transparent); }
.btn-danger { border-color: var(--danger); color: var(--danger); }
.btn-danger:hover:not(:disabled) { background: color-mix(in srgb, var(--danger) 15%, transparent); }
.btn-warn   { border-color: var(--warn);   color: var(--warn); }
.btn-warn:hover:not(:disabled) { background: color-mix(in srgb, var(--warn) 15%, transparent); }
.btn-accent { border-color: var(--accent); color: var(--accent); }
.btn-accent:hover:not(:disabled) { background: color-mix(in srgb, var(--accent) 15%, transparent); }
.btn-row { display: flex; gap: 6px; flex-wrap: wrap; }

/* ── Canonical tag ────────────────────────────────────────────────────────── */
.canonical-tag {
  font-size: 9px; word-break: break-all; color: var(--muted); padding: 5px 7px;
  background: var(--bg-2); border: 1px solid var(--border); border-radius: 3px;
}
.canonical-tag.valid { border-color: var(--accent); color: var(--accent); }

/* ── Transaction indicator ───────────────────────────────────────────────── */
.tx-indicator {
  font-size: 9px; color: var(--warn); padding: 6px 8px;
  background: color-mix(in srgb, var(--warn) 8%, transparent);
  border: 1px solid color-mix(in srgb, var(--warn) 30%, transparent);
  border-radius: 3px;
}
.strength-badge {
  font-size: 8px; background: var(--bg-3); border: 1px solid var(--border);
  padding: 1px 5px; border-radius: 10px; color: var(--muted); text-transform: none; letter-spacing: 0;
}
.strength-badge.compensating { border-color: var(--warn); color: var(--warn); }

/* ── Right panel ──────────────────────────────────────────────────────────── */
.right-panel { display: flex; flex-direction: column; gap: 10px; min-height: 0; overflow: hidden; }
.log-panel { flex: 1; min-height: 300px; }

/* ── Query panel ──────────────────────────────────────────────────────────── */
.query-panel {
  background: var(--bg-1); border: 1px solid var(--border); border-radius: 6px;
  padding: 12px; display: flex; flex-direction: column; gap: 8px; flex-shrink: 0;
}
.query-form { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
.flex-1 { flex: 1; min-width: 120px; }
.check-label { display: flex; align-items: center; gap: 4px; font-size: 10px; color: var(--muted); cursor: pointer; white-space: nowrap; }
.check-label input { flex: none; width: auto; }

.results-list { display: flex; flex-direction: column; gap: 6px; max-height: 200px; overflow-y: auto; }
.results-header { font-size: 9px; color: var(--muted); text-transform: uppercase; letter-spacing: .08em; }
.result-row {
  background: var(--bg-2); border: 1px solid var(--border); border-radius: 4px;
  padding: 7px 9px; display: flex; flex-direction: column; gap: 3px;
}
.result-key {
  font-size: 10px; color: var(--accent); word-break: break-all; cursor: pointer;
}
.result-key:hover { text-decoration: underline; }
.result-meta { font-size: 9px; color: var(--muted); }
.result-payload { font-size: 9px; color: var(--fg); margin: 0; white-space: pre-wrap; word-break: break-all; max-height: 60px; overflow-y: auto; }

/* ── Tabs section specific ───────────────────────────────────────────────── */
.tab-counter-display {
  display: flex; flex-direction: column; align-items: center; padding: 20px 0;
  background: var(--bg-2); border: 1px solid var(--border); border-radius: 6px;
}
.tab-big-number { font-size: 64px; font-weight: 900; color: var(--accent); line-height: 1; }
.tab-big-label  { font-size: 10px; color: var(--muted); text-transform: uppercase; letter-spacing: .15em; margin-top: 4px; }
.tab-hint { font-size: 10px; color: var(--muted); line-height: 1.6; }

.strategy-chain { display: flex; flex-direction: column; gap: 6px; }
.strategy-row { display: flex; align-items: center; gap: 8px; font-size: 10px; }
.strategy-check { font-size: 12px; }
.strategy-check.yes { color: var(--ok); }
.strategy-check.no  { color: var(--muted); }
.strategy-name  { color: var(--fg); flex: 1; }
.strategy-active { font-size: 9px; color: var(--accent); }

.cap-table { display: flex; flex-direction: column; gap: 4px; }
.cap-row   { display: flex; align-items: center; justify-content: space-between; }
.cap-name  { font-size: 10px; color: var(--muted); }
.cap-value { font-size: 10px; color: var(--fg); }
.cap-badge { font-size: 9px; padding: 1px 7px; border-radius: 10px; border: 1px solid; }
.cap-badge.yes { border-color: var(--ok);    color: var(--ok); }
.cap-badge.no  { border-color: var(--muted); color: var(--muted); }

.tabs-info-panel {
  background: var(--bg-1); border: 1px solid var(--border); border-radius: 6px;
  padding: 12px; display: flex; flex-direction: column; gap: 10px; flex-shrink: 0;
}
.info-block { display: flex; flex-direction: column; gap: 8px; }
.info-step  { display: flex; gap: 10px; align-items: flex-start; font-size: 10px; color: var(--muted); line-height: 1.6; }
.info-num   { flex-shrink: 0; width: 18px; height: 18px; background: var(--bg-3); border: 1px solid var(--border); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 9px; color: var(--accent); }
.info-step strong, .info-step code { color: var(--fg); }
.info-step code { background: var(--bg-2); padding: 1px 4px; border-radius: 3px; font-size: 9px; }
</style>
