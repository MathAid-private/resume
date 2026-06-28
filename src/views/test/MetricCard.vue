<script lang="ts" setup>
defineProps<{
  label: string
  value: string | number
  unit?: string
  variant?: 'default' | 'accent' | 'ok' | 'warn' | 'danger'
}>()
</script>

<template>
  <div :class="['metric-card', variant ?? 'default']">
    <div class="metric-label">{{ label }}</div>
    <div class="metric-value">{{ value }}<span v-if="unit" class="metric-unit">{{ unit }}</span></div>
  </div>
</template>

<style scoped>
.metric-card {
  padding: 10px 14px; background: var(--bg-2); border: 1px solid var(--border);
  border-radius: 5px; min-width: 100px;
}
.metric-card.accent { border-color: var(--accent); }
.metric-card.ok     { border-color: var(--ok); }
.metric-card.warn   { border-color: var(--warn); }
.metric-card.danger { border-color: var(--danger); }
.metric-label { font-size: 9px; text-transform: uppercase; letter-spacing: .1em; color: var(--muted); margin-bottom: 4px; }
.metric-value { font-family: var(--mono); font-size: 20px; font-weight: 700; color: var(--fg); line-height: 1; }
.metric-unit  { font-size: 11px; color: var(--muted); margin-left: 3px; font-weight: 400; }
.metric-card.accent .metric-value { color: var(--accent); }
.metric-card.ok     .metric-value { color: var(--ok); }
.metric-card.warn   .metric-value { color: var(--warn); }
.metric-card.danger .metric-value { color: var(--danger); }
</style>
