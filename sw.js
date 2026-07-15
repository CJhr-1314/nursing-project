var CACHE_NAME = 'nursing-quiz-v2';
var urlsToCache = ['index.html','app.js','questions_data.js','manifest.json','https://unpkg.com/vue@3/dist/vue.global.prod.js'];

self.addEventListener('install',function(e){e.waitUntil(caches.open(CACHE_NAME).then(function(cache){return cache.addAll(urlsToCache)}))});
self.addEventListener('fetch',function(e){e.respondWith(caches.match(e.request).then(function(r){return r||fetch(e.request)}))});
