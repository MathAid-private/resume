<script lang="ts" setup>
import { ref, computed } from 'vue'
import MemoryPanel from './MemoryPanel.vue'
import OPFSPanel from './OpfsPanel.vue'
import TabPanel from './TabPanel.vue'

// ─── Tab navigation ───────────────────────────────────────────────────────────
type TabId = 'memory' | 'opfs' | 'tabs'
const activeTab = ref<TabId>('memory')

const tabs: Array<{ id: TabId; label: string; badge: string; color: string; desc: string }> = [
  { id: 'memory', label: 'Memory Backend', badge: 'MEM', color: '#00c896', desc: 'In-process Map — no persistence, best-effort transactions' },
  { id: 'opfs',   label: 'OPFS Backend',   badge: 'OPFS', color: '#ff9f30', desc: 'Origin Private File System — WAL-backed compensating transactions' },
  { id: 'tabs',   label: 'Tab Counter',    badge: 'TABS', color: '#c084fc', desc: 'Cross-tab coordination — SharedWorker / BroadcastChannel / localStorage' },
]

const activeTabMeta = computed(() => tabs.find(t => t.id === activeTab.value)!)
</script>

<template>
  <div class="dashboard-root">
    <!-- ── HEADER ────────────────────────────────────────────────────────── -->
    <header class="dash-header">
      <div class="header-left">
        <div class="logo-mark">
          <span class="logo-bracket">[</span>
          <span class="logo-text">STORE</span>
          <span class="logo-bracket">]</span>
          <span class="logo-sub">LAB</span>
        </div>
        <div class="header-desc">
          <div class="header-title">Storage & Tab Manager — Debug Console</div>
          <div class="header-subtitle">Direct backend testing · No facade · No pipeline · Raw stress exposure</div>
        </div>
      </div>
      <div class="header-right">
        <div class="header-pill">Vue 3.5 + Pinia</div>
        <div class="header-pill">TypeScript</div>
        <div class="header-pill">{{ new Date().toLocaleDateString() }}</div>
      </div>
    </header>

    <!-- ── TAB NAV ───────────────────────────────────────────────────────── -->
    <nav class="tab-nav">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        class="tab-nav-btn"
        :class="{ active: activeTab === tab.id }"
        :style="activeTab === tab.id ? { '--tab-color': tab.color } : {}"
        @click="activeTab = tab.id"
      >
        <span class="tab-nav-badge" :style="{ background: tab.color, color: '#000' }">{{ tab.badge }}</span>
        <span class="tab-nav-label">{{ tab.label }}</span>
      </button>
      <div class="tab-nav-desc">{{ activeTabMeta.desc }}</div>
    </nav>

    <!-- ── PANEL ────────────────────────────────────────────────────────── -->
    <main class="panel-wrapper">
      <MemoryPanel v-if="activeTab === 'memory'" />
      <OPFSPanel   v-else-if="activeTab === 'opfs'" />
      <TabPanel    v-else-if="activeTab === 'tabs'" />
    </main>
  </div>
</template>

<style>
/* ── Global design tokens (scoped to dashboard-root to avoid pollution) ── */
.dashboard-root {
  /* Colors */
  --bg: #0a0c10;
  --surface: #111419;
  --panel-header-bg: #13171e;
  --section-bg: #111419;
  --input-bg: #0d1117;
  --border: #1e2430;
  --border-subtle: #161b24;
  --text: #e2e8f2;
  --muted: #566072;
  --chip-bg: #1a1f2a;
  --row-hover: #181d28;
  --accent: #4fa3ff;
  --accent-opfs: #ff9f30;
  --radius: 10px;

  /* Typography */
  --mono: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Source Code Pro', 'Consolas', monospace;
  --sans: 'Geist', 'Outfit', 'DM Sans', system-ui, sans-serif;

  /* Font imports */
  font-family: var(--sans);
  background: var(--bg);
  color: var(--text);
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}
</style>

<style scoped>
.dashboard-root {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

/* ── Header ─────────────────────────────────────────────────────────────── */
.dash-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  gap: 16px;
  flex-shrink: 0;
  position: relative;
}
.dash-header::after {
  content: '';
  position: absolute;
  bottom: 0; left: 0; right: 0;
  height: 1px;
  background: linear-gradient(90deg, #00c89633, #4fa3ff33, #c084fc33, #ff9f3033);
}
.header-left { display: flex; align-items: center; gap: 16px; }
.logo-mark {
  display: flex; align-items: baseline; gap: 2px;
  font-family: var(--mono); font-weight: 900;
}
.logo-bracket { color: #4fa3ff; font-size: 24px; }
.logo-text { color: #e2e8f2; font-size: 22px; letter-spacing: 2px; }
.logo-sub {
  font-size: 10px; font-weight: 700; color: #000;
  background: #00c896; padding: 2px 5px; border-radius: 3px;
  letter-spacing: 1px; margin-left: 4px;
}
.header-title { font-size: 14px; font-weight: 700; color: var(--text); }
.header-subtitle { font-family: var(--mono); font-size: 11px; color: var(--muted); margin-top: 2px; }
.header-right { display: flex; gap: 8px; align-items: center; }
.header-pill {
  font-family: var(--mono); font-size: 10px; color: var(--muted);
  background: var(--chip-bg); border: 1px solid var(--border);
  padding: 4px 10px; border-radius: 20px;
}

/* ── Tab nav ─────────────────────────────────────────────────────────────── */
.tab-nav {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 12px 20px;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.tab-nav-btn {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 16px; border-radius: 8px;
  background: none; border: 1px solid var(--border);
  color: var(--muted); cursor: pointer; font-family: var(--sans);
  font-size: 13px; font-weight: 600; transition: all 0.2s;
}
.tab-nav-btn:hover { background: var(--chip-bg); color: var(--text); border-color: #2d3748; }
.tab-nav-btn.active {
  background: color-mix(in srgb, var(--tab-color) 10%, transparent);
  border-color: color-mix(in srgb, var(--tab-color) 40%, transparent);
  color: var(--tab-color);
}
.tab-nav-badge {
  font-family: var(--mono); font-size: 10px; font-weight: 700;
  padding: 1px 6px; border-radius: 3px; letter-spacing: 1px;
}
.tab-nav-label { white-space: nowrap; }
.tab-nav-desc {
  margin-left: auto;
  font-family: var(--mono); font-size: 11px; color: var(--muted);
  font-style: italic;
}

/* ── Panel ───────────────────────────────────────────────────────────────── */
.panel-wrapper {
  flex: 1;
  overflow: hidden;
  background: var(--bg);
}
.panel-wrapper > * {
  height: 100%;
  border-radius: 0;
}

/* Scrollbar styling */
:deep(*::-webkit-scrollbar) { width: 4px; height: 4px; }
:deep(*::-webkit-scrollbar-track) { background: transparent; }
:deep(*::-webkit-scrollbar-thumb) { background: var(--border); border-radius: 2px; }
:deep(*::-webkit-scrollbar-thumb:hover) { background: #2d3748; }
</style>
