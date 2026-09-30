/* عامل الخدمة: يعمل جدولي دون اتصال */
const CACHE = 'jadwali4-v12';
const FILES = ['./', "css/app.css","img/apple-touch-icon.png","img/developer.webp","img/favicon.svg","img/icon-192.png","img/icon-512.png","index.html","js/assistant.js","js/curriculum.js","js/cur/basic.js","js/cur/g11.js","js/cur/g12.js","js/cur/extra.js","js/forms.js","js/icons.js","js/logic.js","js/scan.js","js/main.js","js/palette.js","js/parts.js","js/science-data.js","js/store.js","js/timer.js","js/ui.js","js/util.js","js/views/focus.js","js/views/friends.js","js/views/grades.js","js/views/notes.js","js/views/planner.js","js/views/science.js","js/views/settings.js","js/views/stats.js","js/views/tasks.js","js/views/today.js","js/views/week.js","manifest.webmanifest"];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== CACHE).map(x => caches.delete(x)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.pathname.includes('/api/')) return;
  // الشبكة أولاً ثم النسخة المخزنة
  e.respondWith(fetch(e.request).then(r => { if (r.ok && u.origin === location.origin) { const c = r.clone(); caches.open(CACHE).then(x => x.put(e.request, c)); } return r; }).catch(() => caches.match(e.request).then(r => r || caches.match('./'))));
});
