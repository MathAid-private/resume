<script lang="ts" setup>
import { ref, computed } from 'vue'
import type { Platform } from '@/composables/managers/storage/storage.types'
import { buildCanonicalKey } from '@/composables/managers/storage/storage.util'

const PLATFORMS: Platform[] = [
  'android','ios','win','unix','mac',
  'safari','chrome','edge','firefox','opera','browser','iot'
]

const domain          = ref('testapp')
const platform        = ref<Platform>('browser')
const platformVersion = ref(1)
const callingModule   = ref('dashboard')
const actualKey       = ref('')

const canonical = computed(() => {
  if (!actualKey.value.trim()) return ''
  try {
    return buildCanonicalKey({
      domain:          domain.value,
      platform:        platform.value,
      platformVersion: platformVersion.value,
      callingModule:   callingModule.value,
      actualKey:       actualKey.value,
    })
  } catch {
    return ''
  }
})

defineExpose({ canonical })

const emit = defineEmits<{ (e: 'update:canonical', val: string): void }>()

import { watch } from 'vue'
watch(canonical, v => emit('update:canonical', v))
</script>

<template>
  <div class="key-builder">
    <div class="key-row">
      <label>domain</label>
      <input v-model="domain" placeholder="testapp" />
    </div>
    <div class="key-row">
      <label>platform</label>
      <select v-model="platform">
        <option v-for="p in PLATFORMS" :key="p" :value="p">{{ p }}</option>
      </select>
    </div>
    <div class="key-row">
      <label>version</label>
      <input v-model.number="platformVersion" type="number" min="0" />
    </div>
    <div class="key-row">
      <label>module</label>
      <input v-model="callingModule" placeholder="dashboard" />
    </div>
    <div class="key-row">
      <label>key</label>
      <input v-model="actualKey" placeholder="my-entry" />
    </div>
    <div class="canonical-preview" :class="{ valid: canonical }">
      <span class="canonical-label">canonical →</span>
      <span class="canonical-value">{{ canonical || '(incomplete)' }}</span>
    </div>
  </div>
</template>

<style scoped>
.key-builder { display: flex; flex-direction: column; gap: 6px; }
.key-row { display: grid; grid-template-columns: 72px 1fr; gap: 8px; align-items: center; }
.key-row label { font-size: 10px; color: var(--muted); text-transform: uppercase; letter-spacing: .08em; text-align: right; }
.canonical-preview {
  margin-top: 4px; padding: 8px 10px; background: var(--bg-2); border: 1px solid var(--border);
  border-radius: 4px; font-family: var(--mono); font-size: 10px; word-break: break-all;
  color: var(--muted);
}
.canonical-preview.valid { border-color: var(--accent); color: var(--accent); }
.canonical-label { color: var(--muted); margin-right: 4px; }
</style>
