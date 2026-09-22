// Apply the device preference before layout; navigation stays usable if storage is blocked.
try {
  document.documentElement.dataset.sidebar = localStorage.getItem('wtf-sidebar-collapsed') === 'true' ? 'collapsed' : 'expanded';
} catch {}
