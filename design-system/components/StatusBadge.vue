<script setup lang="ts">
import { computed } from 'vue'
type Status = 'neutral' | 'success' | 'warning' | 'danger' | 'info'
const props = withDefaults(defineProps<{ status?: Status; size?: 'sm' | 'md' }>(), { status: 'neutral', size: 'md' })
const classes = computed(() => [
  'inline-flex items-center rounded-full font-medium whitespace-nowrap',
  props.size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm',
  { neutral: 'bg-gray-100 text-gray-700', success: 'bg-emerald-50 text-eh-status-success', warning: 'bg-amber-50 text-eh-status-warning', danger: 'bg-red-50 text-eh-status-danger', info: 'bg-sky-50 text-eh-primary' }[props.status]
])
</script>
<template><span :class="classes" role="status"><slot /></span></template>
