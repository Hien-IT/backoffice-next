<script setup lang="ts">
/**
 * Example Reka UI wrapper. Verify exports against the installed Reka UI version.
 */
import { SelectRoot, SelectTrigger, SelectValue, SelectPortal, SelectContent, SelectViewport, SelectItem, SelectItemText } from 'reka-ui'
defineProps<{ modelValue?: string; options: Array<{ label: string; value: string }>; placeholder?: string; disabled?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
</script>
<template>
  <SelectRoot :model-value="modelValue" :disabled="disabled" @update:model-value="value => emit('update:modelValue', String(value))">
    <SelectTrigger class="flex h-9 w-full items-center justify-between rounded-eh-md border border-eh-border bg-white px-eh-4 text-sm text-eh-text-primary outline-none focus-visible:ring-2 focus-visible:ring-eh-primary disabled:opacity-50" aria-label="Select option">
      <SelectValue :placeholder="placeholder || 'Select an option'" /><span aria-hidden="true">⌄</span>
    </SelectTrigger>
    <SelectPortal>
      <SelectContent class="z-50 min-w-[var(--reka-select-trigger-width)] overflow-hidden rounded-eh-md border border-eh-border bg-white p-1 shadow-lg" position="popper">
        <SelectViewport>
          <SelectItem v-for="option in options" :key="option.value" :value="option.value" class="cursor-pointer rounded px-3 py-2 text-sm outline-none data-[highlighted]:bg-sky-50 data-[highlighted]:text-eh-primary data-[disabled]:pointer-events-none data-[disabled]:opacity-50">
            <SelectItemText>{{ option.label }}</SelectItemText>
          </SelectItem>
        </SelectViewport>
      </SelectContent>
    </SelectPortal>
  </SelectRoot>
</template>
