/* Only first-party lesson assets are cached; YouTube remains online. */
importScripts('./precache.js');
const PREFIX=self.CACHE_PREFIX,CACHE=PREFIX+self.BUILD_ID;
self.addEventListener('install',event=>event.waitUntil((async()=>{if(!self.ASSETS.length)throw Error('Build dist before offline installation');const cache=await caches.open(CACHE);await cache.addAll(self.ASSETS.map(path=>new Request(path,{cache:'reload'})));})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{const names=await caches.keys();await Promise.all(names.filter(n=>n.startsWith(PREFIX)&&n!==CACHE).map(n=>caches.delete(n)));/* Existing tabs adopt the worker only after their next normal navigation. */})()));
self.addEventListener('message',event=>{if(event.data?.type==='APPLY_UPDATE')self.skipWaiting();if(event.data?.type==='READINESS')event.source?.postMessage({type:'OFFLINE_READY',version:self.BUILD_ID})});
self.addEventListener('fetch',event=>{if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;event.respondWith((async()=>{const cache=await caches.open(CACHE);const cached=await cache.match(event.request,{ignoreSearch:event.request.mode==='navigate'});if(cached)return cached;if(event.request.mode==='navigate')return await cache.match('./index.html')||fetch(event.request);return fetch(event.request)})())});
