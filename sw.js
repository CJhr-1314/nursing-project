
const CACHE_NAME = 'nursing-quiz-v5';
const urlsToCache = ['index.html','app_v2.js','questions_data.js','manifest.json','https://unpkg.com/vue@3/dist/vue.global.prod.js'];

// install: 立即跳过等待，不等旧 SW 释放
self.addEventListener('install', function(e) {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE_NAME).then(function(cache) {
    return cache.addAll(urlsToCache);
  }));
});

// activate: 清空所有旧缓存 + 立即接管所有客户端
self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE_NAME; })
          .map(function(k) { return caches.delete(k); })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

// fetch: network-first — 在线永远拉最新，超时 3s 回落缓存
self.addEventListener('fetch', function(e) {
  e.respondWith(
    fetch(e.request, { signal: AbortSignal.timeout(3000) })
      .then(function(response) {
        // 成功：更新缓存
        var cloned = response.clone();
        caches.open(CACHE_NAME).then(function(cache) {
          cache.put(e.request, cloned);
        });
        return response;
      })
      .catch(function() {
        // 网络失败：回落缓存
        return caches.match(e.request);
      })
  );
});
