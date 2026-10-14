// Tailwind CSS v3. Merge this theme extension into the app's existing config.
module.exports = {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: { extend: {
    colors: {
      eh: {
        primary: 'var(--eh-color-action-primary)',
        text: { primary: 'var(--eh-color-text-primary)', secondary: 'var(--eh-color-text-secondary)' },
        surface: { DEFAULT: 'var(--eh-color-surface-default)', subtle: 'var(--eh-color-surface-subtle)' },
        border: 'var(--eh-color-border)',
        status: { danger: 'var(--eh-color-status-danger)', warning: 'var(--eh-color-status-warning)', success: 'var(--eh-color-status-success)' }
      }
    },
    spacing: Object.fromEntries(['1','2','3','4','5','6','8','10','12'].map(n => [`eh-${n}`, `var(--eh-spacing-${n})`])),
    borderRadius: { 'eh-sm':'var(--eh-radius-sm)', 'eh-md':'var(--eh-radius-md)', 'eh-lg':'var(--eh-radius-lg)', 'eh-full':'var(--eh-radius-full)' },
    fontFamily: { eh: ['var(--eh-font-family-body)'] },
    fontSize: Object.fromEntries([['xs','xs'],['sm','sm'],['base','base'],['lg','lg'],['xl','xl'],['2xl','2xl'],['3xl','3xl']].map(([k,v]) => [`eh-${k}`, `var(--eh-font-size-${v})`]))
  }},
  plugins: []
};
