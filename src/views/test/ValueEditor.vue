<script lang="ts" setup>
import { ref, computed } from 'vue'

type ValueKind = 'string' | 'number' | 'boolean' | 'object' | 'array' | 'null' | 'file'

const kind    = ref<ValueKind>('string')
const raw     = ref('')
const fileRef = ref<File | null>(null)
const error   = ref('')

const KINDS: ValueKind[] = ['string','number','boolean','object','array','null','file']

function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  fileRef.value = input.files?.[0] ?? null
  raw.value = fileRef.value?.name ?? ''
}

/** Returns { value, isFile, file } or throws */
const parsed = computed<{ value: unknown; isFile: boolean; file: File | null }>(() => {
  error.value = ''
  try {
    if (kind.value === 'null')    return { value: null, isFile: false, file: null }
    if (kind.value === 'file')    return { value: raw.value, isFile: true, file: fileRef.value }
    if (kind.value === 'string')  return { value: raw.value, isFile: false, file: null }
    if (kind.value === 'number') {
      const n = Number(raw.value)
      if (isNaN(n)) throw new Error('Not a number')
      return { value: n, isFile: false, file: null }
    }
    if (kind.value === 'boolean') {
      if (!['true','false'].includes(raw.value.trim())) throw new Error('Use true or false')
      return { value: raw.value.trim() === 'true', isFile: false, file: null }
    }
    if (kind.value === 'object' || kind.value === 'array') {
      return { value: JSON.parse(raw.value), isFile: false, file: null }
    }
    return { value: raw.value, isFile: false, file: null }
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : String(e)
    return { value: undefined, isFile: false, file: null }
  }
})

defineExpose({ parsed, kind, error })
</script>

<template>
  <div class="value-editor">
    <div class="kind-selector">
      <button
        v-for="k in KINDS" :key="k"
        :class="['kind-btn', { active: kind === k }]"
        @click="kind = k"
      >{{ k }}</button>
    </div>

    <div v-if="kind === 'null'" class="null-badge">null</div>

    <div v-else-if="kind === 'file'" class="file-zone">
      <label class="file-label">
        <span>{{ fileRef ? fileRef.name : 'click to select file' }}</span>
        <input type="file" @change="onFileChange" class="file-input" />
      </label>
      <div v-if="fileRef" class="file-meta">
        {{ (fileRef.size / 1024).toFixed(1) }} KB · {{ fileRef.type || 'unknown type' }}
      </div>
    </div>

    <div v-else class="raw-area">
      <textarea
        v-model="raw"
        :placeholder="kind === 'object' ? '{&quot;key&quot;: &quot;value&quot;}' : kind === 'array' ? '[1, 2, 3]' : kind === 'boolean' ? 'true' : 'value'"
        rows="3"
      />
    </div>

    <div v-if="error" class="parse-error">⚠ {{ error }}</div>
  </div>
</template>

<style scoped>
.value-editor { display: flex; flex-direction: column; gap: 8px; }
.kind-selector { display: flex; flex-wrap: wrap; gap: 4px; }
.kind-btn {
  padding: 2px 8px; font-size: 10px; font-family: var(--mono);
  background: var(--bg-2); border: 1px solid var(--border);
  color: var(--muted); border-radius: 3px; cursor: pointer; transition: all .15s;
}
.kind-btn.active { background: var(--accent); border-color: var(--accent); color: #000; }
.kind-btn:hover:not(.active) { border-color: var(--accent); color: var(--fg); }
.null-badge {
  padding: 8px 12px; background: var(--bg-2); border: 1px dashed var(--border);
  border-radius: 4px; font-family: var(--mono); font-size: 12px; color: var(--muted); text-align: center;
}
.raw-area textarea {
  width: 100%; resize: vertical; background: var(--bg-2); border: 1px solid var(--border);
  color: var(--fg); font-family: var(--mono); font-size: 11px; padding: 8px;
  border-radius: 4px; outline: none; box-sizing: border-box;
}
.raw-area textarea:focus { border-color: var(--accent); }
.file-zone { border: 1px dashed var(--border); border-radius: 4px; }
.file-label {
  display: flex; align-items: center; justify-content: center;
  padding: 16px; cursor: pointer; font-size: 11px; color: var(--muted);
  transition: color .15s;
}
.file-label:hover { color: var(--accent); }
.file-input { display: none; }
.file-meta { padding: 4px 12px 8px; font-size: 10px; color: var(--muted); text-align: center; }
.parse-error { font-size: 10px; color: var(--danger); font-family: var(--mono); }
</style>
