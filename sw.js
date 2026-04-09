/* ============================================
COURT SIGHT TENNIS - SERVICE WORKER v2
Con versionado de cache y actualización forzada
============================================ */

// ⚠️ IMPORTANTE: Cambia esta versión cada vez que actualices la app
const CACHE_VERSION = 'v2.2';
const CACHE_NAME = `courtsight-${CACHE_VERSION}`;

const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/styles.css',
    '/app.js',
    '/manifest.json',
    '/logo.png',
    '/fondo-tenis.jpg'
];

// --- INSTALACIÓN: Cachear archivos y forzar actualización ---
self.addEventListener('install', (event) => {
    console.log(`🔧 SW: Instalando ${CACHE_NAME}...`);
    
    // Forzar que el nuevo SW se active inmediatamente
    self.skipWaiting();
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('📦 Cacheando archivos...');
                return cache.addAll(ASSETS_TO_CACHE);
            })
            .then(() => {
                console.log(`✅ ${CACHE_NAME} cacheado correctamente`);
            })
            .catch((error) => {
                console.error('❌ Error al cachear:', error);
            })
    );
});

// --- ACTIVACIÓN: Limpiar caches antiguos y reclamar clientes ---
self.addEventListener('activate', (event) => {
    console.log(`⚡ SW: Activando ${CACHE_NAME}...`);
    
    event.waitUntil(
        // 1. Eliminar todos los caches que NO sean el actual
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames
                        .filter((name) => name !== CACHE_NAME)
                        .map((name) => {
                            console.log('🗑️ Eliminando cache antiguo:', name);
                            return caches.delete(name);
                        })
                );
            })
            .then(() => {
                // 2. Reclamar todas las pestañas abiertas
                console.log('🔄 Reclamando clientes...');
                return self.clients.claim();
            })
            .then(() => {
                console.log(`✅ ${CACHE_NAME} activado y listo`);
            })
    );
});

// --- FETCH: Estrategia Cache First con fallback a red ---
self.addEventListener('fetch', (event) => {
    // Ignorar solicitudes que no sean GET
    if (event.request.method !== 'GET') return;
    
    // Ignorar solicitudes externas (Telegram, APIs, etc.)
    if (!event.request.url.startsWith(self.location.origin)) return;
    
    event.respondWith(
        caches.match(event.request)
            .then((cachedResponse) => {
                if (cachedResponse) {
                    console.log('📂 Cache HIT:', event.request.url);
                    
                    // Actualizar el cache en segundo plano (stale-while-revalidate)
                    fetch(event.request)
                        .then((networkResponse) => {
                            if (networkResponse && networkResponse.status === 200) {
                                caches.open(CACHE_NAME)
                                    .then((cache) => {
                                        cache.put(event.request, networkResponse);
                                    });
                            }
                        })
                        .catch(() => {
                            // Si falla la red, usamos el cache (ya lo tenemos)
                        });
                    
                    return cachedResponse;
                }
                
                console.log('🌐 Cache MISS, obteniendo de red:', event.request.url);
                
                return fetch(event.request)
                    .then((networkResponse) => {
                        if (!networkResponse || networkResponse.status !== 200) {
                            return networkResponse;
                        }
                        
                        const responseToCache = networkResponse.clone();
                        caches.open(CACHE_NAME)
                            .then((cache) => {
                                cache.put(event.request, responseToCache);
                            });
                        
                        return networkResponse;
                    })
                    .catch((error) => {
                        console.error('❌ Error en fetch:', error);
                        
                        // Fallback para navegación (página offline)
                        if (event.request.mode === 'navigate') {
                            return caches.match('/index.html');
                        }
                    });
            })
    );
});

// --- MENSAJE: Permitir que el cliente controle la actualización ---
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
