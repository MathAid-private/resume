<script lang="ts" setup>
import { ref, nextTick } from 'vue'

export type LogEntry = {
  id:      number
  ts:      number
  level:   'info' | 'ok' | 'warn' | 'error'
  op:      string
  message: string
  data?:   unknown
}

const entries = ref<LogEntry[]>([])
const paneRef = ref<HTMLElement | null>(null)
let   counter = 0

async function push(entry: Omit<LogEntry, 'id' | 'ts'>) {
  entries.value.push({ ...entry, id: counter++, ts: Date.now() })
  // Keep last 200
  if (entries.value.length > 200) entries.value.splice(0, entries.value.length - 200)
  await nextTick()
  if (paneRef.value) paneRef.value.scrollTop = paneRef.value.scrollHeight
}

function clear() { entries.value = [] }

function fmt(ts: number) {
  const d = new Date(ts)
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}.${String(d.getMilliseconds()).padStart(3,'0')}`
}

function stringify(val: unknown): string {
  try {
    if (val === undefined) return ''
    const s = JSON.stringify(val, null, 2)
    return s.length > 800 ? s.slice(0, 800) + '\n…' : s
  } catch { return String(val) }
}

defineExpose({ push, clear })
</script>

<template>
  <div class="log-pane">
    <div class="log-header">
      <span class="log-title">operation log</span>
      <span class="log-count">{{ entries.length }} entries</span>
      <button class="clear-btn" @click="clear">clear</button>
    </div>
    <div class="log-entries" ref="paneRef">
      <div v-if="entries.length === 0" class="log-empty">no operations yet</div>
      <div
        v-for="entry in entries"
        :key="entry.id"
        :class="['log-entry', entry.level]"
      >
        <span class="log-ts">{{ fmt(entry.ts) }}</span>
        <span class="log-op">{{ entry.op }}</span>
        <span class="log-msg">{{ entry.message }}</span>
        <pre v-if="entry.data !== undefined" class="log-data">{{ stringify(entry.data) }}</pre>
      </div>
    </div>
  </div>
</template>

<style scoped>
.log-pane {
  display: flex; flex-direction: column; height: 100%; min-height: 0;
  background: var(--bg-1); border: 1px solid var(--border); border-radius: 6px; overflow: hidden;
}
.log-header {
  display: flex; align-items: center; gap: 8px; padding: 8px 12px;
  border-bottom: 1px solid var(--border); background: var(--bg-2); flex-shrink: 0;
}
.log-title { font-size: 10px; text-transform: uppercase; letter-spacing: .1em; color: var(--muted); flex: 1; }
.log-count { font-size: 10px; color: var(--muted); font-family: var(--mono); }
.clear-btn {
  font-size: 9px; padding: 2px 7px; background: transparent; border: 1px solid var(--border);
  color: var(--muted); border-radius: 3px; cursor: pointer; font-family: var(--mono);
}
.clear-btn:hover { border-color: var(--danger); color: var(--danger); }
.log-entries { flex: 1; overflow-y: auto; padding: 8px; display: flex; flex-direction: column; gap: 4px; }
.log-empty { color: var(--muted); font-size: 11px; text-align: center; padding: 20px; }
.log-entry {
  display: grid; grid-template-columns: 90px 80px 1fr;
  font-family: var(--mono); font-size: 10px; gap: 6px; align-items: start;
  padding: 4px 6px; border-radius: 3px; border-left: 2px solid transparent;
}
.log-entry.ok    { border-color: var(--ok);     background: color-mix(in srgb, var(--ok) 6%, transparent); }
.log-entry.error { border-color: var(--danger);  background: color-mix(in srgb, var(--danger) 6%, transparent); }
.log-entry.warn  { border-color: var(--warn);    background: color-mix(in srgb, var(--warn) 6%, transparent); }
.log-entry.info  { border-color: var(--border);  }
.log-ts  { color: var(--muted); font-size: 9px; padding-top: 1px; }
.log-op  { color: var(--accent); font-weight: 600; font-size: 9px; padding-top: 1px; }
.log-msg { color: var(--fg); font-size: 10px; word-break: break-word; grid-column: 3; }
.log-data {
  grid-column: 1 / -1; margin: 4px 0 0; padding: 6px 8px; background: var(--bg-2);
  border-radius: 3px; font-size: 9px; color: var(--muted); white-space: pre-wrap;
  word-break: break-all; max-height: 120px; overflow-y: auto;
}
</style>
