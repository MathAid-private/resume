<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue'

import { isNil } from 'lodash'

import { UserAgentKind } from '@/enums'

import type { MemoryTransaction } from '@/composables/managers/storage'
import type { CanonicalKey, ICanonicalKeySegments, Platform, StorageEnvelope } from '@/composables/managers/storage/storage.types'

import { buildCanonicalKey, buildModulePrefix, parseCanonicalKey } from '@/composables/managers/storage'
import { MemoryBackend } from '@/composables/managers/storage/backends/memory/memory'

import { useGlobalStore } from '@/composables/managers/global'

type IValueType = "string" | "null" | "file" | "record" | "number" | "boolean" | "array";

// ─── Backend instance ─────────────────────────────────────────────────────────
const backend = ref<MemoryBackend>()
const initialized = ref(false)
const initError = ref<string | null>(null)

// ─── UI state ─────────────────────────────────────────────────────────────────
const opLog = ref<Array<{ ts: string; op: string; key?: string; status: 'ok' | 'err' | 'info'; detail: string }>>([])
const quota = ref<{ used: number; available: number; ratio: number } | null>(null)
const entries = ref<Array<{ key: CanonicalKey; envelope: StorageEnvelope<unknown> }>>([])
const entryCount = ref(0)
const valueType = ref<IValueType>()
const writeLabel = computed(() => {
  switch(valueType.value) {
    default:
      return "Write"
    case "string":
      return "Write String"
    case "file":
      return "Upload File"
    case "null":
      return "Write Null"
    case "boolean":
      return "Write Boolean"
    case "number":
      return "Write Number"
    case "record":
      return "Write Record"
    case "array":
      return "Write Array"
  }
})
const writeLabelClass = computed(() => {
  switch(valueType.value) {
    default:
    case "string":
      return "write"
    case "file":
      return "upload"
    case "null":
      return "delete"
    case "boolean":
      return "read"
    case "number":
      return "evict"
    case "record":
    case "array":
      return "clear"
  }
})
const ratioPercent = computed(() => quota.value ? Math.round(quota.value.ratio * 100) : 0)

// ─── Input state ──────────────────────────────────────────────────────────────
const domain = ref('myapp')
const userAgent = computed(() => useGlobalStore().support.userAgent)
const platform = computed(() => userAgent.value?.kind || UserAgentKind.UNKNOWN)
const version = computed(() => Number.parseFloat(userAgent.value?.version || ''))
const callingModule = ref('dashboard')
const key = ref('entry-1')
const writePayload = ref<string | boolean | object>('{ "hello": "world", "count": 42 }')
const writeWeight = ref(1)
const schema = ref(1)
const writeTtl = ref<number | ''>('')
const evictTarget = ref(100)
const evictPolicy = ref<'lru' | 'lfu' | 'fifo'>('lru')
const fileUpload = ref<File | null>(null)

// ─── Tx state ────────────────────────────────────────────────────────────────
// const txOps = ref<Array<{ op: 'write' | 'delete'; key: string; payload?: string }>>([])
// const txOpType = ref<'write' | 'delete'>('write')
// const txOpKey = ref('myapp:chrome:130:test:tx-1')
// const txOpPayload = ref('{ "tx": true }')

const readResult = ref<StorageEnvelope<unknown> | null | 'idle'>('idle')
const loading = ref(false)
const tx = ref<MemoryTransaction<unknown>>()
const ops = computed(() => {
  if(!tx.value) return []
  return tx.value?.operations
})

// ---- Checks ------------------------------------------------------------------
function isWriteDisabled() {
  const isDisabled = loading.value || !initialized.value || !key.value || key.value.length === 0 || !valueType.value
  if(isNil(writePayload.value)) {
    return isDisabled || !['file', 'null'].includes(valueType.value as string)
  }
  if(valueType.value === 'file') {
    return !!fileUpload.value
  }
  return isDisabled
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function assembleCanonicalKey() {
  // console.log('key-value', key.value)
  return buildCanonicalKey({
    actualKey: key.value || '',
    callingModule: callingModule.value,
    domain: domain.value,
    platform: platform.value as Platform,
    platformVersion: version.value
  })
}
function assemblePrefix() {
  const segments = parseCanonicalKey(assembleCanonicalKey()) || {
    actualKey: "unknown",
    callingModule: "unknown",
    domain: "unknown",
    platform: UserAgentKind.UNKNOWN as Platform,
    platformVersion: -1,
  } as ICanonicalKeySegments
  return buildModulePrefix(segments.domain, segments.platform, segments.platformVersion, segments.callingModule)
}
function ts() {
  return new Date().toISOString().split('T')[1].split('Z')[0]
}
function log(op: string, status: 'ok' | 'err' | 'info', detail: string, key?: string) {
  opLog.value.unshift({ ts: ts(), op, key, status, detail })
  if (opLog.value.length > 80) opLog.value.pop()
}
function parsePayload(raw: unknown): unknown {
  if(valueType.value === 'null') return null
  try { return JSON.parse(raw as string) } catch { return raw }
}
function checkPayload(p: unknown) {
  switch(valueType.value) {
    default:
    case "file":
    case "string":
    case "null": return
    case "boolean": if(typeof p !== 'boolean') {
      throw new TypeError('Payload must be a boolean')
    }
    return
    case "array": if(!Array.isArray(p)) {
      throw new TypeError('Payload must be an array')
    }
    return
    case "number": if(typeof p !== 'number') {
      throw new TypeError('Payload must be a number')
    }
    return
    case "record": if(typeof p !== 'object') {
      throw new TypeError('Payload must be an object')
    }
    return
  }
}
function buildEnvelope(payload: unknown, weight = 1, ttlMs?: number | ''): StorageEnvelope<unknown> {
  return {
    payload,
    schema_version: schema.value,
    written_at: Date.now(),
    expires_at: (typeof ttlMs === 'number' && ttlMs > 0) ? Date.now() + ttlMs : null,
    weight,
    backend: 'memory',
  }
}
function formatBytes(n: number) {
  if (n < 1024) return `${n} B`
  if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1048576).toFixed(2)} MB`
}

async function refreshMeta() {
  try {
    quota.value = await backend.value!.estimateQuota()
    entryCount.value = await backend.value!.count()
  } catch (e) {
    log('meta', 'err', String(e))
  }
}

async function refreshEntries() {
  try {
    const res = await backend.value!.query({ excludeExpired: false }, {})
    entries.value = res
  } catch (e) {
    log('query', 'err', String(e))
  }
}

// ─── Lifecycle ops ─────────────────────────────────────────────────────────────
async function initialize() {
  loading.value = true
  try {
    await backend.value!.initialize()
    initialized.value = true
    log('init', 'ok', 'MemoryBackend initialized')
    await refreshMeta()
  } catch (e) {
    initError.value = String(e)
    log('init', 'err', String(e))
  } finally {
    loading.value = false
  }
}

async function initAndProbe() {
  loading.value = true
  await destroyTransaction()
  backend.value = new MemoryBackend()
  initialized.value = false
  try {
    await backend.value!.probe()
    log('probe', 'info', 'MemoryBackend Probed')
  } catch (e) {
    initError.value = String(e)
    log('probe', 'err', String(e))
  } finally {
    loading.value = false
  }
}

async function doWrite() {
  if (!initialized.value) return
  loading.value = true
  const key = assembleCanonicalKey() as CanonicalKey
  try {
    const payload = parsePayload(writePayload.value)
    checkPayload(payload)
    const env = buildEnvelope(payload, writeWeight.value, writeTtl.value)
    if(backend.value?.isTransactionActive(tx.value?.id)) {
      await backend.value!.write(key, env, {
        transactionId: tx.value?.id || ''
      })
      return
    }
    await backend.value!.write(key, env)
    log('write', 'ok', `weight=${writeWeight.value} ttl=${writeTtl.value || 'none'}`, key)
    await refreshMeta()
    await refreshEntries()
  } catch (e) {
    console.error(e)
    log('write', 'err', String(e), key)
  } finally {
    loading.value = false
  }
}

async function doRead() {
  if (!initialized.value) return
  loading.value = true
  const key = assembleCanonicalKey() as CanonicalKey
  try {
    const result = await backend.value!.read(key)
    readResult.value = result
    log('read', result ? 'ok' : 'info', result ? `hit — schema_v${result.schema_version}` : 'miss (null)', key)
  } catch (e) {
    log('read', 'err', String(e), key)
    readResult.value = null
  } finally {
    loading.value = false
  }
}

async function doDelete() {
  if (!initialized.value) return
  loading.value = true
  const key = assembleCanonicalKey() as CanonicalKey
  try {
    if(backend.value?.isTransactionActive(tx.value?.id)) {
      await backend.value!.delete(key, {
        transactionId: tx.value?.id || '',
      })
      return
    }
    await backend.value!.delete(key)
    log('delete', 'ok', 'entry removed', key)
    if (readResult.value !== 'idle') readResult.value = null
    await refreshMeta()
    await refreshEntries()
  } catch (e) {
    log('delete', 'err', String(e), key)
  } finally {
    loading.value = false
  }
}

async function doClear() {
  if (!initialized.value) return
  loading.value = true
  try {
    const prefix = assemblePrefix() as CanonicalKey
    if(backend.value?.isTransactionActive(tx.value?.id)) {
      await backend.value!.clear(prefix, {
        transactionId: tx.value?.id || ''
      })
      return
    }
    await backend.value!.clear(prefix || undefined)
    log('clear', 'ok', prefix ? `prefix: ${prefix}` : 'full clear')
    await refreshMeta()
    await refreshEntries()
  } catch (e) {
    log('clear', 'err', String(e))
  } finally {
    loading.value = false
  }
}

async function doQuery() {
  if (!initialized.value) return
  loading.value = true
  try {
    await refreshEntries()
    log('query', 'ok', `${entries.value.length} result(s)`, assemblePrefix())
  } catch (e) {
    log('query', 'err', String(e))
  } finally {
    loading.value = false
  }
}

async function doEvict() {
  if (!initialized.value) return
  loading.value = true
  try {
    const freed = await backend.value!.evict(evictTarget.value, evictPolicy.value)
    log('evict', 'ok', `freed ${freed} entries, policy=${evictPolicy.value}`)
    await refreshMeta()
    await refreshEntries()
  } catch (e) {
    log('evict', 'err', String(e))
  } finally {
    loading.value = false
  }
}

async function fileToString(file: File) {
  const reader = new FileReader()
  reader.readAsDataURL(file)
  await new Promise((res, rej) => {
    reader.onload = res
    reader.onerror = rej
  })
  const dataUrl = reader.result as string
  return dataUrl.split(',')[1] // remove the "data:...;base64," prefix
}

async function writeFile() {
  if (!initialized.value || !fileUpload.value) return
  loading.value = true
  const key = assembleCanonicalKey() as CanonicalKey
  try {

    const payload = {
      name: fileUpload.value.name,
      size: fileUpload.value.size,
      type: fileUpload.value.type,
      data: await fileToString(fileUpload.value)
    }
    const env = buildEnvelope(payload, 3)
    if(backend.value?.isTransactionActive(tx.value?.id)) {
      await backend.value!.write(key, env, {
        transactionId: tx.value?.id || ''
      })
      return
    }
    await backend.value!.write(key, env)
    log('write:file', 'ok', `${fileUpload.value.name} (${formatBytes(fileUpload.value.size)})`, key)
    await refreshMeta()
    await refreshEntries()
  } catch (e) {
    console.error(e)
    log('write:file', 'err', String(e), key)
  } finally {
    loading.value = false
  }
}

async function write() {
  switch(valueType.value) {
    case "file": return await writeFile()
    default: return
    case "array":
    case "boolean":
    case "number":
    case "record":
    case "string":
    case "null": return await doWrite()
  }
}

// ─── Transaction ops ──────────────────────────────────────────────────────────
async function initializeTransaction() {
  if(!initialized.value) return
  loading.value = true
  try {
    tx.value = (await backend.value!.beginTransaction()) as MemoryTransaction<unknown>
    log('init:tx', 'info', `Transaction - ${tx.value?.id} - Initialized`)
  } catch (e) {
    log('init:tx', 'err', String(e))
  } finally {
    loading.value = false
  }
}
async function destroyTransaction() {
if(!tx.value) return
  loading.value = true
  try {
    tx.value?.rollback()
    log('init:tx', 'info', `Transaction - ${tx.value?.id} - Rolled back`)
    tx.value = undefined
  } catch (e) {
    log('destroy:tx', 'err', String(e))
  } finally {
    loading.value = false
  }
}
async function commitTx() {
  if (!initialized.value || ops.value.length === 0) return
  loading.value = true
  try {
    await tx.value?.commit()
    log('tx:commit', 'ok', `${ops.value.length} op(s) committed - ${tx.value?.id}`)
    await refreshMeta()
    await refreshEntries()
    tx.value = undefined
  } catch (e) {
    log('tx:commit', 'err', String(e))
  } finally {
    loading.value = false
  }
}
async function removeTxOp(index: number) {
  if (!initialized.value || ops.value.length === 0) return
  loading.value = true
  try {
    await tx.value?.rollback(index)
  } catch (err) {
    log(`tx:cancelOp-${index}`, 'err', String(err))
  } finally {
    loading.value = false
  }
}
async function rollbackTx() {
  if (!initialized.value || ops.value.length === 0) return
  loading.value = true
  try {
    await tx.value?.rollback()
    log('tx:rollback', 'info', `${ops.value.length} op(s) discarded`)
  } catch (e) {
    log('tx:rollback', 'err', String(e))
  } finally {
    loading.value = false
  }
}

onMounted(initAndProbe)

function handleFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  fileUpload.value = input.files?.[0] ?? null
}
function onValueTypeChange(e: Event) {
  const input = e.target as HTMLSelectElement
  writePayload.value = input.value !== 'boolean' ? (undefined as never) : false
}
async function onIOChange(e: Event) {
  const target = e.target as HTMLInputElement
  if(target.checked === true) {
    await initialize()
  } else {
    await initAndProbe()
  }
}
async function onTXChange(e: Event) {
  const target = e.target as HTMLInputElement
  if(target.checked === true) {
    await initializeTransaction()
  } else {
    await destroyTransaction()
  }
}
</script>

<template>
  <div class="panel memory-panel">
    <div class="panel-header">
      <span class="panel-badge mem">MEM</span>
      <h2 class="panel-title">Memory Backend</h2>
      <span class="status-dot" :class="initialized ? 'active' : 'inactive'"></span>
      <label for="status" class="status-text" :class="{'live': initialized}">
        {{ initialized ? 'ONLINE' : 'OFFLINE' }}
        <input style="display: none" type="checkbox" id="status" @change="onIOChange" />
      </label>
      <template v-if="!isNil(backend)">
        <label for="tx">
          <h3 class="op-title"><span class="tx-title" :class="{'op-verb tx': backend.isTransactionActive(tx?.id)}">TRANSACTION</span></h3>
          <input style="display: none" type="checkbox" id="tx" @change="onTXChange" />
        </label>
      </template>
      <span class="spacer"></span>
      <span class="meta-chip">{{ entryCount }} entries</span>
      <span class="meta-chip" v-if="quota">{{ formatBytes(quota.used) }} / 50 MB</span>
    </div>

    <!-- Quota bar -->
    <div class="quota-bar-wrap" v-if="quota">
      <div class="quota-bar">
        <div class="quota-fill mem-fill" :style="{ width: ratioPercent + '%' }"></div>
      </div>
      <span class="quota-label">{{ ratioPercent }}% used</span>
    </div>

    <div class="panel-body">
      <!-- ── LEFT COLUMN: CRUD ops ────────────────────────────────── -->
      <div class="ops-col">

        <!-- WRITE -->
        <section class="op-section">
          <h3 class="op-title" v-if="valueType"><span class="op-verb" :class="writeLabelClass">{{ writeLabel }}</span></h3>
          <div class="flex-entry">
            <div class="flex-item">
              <label class="field-label">Value type</label>
              <select class="field-select" v-model="valueType" placeholder="Select a value type" @change="onValueTypeChange">
                <option value="string">STRING</option>
                <option value="file">FILE</option>
                <option value="null">NULL</option>
                <option value="boolean">BOOLEAN</option>
                <option value="number">NUMBER</option>
                <option value="record">RECORD</option>
                <option value="array">ARRAY</option>
              </select>
            </div>
            <div class="flex-item">
              <label class="field-label">Weight</label>
              <input class="field-input small" inputmode="numeric" pattern="[0-9]+" v-model.number="writeWeight" min="0" max="100" />
            </div>
            <div class="flex-item">
              <label class="field-label">TTL (ms, optional)</label>
              <input class="field-input small" inputmode="numeric" pattern="[0-9]+" v-model.number="writeTtl" placeholder="e.g. 5000" />
            </div>
            <div class="flex-item">
              <label class="field-label">Schema Version</label>
              <input class="field-input small" inputmode="numeric" pattern="[0-9]+" v-model.number="schema" placeholder="e.g. 1" />
            </div>
          </div>
          <label class="field-label">Payload ({{ valueType ? valueType.toUpperCase() : 'Empty' }})</label>
          <template v-if="!['file', 'null'].includes(valueType as string)">
            <textarea v-if="['record', 'array'].includes(valueType as string)" class="field-textarea" v-model="(writePayload as string)" rows="3" />
            <input v-else-if="['string', 'number'].includes(valueType as string)" class="field-input small" :pattern="valueType === 'string' ? undefined : '[0=9]+'" :inputmode="valueType === 'string' ? 'text' : 'numeric'" v-model="writePayload" />
            <label for="boolean" v-else-if="valueType === 'boolean'">
              {{ typeof writePayload === 'boolean' ? writePayload ? 'TRUE' : 'FALSE' : '' }}
              <input id="boolean" type="checkbox" v-model="writePayload" />
            </label>
          </template>
          <template v-else-if="valueType === 'file'">
            <input class="field-input file-input" type="file" @change="handleFileChange" />
          </template>
          <div class="flex-entry">
            <button class="flex-item btn btn-write" @click="write" :disabled="isWriteDisabled()">write()</button>
            <button class="flex-item btn btn-read" @click="doRead" :disabled="loading || !initialized">read()</button>
            <button class="flex-item btn btn-delete" @click="doDelete" :disabled="loading || !initialized">delete()</button>
            <button class="flex-item btn btn-clear" @click="doClear" :disabled="loading || !initialized">clear()</button>
          </div>
          <div class="read-result" v-if="readResult !== 'idle'">
            <span class="result-label">Result:</span>
            <pre class="result-pre">{{ readResult === null ? 'null (miss)' : JSON.stringify(readResult, null, 2) }}</pre>
          </div>
        </section>

        <!-- EVICT -->
        <section class="op-section">
          <h3 class="op-title"><span class="op-verb evict">EVICT</span></h3>
          <div class="flex-entry">
            <div class="flex-item">
              <label class="field-label">Target (entries)</label>
              <input class="field-input small" type="number" v-model.number="evictTarget" min="1" />
            </div>
            <div class="flex-item">
              <label class="field-label">Policy</label>
              <select class="field-select" v-model="evictPolicy">
                <option value="lru">LRU</option>
                <option value="lfu">LFU</option>
                <option value="fifo">FIFO</option>
              </select>
            </div>
            <button class="flex-item btn btn-evict" @click="doEvict" :disabled="loading || !initialized">evict()</button>
          </div>
        </section>

        <!-- TRANSACTION BUILDER -->
        <section class="op-section tx-section">
          <div class="flex-entry">
            <h3 class="op-title"><span class="op-verb tx">TRANSACTION</span></h3>
            <h3 v-if="tx" class="op-title"><span class="tx tx-title">{{ tx?.id }}</span></h3>
          </div>
          <div class="tx-queue" v-if="ops.length">
            <div class="tx-op-row" v-for="(op, i) in ops" :key="i">
              <span class="tx-badge" :class="op.kind">{{ op.kind }}</span>
              <span class="tx-key">{{ op.key }}</span>
              <span class="tx-payload" v-if="!isNil(op.envelope?.payload)">{{ JSON.stringify(op.envelope?.payload).slice(0, 30) }}…</span>
              <button class="tx-remove" @click="removeTxOp(i)">✕</button>
            </div>
          </div>
          <div class="row-2" v-if="ops.length">
            <button class="btn btn-write" @click="commitTx" :disabled="loading || !initialized">commit()</button>
            <button class="btn btn-delete" @click="rollbackTx" :disabled="loading || !initialized">rollback()</button>
          </div>
        </section>
      </div>

      <!-- ── RIGHT COLUMN ────────────────────────────────────────── -->
      <div class="info-col">

        <!-- Canonical Key -->
        <section class="op-section">
          <h3 class="op-title"><span class="op-verb evict">Canonical Key</span></h3>
          <div class="flex-entry">
            <div class="flex-item">
              <label class="field-label">User Agent</label>
              <input class="field-input small" v-model="userAgent" readonly />
            </div>
            <div class="flex-item">
              <label class="field-label">Platform</label>
              <input class="field-input small" v-model="platform" readonly />
            </div>
            <div class="flex-item">
              <label class="field-label">Platform Version</label>
              <input class="field-input small" v-model="version" readonly />
            </div>
            <div class="flex-item">
              <label class="field-label">Module</label>
              <select class="field-select" v-model="callingModule">
                <option value="dashboard">Dashboard</option>
                <option value="admin">Admin</option>
                <option value="corporate">Corporate</option>
                <option value="settings">Settings</option>
                <option value="user">User</option>
              </select>
            </div>
          </div>
          <div class="flex-entry">
            <div class="flex-item">
              <label class="field-label">Domain</label>
              <input class="field-input small" v-model="domain" />
            </div>
            <div class="flex-item">
              <label class="field-label">Key (Current)</label>
              <input id="key" class="field-input small" v-model="key" />
            </div>
          </div>
          <div class="flex-entry">
            <div class="flex-item" style="display: flex; flex-direction: column; gap: .2rem;">
              <label class="field-label">Full Path</label>
              <button class="btn btn-evict" disabled>{{ assembleCanonicalKey() }}</button>
            </div>
            <div class="flex-item" style="display: flex; flex-direction: column; gap: .2rem;">
              <label class="field-label">Module Prefix</label>
              <button class="btn btn-evict" disabled>{{ assemblePrefix() }}</button>
            </div>
          </div>
        </section>

        <!-- QUERY / ENTRIES TABLE -->
        <section class="op-section entries-section">
          <div class="section-header-row">
            <h3 class="op-title"><span class="op-verb read">ENTRIES</span></h3>
            <button class="btn btn-sm btn-read" @click="doQuery" :disabled="loading || !initialized">refresh</button>
          </div>
          <div class="entries-table-wrap">
            <table class="entries-table" v-if="entries.length">
              <thead>
                <tr>
                  <th>Key</th>
                  <th>schema_v</th>
                  <th>weight</th>
                  <th>expires_at</th>
                  <th>payload preview</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="e in entries" :key="e.key">
                  <td class="key-cell">{{ parseCanonicalKey(e.key)?.actualKey || 'Unknown' }}</td>
                  <td>{{ e.envelope.schema_version }}</td>
                  <td>{{ e.envelope.weight }}</td>
                  <td>{{ e.envelope.expires_at ? new Date(e.envelope.expires_at).toLocaleTimeString() : '∞' }}</td>
                  <td class="payload-cell">{{ JSON.stringify(e.envelope.payload).slice(0, 40) }}…</td>
                </tr>
              </tbody>
            </table>
            <div class="empty-state" v-else>no entries — run write() or refresh</div>
          </div>
        </section>

        <!-- OP LOG -->
        <section class="log-section">
          <h3 class="op-title">OP LOG <span class="log-count">({{ opLog.length }})</span></h3>
          <div class="log-scroll">
            <div class="log-row" v-for="(l, i) in opLog" :key="i" :class="l.status">
              <span class="log-ts">{{ l.ts }}</span>
              <span class="log-op">{{ l.op }}</span>
              <span class="log-key" v-if="l.key">{{ l.key.split(':').pop() }}</span>
              <span class="log-detail">{{ l.detail }}</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped>
.panel { display: flex; flex-direction: column; gap: 0; }
.panel-header {
  display: flex; align-items: center; gap: 10px;
  padding: 12px 20px;
  background: var(--panel-header-bg);
  border-bottom: 1px solid var(--border);
  border-radius: var(--radius) var(--radius) 0 0;
}
.panel-badge {
  font-family: var(--mono); font-size: 11px; font-weight: 700;
  padding: 2px 8px; border-radius: 3px; letter-spacing: 1px;
}
.panel-badge.mem { background: #00c896; color: #000; }
.panel-title { font-size: 15px; font-weight: 700; margin: 0; }
.status-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.status-dot.active { background: #00ff88; box-shadow: 0 0 6px #00ff88; }
.status-dot.inactive { background: #555; }
.status-text { padding: .2rem; font-family: var(--mono); font-size: 11px; color: var(--muted); border: 1px solid; border-color: transparent; border-radius: .2rem; }
.live { color: #00c896aa; border-color: #00c896aa; }
.spacer { flex: 1; }
.meta-chip {
  font-family: var(--mono); font-size: 11px; background: var(--chip-bg);
  padding: 3px 10px; border-radius: 20px; color: var(--muted);
}
.quota-bar-wrap { display: flex; align-items: center; gap: 10px; padding: 8px 20px; background: var(--panel-header-bg); border-bottom: 1px solid var(--border); }
.quota-bar { flex: 1; height: 4px; background: var(--border); border-radius: 2px; overflow: hidden; }
.quota-fill { height: 100%; border-radius: 2px; transition: width 0.4s ease; }
.mem-fill { background: linear-gradient(90deg, #00c896, #00ff88); }
.quota-label { font-family: var(--mono); font-size: 10px; color: var(--muted); white-space: nowrap; }

.panel-body { display: grid; grid-template-columns: 1fr 1fr; gap: 0; min-height: 0; }
.ops-col { padding: 16px; display: flex; flex-direction: column; gap: 12px; border-right: 1px solid var(--border); overflow-y: auto; max-height: 80vh; }
.info-col { padding: 16px; display: flex; flex-direction: column; gap: 12px; overflow-y: auto; max-height: 80vh; }

.flex-entry { display: flex; flex-direction: row; gap: .5rem; flex-wrap: wrap; }
.flex-item { flex: 1 1 0px; width: 0px; }

.op-section { background: var(--section-bg); border: 1px solid var(--border); border-radius: 8px; padding: 12px; display: flex; flex-direction: column; gap: 8px; }
.tx-section { border-color: var(--tx-border); }
.op-title { margin: 0; font-size: 12px; font-weight: 700; font-family: var(--mono); color: var(--muted); display: flex; align-items: center; gap: 8px; }
.op-verb { padding: 2px 8px; border-radius: 3px; font-size: 10px; letter-spacing: 1px; }
.tx-title { font-size: 1rem; user-select: none; }
.op-verb.write { background: #00c89622; color: #00c896; border: 1px solid #00c89633; }
.op-verb.read  { background: #4fa3ff22; color: #4fa3ff; border: 1px solid #4fa3ff33; }
.op-verb.delete{ background: #ff4f6422; color: #ff4f64; border: 1px solid #ff4f6433; }
.op-verb.clear { background: #ff9f3022; color: #ff9f30; border: 1px solid #ff9f3033; }
.op-verb.evict { background: #c084fc22; color: #c084fc; border: 1px solid #c084fc33; }
.op-verb.upload{ background: #facc1522; color: #facc15; border: 1px solid #facc1533; }
.op-verb.tx    { background: #f472b622; color: #f472b6; border: 1px solid #f472b633; }

.field-label { font-family: var(--mono); font-size: 10px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.5px; }
.field-input, .field-textarea, .field-select {
  background: var(--input-bg); border: 1px solid var(--border);
  color: var(--text); border-radius: 5px; padding: 7px 10px;
  font-family: var(--mono); font-size: 12px; width: 100%; box-sizing: border-box;
  transition: border-color 0.2s;
}
.field-input:focus, .field-textarea:focus, .field-select:focus { outline: none; border-color: var(--accent); }
.field-textarea { resize: vertical; min-height: 60px; }
.field-input.small { width: 100%; }
.file-input { padding: 5px; cursor: pointer; }
.row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
input[id="boolean"] {
  display: none;
}
label[for="boolean"] {
  padding: 2px 8px;
  color: color-mix(in oklab, #4fa4ff 50%, transparent);
  border: 1px solid;
  border-radius: 3px;
  width: 4em;
  font-family: var(--mono);
  font-size: 1.2rem;
  text-transform: uppercase;
  text-align: center;
  letter-spacing: 0.5px;
  user-select: none;
  cursor: pointer;
}
label[for="boolean"]:has(input[id="boolean"]:checked) {
  color: #4fa3ff;
}

.btn {
  padding: 8px 14px; border-radius: 5px; border: 1px solid transparent;
  font-family: var(--mono); font-size: 12px; cursor: pointer; font-weight: 600;
  transition: all 0.15s; letter-spacing: 0.5px;
}
.btn:disabled { opacity: 0.4; cursor: not-allowed; }
.btn-write  { background: #00c89622; color: #00c896; border-color: #00c89644; }
.btn-write:hover:not(:disabled)  { background: #00c89633; }
.btn-read   { background: #4fa3ff22; color: #4fa3ff; border-color: #4fa3ff44; }
.btn-read:hover:not(:disabled)   { background: #4fa3ff33; }
.btn-delete { background: #ff4f6422; color: #ff4f64; border-color: #ff4f6444; }
.btn-delete:hover:not(:disabled) { background: #ff4f6433; }
.btn-clear { background: #ff9f3022; color: #ff9f30; border-color: #ff9f3044; }
.btn-clear:hover:not(:disabled) { background: #ff9f3033; }
.btn-evict  { background: #c084fc22; color: #c084fc; border-color: #c084fc44; }
.btn-evict:hover:not(:disabled)  { background: #c084fc33; }
.btn-upload { background: #facc1522; color: #facc15; border-color: #facc1544; }
.btn-upload:hover:not(:disabled) { background: #facc1533; }
.btn-tx-add { background: #f472b622; color: #f472b6; border-color: #f472b644; font-size: 11px; padding: 5px 10px; }
.btn-sm { font-size: 11px; padding: 4px 10px; }

.read-result { background: var(--input-bg); border: 1px solid var(--border); border-radius: 5px; padding: 8px; }
.result-label { font-family: var(--mono); font-size: 10px; color: var(--muted); }
.result-pre { font-family: var(--mono); font-size: 11px; margin: 4px 0 0; color: var(--text); white-space: pre-wrap; word-break: break-all; max-height: 120px; overflow-y: auto; }

.section-header-row { display: flex; align-items: center; justify-content: space-between; }
.entries-section { flex: 1; }
.entries-table-wrap { overflow-x: auto; max-height: 7rem; overflow-y: auto; }
.entries-table { width: 100%; border-collapse: collapse; font-family: var(--mono); font-size: 11px; }
.entries-table th { color: var(--muted); text-align: left; padding: 4px 8px; border-bottom: 1px solid var(--border); position: sticky; top: 0; background: var(--section-bg); font-weight: 600; }
.entries-table td { padding: 4px 8px; border-bottom: 1px solid var(--border-subtle); vertical-align: top; }
.entries-table tr:hover td { background: var(--row-hover); }
/* .entries-table-body { max-height: 3rem; overflow-y: auto; outline: solid lime 1.5px; } */
.key-cell { color: var(--accent); max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.payload-cell { color: var(--muted); max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.empty-state { font-family: var(--mono); font-size: 12px; color: var(--muted); text-align: center; padding: 20px; }

.log-section { flex: 1; }
.log-count { color: var(--muted); font-weight: 400; }
.log-scroll { height: 260px; overflow-y: auto; display: flex; flex-direction: column; gap: 2px; }
.log-row { display: flex; gap: 8px; align-items: baseline; padding: 3px 6px; border-radius: 4px; font-family: var(--mono); font-size: 11px; }
.log-row.ok   { background: #00c89608; }
.log-row.err  { background: #ff4f6408; }
.log-row.info { background: #4fa3ff08; }
.log-ts     { color: var(--muted); font-size: 10px; flex-shrink: 0; }
.log-op     { color: var(--text); font-weight: 700; flex-shrink: 0; min-width: 60px; }
.log-key    { color: var(--accent); flex-shrink: 0; }
.log-detail { color: var(--muted); flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.log-row.ok .log-op   { color: #00c896; }
.log-row.err .log-op  { color: #ff4f64; }
.log-row.info .log-op { color: #4fa3ff; }

.tx-queue { display: flex; flex-direction: column; gap: 4px; max-height: 100px; overflow-y: auto; }
.tx-op-row { display: flex; align-items: center; gap: 6px; background: var(--input-bg); border-radius: 4px; padding: 4px 8px; font-family: var(--mono); font-size: 11px; }
.tx-badge { padding: 1px 6px; border-radius: 3px; font-size: 10px; font-weight: 700; }
.tx-badge.write  { background: #00c89622; color: #00c896; }
.tx-badge.delete { background: #ff4f6422; color: #ff4f64; }
.tx-badge.clear { background: #ff9f3022; color: #ff9f30; }
.tx-key { color: var(--accent); flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tx-payload { color: var(--muted); font-size: 10px; }
.tx-remove { background: none; border: none; color: var(--muted); cursor: pointer; font-size: 12px; padding: 0 2px; }
.tx-remove:hover { color: #ff4f64; }
.tx-border { --tx-border: #f472b633; }
</style>
