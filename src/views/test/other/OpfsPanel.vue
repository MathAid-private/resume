<script lang="ts" setup>
import { ref, computed, onMounted } from 'vue'
import { OPFSBackend } from '@/composables/managers/storage/backends/opfs/opfs'
import type { CanonicalKey, StorageEnvelope } from '@/composables/managers/storage/storage.types'

// ─── Backend instance ─────────────────────────────────────────────────────────
const backend = new OPFSBackend({ rootDirName: 'dashboard-test' })
const initialized = ref(false)
const initError = ref<string | null>(null)
const probeResult = ref<{ available: boolean; latency?: number; reason?: string } | null>(null)

// ─── UI state ─────────────────────────────────────────────────────────────────
const opLog = ref<Array<{ ts: string; op: string; key?: string; status: 'ok' | 'err' | 'info'; detail: string }>>([])
const quota = ref<{ used: number; available: number; ratio: number } | null>(null)
const entries = ref<Array<{ key: CanonicalKey; envelope: StorageEnvelope<string> }>>([])
const entryCount = ref(0)
const loading = ref(false)

// ─── Input state ──────────────────────────────────────────────────────────────
const writeKey = ref('myapp:chrome:130:opfstest:entry-1')
const writePayload = ref('{ "hello": "opfs", "value": 99 }')
const writeWeight = ref(1)
const writeTtl = ref<number | ''>('')
const readKey = ref('myapp:chrome:130:opfstest:entry-1')
const deleteKey = ref('myapp:chrome:130:opfstest:entry-1')
const clearPrefix = ref('myapp:chrome:130:opfstest:')
const queryPrefix = ref('myapp:chrome:130:opfstest:')
const evictTarget = ref(1000)
const evictPolicy = ref<'lru' | 'lfu' | 'fifo'>('lru')
const fileUpload = ref<File | null>(null)
const fileKey = ref('myapp:chrome:130:opfsfiles:upload-1')
const readResult = ref<StorageEnvelope<string> | null | 'idle'>('idle')

// ─── Bulk write ───────────────────────────────────────────────────────────────
const bulkCount = ref(10)
const bulkPrefix = ref('myapp:chrome:130:opfstest:bulk-')

// ─── Tx ───────────────────────────────────────────────────────────────────────
const txOps = ref<Array<{ op: 'write' | 'delete'; key: string; payload?: string }>>([])
const txOpType = ref<'write' | 'delete'>('write')
const txOpKey = ref('myapp:chrome:130:opfstest:tx-1')
const txOpPayload = ref('{ "tx": true }')

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getEncoder() { return new TextEncoder() }
function ts() { return new Date().toISOString().split('T')[1].split('Z')[0] }
function log(op: string, status: 'ok' | 'err' | 'info', detail: string, key?: string) {
  opLog.value.unshift({ ts: ts(), op, key, status, detail })
  if (opLog.value.length > 100) opLog.value.pop()
}
function parsePayload(raw: string): string {
  // OPFS stores strings (already-serialized); we just JSON.stringify the parsed value
  try { return JSON.stringify(JSON.parse(raw)) } catch { return raw }
}
function buildEnvelope(payload: string, weight = 1, ttlMs?: number | ''): StorageEnvelope<string> {
  return {
    payload,
    schema_version: 1,
    written_at: Date.now(),
    expires_at: (typeof ttlMs === 'number' && ttlMs > 0) ? Date.now() + ttlMs : null,
    weight,
    backend: 'opfs',
  }
}
function formatBytes(n: number) {
  if (n < 1024) return `${n} B`
  if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1048576).toFixed(2)} MB`
}

async function refreshMeta() {
  try {
    quota.value = await backend.estimateQuota()
    entryCount.value = await backend.count()
  } catch (e) {
    log('meta', 'err', String(e))
  }
}
async function refreshEntries() {
  try {
    const res = await backend.query({ prefix: queryPrefix.value || undefined, excludeExpired: false }, {})
    entries.value = res as Array<{ key: CanonicalKey; envelope: StorageEnvelope<string> }>
  } catch (e) {
    log('query', 'err', String(e))
  }
}

// ─── Init ─────────────────────────────────────────────────────────────────────
async function init() {
  loading.value = true
  try {
    probeResult.value = await backend.probe()
    log('probe', probeResult.value.available ? 'ok' : 'err',
      probeResult.value.available ? `latency ${probeResult.value.latency?.toFixed(1)}ms` : (probeResult.value.reason ?? 'unavailable'))
    if (!probeResult.value.available) {
      initError.value = probeResult.value.reason ?? 'OPFS unavailable'
      return
    }
    await backend.initialize()
    initialized.value = true
    log('init', 'ok', 'OPFSBackend initialized (rootDir: dashboard-test)')
    await refreshMeta()
    await refreshEntries()
  } catch (e) {
    initError.value = String(e)
    log('init', 'err', String(e))
  } finally {
    loading.value = false
  }
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────
async function doWrite() {
  if (!initialized.value) return
  loading.value = true
  try {
    const payload = parsePayload(writePayload.value)
    const env = buildEnvelope(payload, writeWeight.value, writeTtl.value)
    await backend.write(writeKey.value as CanonicalKey, env)
    log('write', 'ok', `${env.payload.length}B weight=${writeWeight.value}`, writeKey.value)
    await refreshMeta(); await refreshEntries()
  } catch (e) { log('write', 'err', String(e), writeKey.value) } finally { loading.value = false }
}

async function doRead() {
  if (!initialized.value) return
  loading.value = true
  try {
    const result = await backend.read(readKey.value as CanonicalKey)
    readResult.value = result
    log('read', result ? 'ok' : 'info', result ? `hit ${result.payload.length}B` : 'miss', readKey.value)
  } catch (e) { log('read', 'err', String(e), readKey.value); readResult.value = null } finally { loading.value = false }
}

async function doDelete() {
  if (!initialized.value) return
  loading.value = true
  try {
    await backend.delete(deleteKey.value as CanonicalKey)
    log('delete', 'ok', 'removed from OPFS + manifest', deleteKey.value)
    await refreshMeta(); await refreshEntries()
  } catch (e) { log('delete', 'err', String(e), deleteKey.value) } finally { loading.value = false }
}

async function doClear() {
  if (!initialized.value) return
  loading.value = true
  try {
    await backend.clear(clearPrefix.value || undefined)
    log('clear', 'ok', clearPrefix.value ? `prefix: ${clearPrefix.value}` : 'FULL CLEAR ⚠')
    await refreshMeta(); await refreshEntries()
  } catch (e) { log('clear', 'err', String(e)) } finally { loading.value = false }
}

async function doQuery() {
  if (!initialized.value) return
  loading.value = true
  try {
    await refreshEntries()
    log('query', 'ok', `${entries.value.length} result(s) for prefix "${queryPrefix.value}"`)
  } catch (e) { log('query', 'err', String(e)) } finally { loading.value = false }
}

async function doEvict() {
  if (!initialized.value) return
  loading.value = true
  try {
    const freed = await backend.evict(evictTarget.value, evictPolicy.value)
    log('evict', 'ok', `freed ${formatBytes(freed)} policy=${evictPolicy.value}`)
    await refreshMeta(); await refreshEntries()
  } catch (e) { log('evict', 'err', String(e)) } finally { loading.value = false }
}

async function doBulkWrite() {
  if (!initialized.value) return
  loading.value = true
  const start = performance.now()
  let ok = 0
  try {
    for (let i = 0; i < bulkCount.value; i++) {
      const key = `${bulkPrefix.value}${i}` as CanonicalKey
      const env = buildEnvelope(JSON.stringify({ index: i, rand: Math.random(), ts: Date.now() }), 1)
      await backend.write(key, env)
      ok++
    }
    const elapsed = (performance.now() - start).toFixed(0)
    log('bulk-write', 'ok', `${ok}/${bulkCount.value} writes in ${elapsed}ms (avg ${(+elapsed / ok).toFixed(1)}ms/write)`)
    await refreshMeta(); await refreshEntries()
  } catch (e) { log('bulk-write', 'err', `${ok}/${bulkCount.value} done, then: ${String(e)}`) } finally { loading.value = false }
}

async function doUploadFile() {
  if (!initialized.value || !fileUpload.value) return
  loading.value = true
  try {
    const ab = await fileUpload.value.arrayBuffer()
    const b64 = btoa(String.fromCharCode(...new Uint8Array(ab)))
    const payload = JSON.stringify({ name: fileUpload.value.name, size: fileUpload.value.size, type: fileUpload.value.type, data: b64 })
    const env = buildEnvelope(payload, 3)
    await backend.write(fileKey.value as CanonicalKey, env)
    log('write:file', 'ok', `${fileUpload.value.name} (${formatBytes(fileUpload.value.size)})`, fileKey.value)
    await refreshMeta(); await refreshEntries()
  } catch (e) { log('write:file', 'err', String(e), fileKey.value) } finally { loading.value = false }
}

// ─── Transactions ─────────────────────────────────────────────────────────────
function addTxOp() {
  txOps.value.push({ op: txOpType.value, key: txOpKey.value, payload: txOpType.value === 'write' ? txOpPayload.value : undefined })
}
function removeTxOp(i: number) { txOps.value.splice(i, 1) }
async function commitTx() {
  if (!initialized.value || txOps.value.length === 0) return
  loading.value = true
  try {
    const tx = await backend.beginTransaction()
    for (const op of txOps.value) {
      if (op.op === 'write') {
        const env = buildEnvelope(parsePayload(op.payload || '{}'), 1)
        await backend.write(op.key as CanonicalKey, env, { transactionId: tx.id })
      } else {
        await backend.delete(op.key as CanonicalKey, { transactionId: tx.id })
      }
    }
    await tx.commit()
    log('tx:commit', 'ok', `WAL written → ${txOps.value.length} ops applied → manifest updated → WAL cleared`)
    txOps.value = []
    await refreshMeta(); await refreshEntries()
  } catch (e) { log('tx:commit', 'err', String(e)) } finally { loading.value = false }
}
async function rollbackTx() {
  if (!initialized.value || txOps.value.length === 0) return
  loading.value = true
  try {
    const tx = await backend.beginTransaction()
    await tx.rollback()
    log('tx:rollback', 'info', `${txOps.value.length} ops discarded — zero FS changes`)
    txOps.value = []
  } catch (e) { log('tx:rollback', 'err', String(e)) } finally { loading.value = false }
}

const ratioPercent = computed(() => quota.value ? Math.round(quota.value.ratio * 100) : 0)

function handleFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  fileUpload.value = input.files?.[0] ?? null
}

onMounted(init)
</script>

<template>
  <div class="panel opfs-panel">
    <div class="panel-header">
      <span class="panel-badge opfs">OPFS</span>
      <h2 class="panel-title">OPFS Backend</h2>
      <span class="status-dot" :class="initialized ? 'active' : (initError ? 'error' : 'inactive')"></span>
      <span class="status-text">{{ initialized ? 'ONLINE' : (initError ? 'UNAVAILABLE' : 'OFFLINE') }}</span>
      <span class="spacer"></span>
      <span class="meta-chip" v-if="probeResult">probe: {{ probeResult.available ? `✓ ${probeResult.latency?.toFixed(0)}ms` : '✗' }}</span>
      <span class="meta-chip">{{ entryCount }} entries</span>
      <span class="meta-chip" v-if="quota">{{ formatBytes(quota.used) }}</span>
    </div>

    <div class="error-banner" v-if="initError">
      ⚠ {{ initError }} — OPFS requires a secure context (HTTPS / localhost) and may be unavailable in some browsers/private modes.
    </div>

    <div class="quota-bar-wrap" v-if="quota">
      <div class="quota-bar">
        <div class="quota-fill opfs-fill" :style="{ width: Math.min(ratioPercent, 100) + '%' }"></div>
      </div>
      <span class="quota-label">{{ formatBytes(quota.used) }} / {{ formatBytes(quota.available + quota.used) }} — {{ ratioPercent }}%</span>
    </div>

    <div class="panel-body">
      <!-- ── LEFT COL ─────────────────────────────────────────────── -->
      <div class="ops-col">

        <!-- WRITE -->
        <section class="op-section">
          <h3 class="op-title"><span class="op-verb write">WRITE</span></h3>
          <label class="field-label">Canonical Key (domain:platform:ver:module:key)</label>
          <input class="field-input" v-model="writeKey" />
          <label class="field-label">Payload (JSON → serialized string)</label>
          <textarea class="field-textarea" v-model="writePayload" rows="3"></textarea>
          <div class="row-2">
            <div><label class="field-label">Weight</label><input class="field-input small" type="number" v-model.number="writeWeight" min="0" /></div>
            <div><label class="field-label">TTL ms</label><input class="field-input small" type="number" v-model.number="writeTtl" placeholder="none" /></div>
          </div>
          <button class="btn btn-write" @click="doWrite" :disabled="loading || !initialized">write() → OPFS file</button>
        </section>

        <!-- BULK WRITE -->
        <section class="op-section">
          <h3 class="op-title"><span class="op-verb bulk">BULK WRITE</span></h3>
          <div class="row-2">
            <div><label class="field-label">Count</label><input class="field-input small" type="number" v-model.number="bulkCount" min="1" max="500" /></div>
            <div><label class="field-label">Key prefix</label><input class="field-input small" v-model="bulkPrefix" /></div>
          </div>
          <button class="btn btn-bulk" @click="doBulkWrite" :disabled="loading || !initialized">stress write {{ bulkCount }}x</button>
        </section>

        <!-- READ -->
        <section class="op-section">
          <h3 class="op-title"><span class="op-verb read">READ</span></h3>
          <input class="field-input" v-model="readKey" />
          <button class="btn btn-read" @click="doRead" :disabled="loading || !initialized">read()</button>
          <div class="read-result" v-if="readResult !== 'idle'">
            <span class="result-label">Payload:</span>
            <pre class="result-pre">{{ readResult === null ? 'null (miss / expired)' : (() => { try { return JSON.stringify(JSON.parse(readResult.payload), null, 2) } catch { return readResult.payload } })() }}</pre>
            <div v-if="readResult" class="result-meta">
              schema_v={{ readResult.schema_version }} · weight={{ readResult.weight }} · written={{ new Date(readResult.written_at).toLocaleTimeString() }}
            </div>
          </div>
        </section>

        <!-- DELETE -->
        <section class="op-section">
          <h3 class="op-title"><span class="op-verb delete">DELETE</span></h3>
          <input class="field-input" v-model="deleteKey" />
          <button class="btn btn-delete" @click="doDelete" :disabled="loading || !initialized">delete() → removes file + manifest entry</button>
        </section>

        <!-- CLEAR -->
        <section class="op-section">
          <h3 class="op-title"><span class="op-verb clear">CLEAR</span></h3>
          <label class="field-label">Prefix (empty = full clear ⚠)</label>
          <input class="field-input" v-model="clearPrefix" />
          <button class="btn btn-delete" @click="doClear" :disabled="loading || !initialized">clear()</button>
        </section>

        <!-- EVICT -->
        <section class="op-section">
          <h3 class="op-title"><span class="op-verb evict">EVICT</span></h3>
          <div class="row-2">
            <div><label class="field-label">Target bytes</label><input class="field-input small" type="number" v-model.number="evictTarget" /></div>
            <div>
              <label class="field-label">Policy</label>
              <select class="field-select" v-model="evictPolicy">
                <option value="lru">LRU</option>
                <option value="lfu">LFU</option>
                <option value="fifo">FIFO</option>
              </select>
            </div>
          </div>
          <button class="btn btn-evict" @click="doEvict" :disabled="loading || !initialized">evict()</button>
        </section>

        <!-- FILE UPLOAD -->
        <section class="op-section">
          <h3 class="op-title"><span class="op-verb upload">UPLOAD FILE</span></h3>
          <label class="field-label">Storage Key</label>
          <input class="field-input" v-model="fileKey" />
          <label class="field-label">File (base64-encoded into payload)</label>
          <input class="field-input" type="file" @change="handleFileChange" />
          <button class="btn btn-upload" @click="doUploadFile" :disabled="loading || !initialized || !fileUpload">write file to OPFS</button>
        </section>

        <!-- TRANSACTION BUILDER -->
        <section class="op-section tx-section">
          <h3 class="op-title"><span class="op-verb tx">WAL TRANSACTION</span></h3>
          <div class="tx-note">Ops buffered → WAL written → applied → manifest updated → WAL cleared</div>
          <div class="row-2">
            <div><label class="field-label">Op</label><select class="field-select" v-model="txOpType"><option value="write">write</option><option value="delete">delete</option></select></div>
            <div><label class="field-label">Key</label><input class="field-input" v-model="txOpKey" /></div>
          </div>
          <div v-if="txOpType === 'write'">
            <label class="field-label">Payload</label>
            <input class="field-input" v-model="txOpPayload" />
          </div>
          <button class="btn btn-tx-add" @click="addTxOp">+ add op</button>
          <div class="tx-queue" v-if="txOps.length">
            <div class="tx-op-row" v-for="(op, i) in txOps" :key="i">
              <span class="tx-badge" :class="op.op">{{ op.op }}</span>
              <span class="tx-key">{{ op.key.split(':').slice(-2).join(':') }}</span>
              <button class="tx-remove" @click="removeTxOp(i)">✕</button>
            </div>
          </div>
          <div class="row-2" v-if="txOps.length">
            <button class="btn btn-write" @click="commitTx" :disabled="loading || !initialized">commit()</button>
            <button class="btn btn-delete" @click="rollbackTx" :disabled="loading || !initialized">rollback()</button>
          </div>
        </section>
      </div>

      <!-- ── RIGHT COL ─────────────────────────────────────────────── -->
      <div class="info-col">
        <!-- Query + Entries -->
        <section class="op-section entries-section">
          <div class="section-header-row">
            <h3 class="op-title"><span class="op-verb read">ENTRIES</span></h3>
            <div class="row-inline">
              <input class="field-input small-inline" v-model="queryPrefix" placeholder="prefix filter" />
              <button class="btn btn-sm btn-read" @click="doQuery" :disabled="loading || !initialized">refresh</button>
            </div>
          </div>
          <div class="entries-table-wrap">
            <table class="entries-table" v-if="entries.length">
              <thead>
                <tr>
                  <th>Key (…:module:key)</th>
                  <th>size</th>
                  <th>wt</th>
                  <th>expires</th>
                  <th>filePath</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="e in entries" :key="e.key">
                  <td class="key-cell" :title="e.key">{{ e.key.split(':').slice(-2).join(':') }}</td>
                  <td>{{ e.envelope.payload ? formatBytes(getEncoder().encode(e.envelope.payload).length) : '?' }}</td>
                  <td>{{ e.envelope.weight }}</td>
                  <td>{{ e.envelope.expires_at ? new Date(e.envelope.expires_at).toLocaleTimeString() : '∞' }}</td>
                  <td class="path-cell">{{ e.key.replace(/:/g, '/') }}</td>
                </tr>
              </tbody>
            </table>
            <div class="empty-state" v-else>no entries — run write() or refresh</div>
          </div>
        </section>

        <!-- Op Log -->
        <section class="log-section">
          <h3 class="op-title">OP LOG <span class="log-count">({{ opLog.length }})</span></h3>
          <div class="log-scroll">
            <div class="log-row" v-for="(l, i) in opLog" :key="i" :class="l.status">
              <span class="log-ts">{{ l.ts }}</span>
              <span class="log-op">{{ l.op }}</span>
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
.panel-badge { font-family: var(--mono); font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 3px; letter-spacing: 1px; }
.panel-badge.opfs { background: #ff9f30; color: #000; }
.panel-title { font-size: 15px; font-weight: 700; margin: 0; }
.status-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.status-dot.active   { background: #00ff88; box-shadow: 0 0 6px #00ff88; }
.status-dot.inactive { background: #555; }
.status-dot.error    { background: #ff4f64; box-shadow: 0 0 6px #ff4f64; }
.status-text { font-family: var(--mono); font-size: 11px; color: var(--muted); }
.spacer { flex: 1; }
.meta-chip { font-family: var(--mono); font-size: 11px; background: var(--chip-bg); padding: 3px 10px; border-radius: 20px; color: var(--muted); }
.error-banner { background: #ff4f6415; border-bottom: 1px solid #ff4f6433; padding: 10px 20px; font-family: var(--mono); font-size: 12px; color: #ff7a8a; }
.quota-bar-wrap { display: flex; align-items: center; gap: 10px; padding: 8px 20px; background: var(--panel-header-bg); border-bottom: 1px solid var(--border); }
.quota-bar { flex: 1; height: 4px; background: var(--border); border-radius: 2px; overflow: hidden; }
.quota-fill { height: 100%; border-radius: 2px; transition: width 0.4s; }
.opfs-fill { background: linear-gradient(90deg, #ff9f30, #ffcc44); }
.quota-label { font-family: var(--mono); font-size: 10px; color: var(--muted); white-space: nowrap; }

.panel-body { display: grid; grid-template-columns: 1fr 1fr; gap: 0; }
.ops-col { padding: 16px; display: flex; flex-direction: column; gap: 12px; border-right: 1px solid var(--border); overflow-y: auto; max-height: 80vh; }
.info-col { padding: 16px; display: flex; flex-direction: column; gap: 12px; overflow-y: auto; max-height: 80vh; }

.op-section { background: var(--section-bg); border: 1px solid var(--border); border-radius: 8px; padding: 12px; display: flex; flex-direction: column; gap: 8px; }
.op-title { margin: 0; font-size: 12px; font-weight: 700; font-family: var(--mono); color: var(--muted); display: flex; align-items: center; gap: 8px; }
.op-verb { padding: 2px 8px; border-radius: 3px; font-size: 10px; letter-spacing: 1px; }
.op-verb.write  { background: #00c89622; color: #00c896; border: 1px solid #00c89633; }
.op-verb.bulk   { background: #ffcc4422; color: #ffcc44; border: 1px solid #ffcc4433; }
.op-verb.read   { background: #4fa3ff22; color: #4fa3ff; border: 1px solid #4fa3ff33; }
.op-verb.delete { background: #ff4f6422; color: #ff4f64; border: 1px solid #ff4f6433; }
.op-verb.clear  { background: #ff9f3022; color: #ff9f30; border: 1px solid #ff9f3033; }
.op-verb.evict  { background: #c084fc22; color: #c084fc; border: 1px solid #c084fc33; }
.op-verb.upload { background: #facc1522; color: #facc15; border: 1px solid #facc1533; }
.op-verb.tx     { background: #f472b622; color: #f472b6; border: 1px solid #f472b633; }

.field-label { font-family: var(--mono); font-size: 10px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.5px; }
.field-input, .field-textarea, .field-select {
  background: var(--input-bg); border: 1px solid var(--border);
  color: var(--text); border-radius: 5px; padding: 7px 10px;
  font-family: var(--mono); font-size: 12px; width: 100%; box-sizing: border-box; transition: border-color 0.2s;
}
.field-input:focus, .field-textarea:focus, .field-select:focus { outline: none; border-color: var(--accent-opfs); }
.field-textarea { resize: vertical; min-height: 60px; }
.field-input.small { width: 100%; }
.small-inline { flex: 1; min-width: 0; }
.row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.row-inline { display: flex; gap: 6px; align-items: center; }

.btn { padding: 8px 14px; border-radius: 5px; border: 1px solid transparent; font-family: var(--mono); font-size: 12px; cursor: pointer; font-weight: 600; transition: all 0.15s; letter-spacing: 0.5px; }
.btn:disabled { opacity: 0.4; cursor: not-allowed; }
.btn-write  { background: #00c89622; color: #00c896; border-color: #00c89644; }
.btn-write:hover:not(:disabled)  { background: #00c89633; }
.btn-read   { background: #4fa3ff22; color: #4fa3ff; border-color: #4fa3ff44; }
.btn-read:hover:not(:disabled)   { background: #4fa3ff33; }
.btn-delete { background: #ff4f6422; color: #ff4f64; border-color: #ff4f6444; }
.btn-delete:hover:not(:disabled) { background: #ff4f6433; }
.btn-evict  { background: #c084fc22; color: #c084fc; border-color: #c084fc44; }
.btn-evict:hover:not(:disabled)  { background: #c084fc33; }
.btn-upload { background: #facc1522; color: #facc15; border-color: #facc1544; }
.btn-upload:hover:not(:disabled) { background: #facc1533; }
.btn-bulk   { background: #ffcc4422; color: #ffcc44; border-color: #ffcc4444; }
.btn-bulk:hover:not(:disabled)   { background: #ffcc4433; }
.btn-tx-add { background: #f472b622; color: #f472b6; border-color: #f472b644; font-size: 11px; padding: 5px 10px; }
.btn-sm     { font-size: 11px; padding: 4px 10px; }

.tx-note { font-family: var(--mono); font-size: 10px; color: var(--muted); background: var(--input-bg); padding: 6px 8px; border-radius: 4px; line-height: 1.4; }
.tx-queue { display: flex; flex-direction: column; gap: 4px; max-height: 100px; overflow-y: auto; }
.tx-op-row { display: flex; align-items: center; gap: 6px; background: var(--input-bg); border-radius: 4px; padding: 4px 8px; font-family: var(--mono); font-size: 11px; }
.tx-badge { padding: 1px 6px; border-radius: 3px; font-size: 10px; font-weight: 700; }
.tx-badge.write  { background: #00c89622; color: #00c896; }
.tx-badge.delete { background: #ff4f6422; color: #ff4f64; }
.tx-key { color: var(--accent-opfs); flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tx-remove { background: none; border: none; color: var(--muted); cursor: pointer; font-size: 12px; }
.tx-remove:hover { color: #ff4f64; }

.read-result { background: var(--input-bg); border: 1px solid var(--border); border-radius: 5px; padding: 8px; }
.result-label { font-family: var(--mono); font-size: 10px; color: var(--muted); }
.result-pre { font-family: var(--mono); font-size: 11px; margin: 4px 0 0; color: var(--text); white-space: pre-wrap; word-break: break-all; max-height: 120px; overflow-y: auto; }
.result-meta { font-family: var(--mono); font-size: 10px; color: var(--muted); margin-top: 4px; }

.section-header-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.entries-section { flex: 1; }
.entries-table-wrap { overflow-x: auto; max-height: 240px; overflow-y: auto; }
.entries-table { width: 100%; border-collapse: collapse; font-family: var(--mono); font-size: 11px; }
.entries-table th { color: var(--muted); text-align: left; padding: 4px 8px; border-bottom: 1px solid var(--border); position: sticky; top: 0; background: var(--section-bg); font-weight: 600; }
.entries-table td { padding: 4px 8px; border-bottom: 1px solid var(--border-subtle); vertical-align: top; }
.entries-table tr:hover td { background: var(--row-hover); }
.key-cell  { color: var(--accent-opfs); max-width: 100px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.path-cell { color: var(--muted); font-size: 10px; max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.empty-state { font-family: var(--mono); font-size: 12px; color: var(--muted); text-align: center; padding: 20px; }

.log-section { flex: 1; }
.log-count { color: var(--muted); font-weight: 400; }
.log-scroll { height: 280px; overflow-y: auto; display: flex; flex-direction: column; gap: 2px; }
.log-row { display: flex; gap: 8px; align-items: baseline; padding: 3px 6px; border-radius: 4px; font-family: var(--mono); font-size: 11px; }
.log-row.ok   { background: #00c89608; }
.log-row.err  { background: #ff4f6408; }
.log-row.info { background: #4fa3ff08; }
.log-ts     { color: var(--muted); font-size: 10px; flex-shrink: 0; }
.log-op     { font-weight: 700; flex-shrink: 0; min-width: 80px; }
.log-detail { color: var(--muted); flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.log-row.ok .log-op   { color: #00c896; }
.log-row.err .log-op  { color: #ff4f64; }
.log-row.info .log-op { color: #4fa3ff; }
</style>
