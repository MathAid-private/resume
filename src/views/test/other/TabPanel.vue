<script lang="ts" setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useGlobalStore } from '@/composables/managers/global/global.store'
import { useTabStore } from '@/composables/managers/global/tab/tab-store'

// ─── Stores ────────────────────────────────────────────────────────────────────
const globalStore = useGlobalStore()
const tabStore = useTabStore()

// ─── State ─────────────────────────────────────────────────────────────────────
const eventLog = ref<Array<{ ts: string; event: string; detail: string; kind: 'tab' | 'page' | 'strategy' | 'err' }>>([])
const now = ref(Date.now())
let ticker: ReturnType<typeof setInterval>

// ─── Computed ──────────────────────────────────────────────────────────────────
const tabCount = computed(() => tabStore.count)
const strategy = computed(() => {
  const s = globalStore.support
  if (s.workers?.shared?.native) return 'SharedWorker'
  if (s.notification?.broadcastChannel?.native) return 'BroadcastChannel'
  return 'localStorage'
})
const strategyColor = computed(() => {
  if (strategy.value === 'SharedWorker') return '#00c896'
  if (strategy.value === 'BroadcastChannel') return '#4fa3ff'
  return '#ff9f30'
})
const support = computed(() => globalStore.support)
const ua = computed(() => globalStore.support.userAgent)
const tabId = computed(() => {
  try {
    const nameId = window.name
    const storageId = sessionStorage.getItem('latest_tab_id')
    return (nameId && nameId === storageId) ? nameId : '(pending)'
  } catch { return 'N/A' }
})
const isSingle = computed(() => tabCount.value === 1)
const uptime = computed(() => {
  const secs = Math.floor((now.value - mountedAt) / 1000)
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${m}m ${s}s`
})

let mountedAt = Date.now()

function ts() { return new Date().toISOString().split('T')[1].split('Z')[0] }
function log(event: string, detail: string, kind: 'tab' | 'page' | 'strategy' | 'err' = 'tab') {
  eventLog.value.unshift({ ts: ts(), event, detail, kind })
  if (eventLog.value.length > 60) eventLog.value.pop()
}

// ─── Page event listeners (just for observation) ──────────────────────────────
function onPageShow(e: PageTransitionEvent) {
  log('pageshow', e.persisted ? 'restored from BFCache' : 'initial load', 'page')
}
function onPageHide(e: PageTransitionEvent) {
  log('pagehide', e.persisted ? 'going to BFCache' : 'navigating away', 'page')
}
function onVisibilityChange() {
  log('visibilitychange', document.visibilityState, 'page')
}

// ─── Capability flags ─────────────────────────────────────────────────────────
const caps = computed(() => [
  { label: 'SharedWorker', value: support.value.workers?.shared?.native, color: '#00c896' },
  { label: 'ServiceWorker', value: support.value.workers?.service?.native, color: '#4fa3ff' },
  { label: 'WebWorker', value: support.value.workers?.web?.native, color: '#c084fc' },
  { label: 'BroadcastChannel', value: support.value.notification?.broadcastChannel?.native, color: '#facc15' },
])

onMounted(() => {
  mountedAt = Date.now()
  ticker = setInterval(() => { now.value = Date.now() }, 1000)
  window.addEventListener('pageshow', onPageShow)
  window.addEventListener('pagehide', onPageHide)
  document.addEventListener('visibilitychange', onVisibilityChange)

  log('mount', `strategy selected: ${strategy.value}`, 'strategy')
  log('tabId', tabId.value, 'tab')

  // Watch tab count changes
  let lastCount = tabStore.count
  const unwatch = setInterval(() => {
    if (tabStore.count !== lastCount) {
      log('count-change', `${lastCount} → ${tabStore.count}`, 'tab')
      lastCount = tabStore.count
    }
  }, 200)
  onUnmounted(() => clearInterval(unwatch))
})

onUnmounted(() => {
  clearInterval(ticker)
  window.removeEventListener('pageshow', onPageShow)
  window.removeEventListener('pagehide', onPageHide)
  document.removeEventListener('visibilitychange', onVisibilityChange)
})
</script>

<template>
  <div class="tab-panel">
    <div class="panel-header">
      <span class="panel-badge tab-badge">TABS</span>
      <h2 class="panel-title">Tab Count Manager</h2>
      <span class="strategy-pill" :style="{ background: strategyColor + '22', color: strategyColor, borderColor: strategyColor + '44' }">
        {{ strategy }}
      </span>
      <span class="spacer"></span>
      <span class="uptime-chip">uptime {{ uptime }}</span>
    </div>

    <div class="tab-body">
      <!-- ── BIG COUNT ───────────────────────────────────────────── -->
      <div class="count-section">
        <div class="count-display" :class="{ single: isSingle, multi: !isSingle }">
          <div class="count-number">{{ tabCount }}</div>
          <div class="count-label">{{ isSingle ? 'tab open (just you)' : 'tabs open' }}</div>
        </div>
        <div class="single-badge" :class="{ active: isSingle }">
          {{ isSingle ? '● isSingle() = true' : '○ isSingle() = false' }}
        </div>
        <div class="pulse-ring" :class="{ pulse: tabCount > 0 }"></div>
      </div>

      <div class="meta-grid">
        <!-- TAB ID -->
        <div class="meta-card">
          <div class="meta-card-label">This Tab ID</div>
          <div class="meta-card-value mono small-text">{{ tabId }}</div>
          <div class="meta-card-sub">window.name + sessionStorage</div>
        </div>

        <!-- STRATEGY -->
        <div class="meta-card strategy-card">
          <div class="meta-card-label">Strategy</div>
          <div class="meta-card-value" :style="{ color: strategyColor }">{{ strategy }}</div>
          <div class="meta-card-sub">selected at preInitialize()</div>
        </div>

        <!-- BROWSER -->
        <div class="meta-card">
          <div class="meta-card-label">Browser</div>
          <div class="meta-card-value">{{ ua ? `${ua.name} ${ua.version}` : '…' }}</div>
          <div class="meta-card-sub">{{ ua?.engine }} · {{ ua?.os }}</div>
        </div>

        <!-- IS BRAVE -->
        <div class="meta-card">
          <div class="meta-card-label">Browser Flags</div>
          <div class="meta-card-value">
            <span :class="ua?.mobile ? 'flag-on' : 'flag-off'">mobile</span>
            <span :class="ua?.isBrave ? 'flag-on' : 'flag-off'">brave</span>
          </div>
          <div class="meta-card-sub">{{ ua?.kind || '—' }}</div>
        </div>
      </div>

      <!-- CAPABILITY TABLE -->
      <div class="cap-section">
        <h3 class="section-label">Browser Capabilities</h3>
        <div class="cap-grid">
          <div class="cap-row" v-for="cap in caps" :key="cap.label">
            <span class="cap-dot" :style="{ background: cap.value ? cap.color : '#444', boxShadow: cap.value ? `0 0 6px ${cap.color}` : 'none' }"></span>
            <span class="cap-label">{{ cap.label }}</span>
            <span class="cap-value" :style="{ color: cap.value ? cap.color : '#666' }">
              {{ cap.value === undefined ? 'detecting…' : (cap.value ? 'available' : 'unavailable') }}
            </span>
          </div>
        </div>
      </div>

      <!-- STRATEGY DECISION TREE -->
      <div class="tree-section">
        <h3 class="section-label">Strategy Selection Tree</h3>
        <div class="tree">
          <div class="tree-node" :class="{ active: strategy === 'SharedWorker' }">
            <span class="tree-q">SharedWorker available?</span>
            <span class="tree-arrow">→</span>
            <span class="tree-result worker">useWorkerStrategy</span>
          </div>
          <div class="tree-branch">↓ NO</div>
          <div class="tree-node" :class="{ active: strategy === 'BroadcastChannel' }">
            <span class="tree-q">BroadcastChannel available?</span>
            <span class="tree-arrow">→</span>
            <span class="tree-result broadcast">useBroadcastStrategy</span>
          </div>
          <div class="tree-branch">↓ NO</div>
          <div class="tree-node" :class="{ active: strategy === 'localStorage' }">
            <span class="tree-q">fallback</span>
            <span class="tree-arrow">→</span>
            <span class="tree-result sequential">useSequentialStrategy</span>
          </div>
        </div>
      </div>

      <!-- EVENT LOG -->
      <div class="log-section">
        <h3 class="section-label">Event Log <span class="log-count">({{ eventLog.length }})</span></h3>
        <div class="log-scroll">
          <div class="log-row" v-for="(l, i) in eventLog" :key="i" :class="l.kind">
            <span class="log-ts">{{ l.ts }}</span>
            <span class="log-event">{{ l.event }}</span>
            <span class="log-detail">{{ l.detail }}</span>
          </div>
          <div class="empty-state" v-if="!eventLog.length">events will appear here as they fire</div>
        </div>
      </div>

      <!-- HOW TO TEST -->
      <div class="howto-section">
        <h3 class="section-label">How to Test</h3>
        <ul class="howto-list">
          <li>Open this page in <strong>multiple browser tabs</strong> — count should increment</li>
          <li>Close a tab — count should decrement</li>
          <li>Use the <strong>back/forward buttons</strong> — pageshow/pagehide are tracked</li>
          <li>Open in <strong>private/incognito</strong> — SharedWorker may be unavailable, BroadcastChannel strategy kicks in</li>
          <li>Open in <strong>Safari</strong> — BroadcastChannel or localStorage strategy</li>
          <li>Duplicate a tab (Ctrl+Shift+K or right-click → Duplicate) — new tab ID should be generated</li>
          <li>Refresh the page — same tab ID should be preserved (window.name + sessionStorage agree)</li>
        </ul>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tab-panel { display: flex; flex-direction: column; }
.panel-header {
  display: flex; align-items: center; gap: 10px;
  padding: 12px 20px;
  background: var(--panel-header-bg);
  border-bottom: 1px solid var(--border);
  border-radius: var(--radius) var(--radius) 0 0;
}
.panel-badge { font-family: var(--mono); font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 3px; letter-spacing: 1px; }
.tab-badge { background: #c084fc; color: #000; }
.panel-title { font-size: 15px; font-weight: 700; margin: 0; }
.strategy-pill { font-family: var(--mono); font-size: 11px; padding: 3px 10px; border-radius: 20px; border: 1px solid; font-weight: 700; }
.spacer { flex: 1; }
.uptime-chip { font-family: var(--mono); font-size: 11px; color: var(--muted); background: var(--chip-bg); padding: 3px 10px; border-radius: 20px; }

.tab-body { padding: 20px; display: grid; grid-template-columns: auto 1fr; grid-template-rows: auto auto auto auto; gap: 16px; }

/* Count display takes the first column */
.count-section {
  grid-column: 1; grid-row: 1;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 12px; padding: 24px 32px;
  background: var(--section-bg); border: 1px solid var(--border); border-radius: 12px;
  position: relative; overflow: hidden; min-width: 180px;
}
.count-display { text-align: center; }
.count-number {
  font-size: 72px; font-weight: 900; line-height: 1; font-family: var(--mono);
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.count-display.single .count-number { color: #00ff88; text-shadow: 0 0 30px #00ff8866; }
.count-display.multi .count-number  { color: #4fa3ff; text-shadow: 0 0 30px #4fa3ff66; }
.count-label { font-family: var(--mono); font-size: 12px; color: var(--muted); }
.single-badge {
  font-family: var(--mono); font-size: 11px; padding: 4px 12px; border-radius: 20px;
  border: 1px solid var(--border); color: var(--muted);
  transition: all 0.3s;
}
.single-badge.active { border-color: #00ff88; color: #00ff88; background: #00ff8811; }
.pulse-ring {
  position: absolute; inset: -20px; border-radius: 50%;
  border: 2px solid transparent; pointer-events: none;
}
.pulse-ring.pulse { animation: pulse-anim 2s ease-in-out infinite; border-color: #4fa3ff22; }
@keyframes pulse-anim { 0%,100% { transform: scale(0.95); opacity: 0.5; } 50% { transform: scale(1.05); opacity: 1; } }

/* Meta grid takes second column */
.meta-grid {
  grid-column: 2; grid-row: 1;
  display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px;
  align-content: start;
}
.meta-card {
  background: var(--section-bg); border: 1px solid var(--border);
  border-radius: 8px; padding: 12px; display: flex; flex-direction: column; gap: 4px;
}
.meta-card-label { font-family: var(--mono); font-size: 10px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.5px; }
.meta-card-value { font-family: var(--mono); font-size: 13px; color: var(--text); font-weight: 600; word-break: break-all; }
.meta-card-value.mono { font-size: 11px; }
.small-text { font-size: 10px !important; }
.meta-card-sub { font-family: var(--mono); font-size: 10px; color: var(--muted); }
.flag-on  { background: #00c89622; color: #00c896; padding: 1px 6px; border-radius: 3px; margin-right: 4px; font-size: 11px; }
.flag-off { background: var(--input-bg); color: var(--muted); padding: 1px 6px; border-radius: 3px; margin-right: 4px; font-size: 11px; }

/* Remaining rows span full width */
.cap-section, .tree-section, .log-section, .howto-section {
  grid-column: 1 / -1;
  background: var(--section-bg); border: 1px solid var(--border); border-radius: 8px; padding: 14px;
}
.section-label { margin: 0 0 10px; font-family: var(--mono); font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 1px; }

.cap-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 8px; }
.cap-row { display: flex; align-items: center; gap: 8px; font-family: var(--mono); font-size: 12px; }
.cap-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; transition: all 0.3s; }
.cap-label { color: var(--text); flex: 1; }
.cap-value { font-size: 11px; }

.tree { display: flex; flex-direction: column; gap: 6px; font-family: var(--mono); font-size: 12px; }
.tree-node {
  display: flex; align-items: center; gap: 10px; padding: 8px 12px;
  background: var(--input-bg); border: 1px solid var(--border); border-radius: 6px;
  transition: all 0.3s;
}
.tree-node.active { border-color: #c084fc; background: #c084fc11; }
.tree-q { color: var(--muted); flex: 1; }
.tree-arrow { color: var(--muted); }
.tree-result { padding: 2px 10px; border-radius: 4px; font-weight: 700; font-size: 11px; }
.tree-result.worker     { background: #00c89622; color: #00c896; }
.tree-result.broadcast  { background: #4fa3ff22; color: #4fa3ff; }
.tree-result.sequential { background: #ff9f3022; color: #ff9f30; }
.tree-branch { color: var(--muted); font-size: 11px; padding-left: 12px; }

.log-section { }
.log-count { color: var(--muted); font-weight: 400; }
.log-scroll { height: 180px; overflow-y: auto; display: flex; flex-direction: column; gap: 2px; }
.log-row { display: flex; gap: 8px; align-items: baseline; padding: 3px 6px; border-radius: 4px; font-family: var(--mono); font-size: 11px; }
.log-row.tab      { background: #c084fc08; }
.log-row.page     { background: #4fa3ff08; }
.log-row.strategy { background: #00c89608; }
.log-row.err      { background: #ff4f6408; }
.log-ts    { color: var(--muted); font-size: 10px; flex-shrink: 0; }
.log-event { color: var(--text); font-weight: 700; flex-shrink: 0; min-width: 100px; }
.log-row.tab .log-event      { color: #c084fc; }
.log-row.page .log-event     { color: #4fa3ff; }
.log-row.strategy .log-event { color: #00c896; }
.log-row.err .log-event      { color: #ff4f64; }
.log-detail { color: var(--muted); flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.empty-state { font-family: var(--mono); font-size: 12px; color: var(--muted); text-align: center; padding: 20px; }

.howto-section { }
.howto-list { margin: 0; padding-left: 20px; display: flex; flex-direction: column; gap: 6px; }
.howto-list li { font-family: var(--mono); font-size: 12px; color: var(--muted); line-height: 1.5; }
.howto-list li strong { color: var(--text); }
</style>
