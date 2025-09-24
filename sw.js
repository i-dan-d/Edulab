/* ========================================
   EduLab Service Worker
   Basic caching for static assets
   ======================================== */

const CACHE_NAME = 'edulab-v1.0.0';
const STATIC_CACHE_URLS = [
  '/',
  '/index.html',
  '/browse.html',
  '/simulation.html',
  '/teacher-login.html',
  '/teacher-tools.html',
  '/css/styles.css',
  '/css/responsive.css',
  '/css/simulation-embed.css',
  '/css/completion-status.css',
  '/css/teacher-interface.css',
  '/css/loading-states.css',
  '/js/main.js',
  '/js/data-manager.js',
  '/js/content-filter.js',
  '/js/phet-integration.js',
  '/js/simulation-loader.js',
  '/js/completion-tracker.js',
  '/js/progress-display.js',
  '/js/teacher-customization.js',
  '/js/instruction-editor.js',
  '/js/teacher-auth.js',
  '/js/error-handler.js',
  '/js/performance-optimizer.js',
  '/js/card-renderer.js',
  '/js/simulation-browser.js',
  '/data/subjects.json',
  '/data/simulations.json'
];

const DYNAMIC_CACHE_NAME = 'edulab-dynamic-v1.0.0';
const MAX_DYNAMIC_CACHE_SIZE = 50;

/* ========================================
   Service Worker Events
   ======================================== */

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Caching static assets...');
        return cache.addAll(STATIC_CACHE_URLS);
      })
      .then(() => {
        console.log('Static assets cached successfully');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('Failed to cache static assets:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME && cacheName !== DYNAMIC_CACHE_NAME) {
              console.log('Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('Service Worker activated');
        return self.clients.claim();
      })
  );
});

// Fetch event - serve from cache with network fallback
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip external requests (except PhET)
  if (url.origin !== location.origin && !url.hostname.includes('phet.colorado.edu')) {
    return;
  }

  // Different strategies based on request type
  if (isStaticAsset(request)) {
    event.respondWith(cacheFirst(request));
  } else if (isDataRequest(request)) {
    event.respondWith(networkFirst(request));
  } else if (isPhETRequest(request)) {
    event.respondWith(networkOnly(request));
  } else {
    event.respondWith(staleWhileRevalidate(request));
  }
});

// Message event - handle commands from main thread
self.addEventListener('message', (event) => {
  const { data } = event;
  
  if (data.command === 'SKIP_WAITING') {
    self.skipWaiting();
  } else if (data.command === 'GET_CACHE_STATUS') {
    getCacheStatus().then((status) => {
      event.ports[0].postMessage(status);
    });
  } else if (data.command === 'CLEAR_CACHE') {
    clearDynamicCache().then(() => {
      event.ports[0].postMessage({ success: true });
    });
  }
});

/* ========================================
   Caching Strategies
   ======================================== */

/**
 * Cache first strategy - for static assets
 * @param {Request} request - Request object
 * @returns {Promise<Response>} Response
 */
async function cacheFirst(request) {
  try {
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
    
  } catch (error) {
    console.error('Cache first strategy failed:', error);
    return new Response('Offline - Resource not available', {
      status: 503,
      statusText: 'Service Unavailable'
    });
  }
}

/**
 * Network first strategy - for data requests
 * @param {Request} request - Request object
 * @returns {Promise<Response>} Response
 */
async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE_NAME);
      await limitCacheSize(cache, MAX_DYNAMIC_CACHE_SIZE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
    
  } catch (error) {
    console.log('Network failed, trying cache...');
    
    const cache = await caches.open(DYNAMIC_CACHE_NAME);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    return new Response('Offline - Data not available', {
      status: 503,
      statusText: 'Service Unavailable',
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Network only strategy - for PhET simulations
 * @param {Request} request - Request object
 * @returns {Promise<Response>} Response
 */
async function networkOnly(request) {
  try {
    return await fetch(request);
  } catch (error) {
    return new Response('PhET simulation not available offline', {
      status: 503,
      statusText: 'Service Unavailable'
    });
  }
}

/**
 * Stale while revalidate strategy - for HTML pages
 * @param {Request} request - Request object
 * @returns {Promise<Response>} Response
 */
async function staleWhileRevalidate(request) {
  const cache = await caches.open(DYNAMIC_CACHE_NAME);
  const cachedResponse = await cache.match(request);
  
  const networkResponsePromise = fetch(request)
    .then((networkResponse) => {
      if (networkResponse.ok) {
        cache.put(request, networkResponse.clone());
      }
      return networkResponse;
    })
    .catch(() => null);
  
  return cachedResponse || networkResponsePromise;
}

/* ========================================
   Utility Functions
   ======================================== */

/**
 * Check if request is for static asset
 * @param {Request} request - Request object
 * @returns {boolean} Is static asset
 */
function isStaticAsset(request) {
  const url = new URL(request.url);
  return url.pathname.match(/\.(css|js|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf)$/);
}

/**
 * Check if request is for data
 * @param {Request} request - Request object
 * @returns {boolean} Is data request
 */
function isDataRequest(request) {
  const url = new URL(request.url);
  return url.pathname.includes('/data/') || url.pathname.endsWith('.json');
}

/**
 * Check if request is for PhET simulation
 * @param {Request} request - Request object
 * @returns {boolean} Is PhET request
 */
function isPhETRequest(request) {
  const url = new URL(request.url);
  return url.hostname.includes('phet.colorado.edu');
}

/**
 * Limit cache size by removing oldest entries
 * @param {Cache} cache - Cache object
 * @param {number} maxSize - Maximum cache size
 */
async function limitCacheSize(cache, maxSize) {
  const keys = await cache.keys();
  
  if (keys.length > maxSize) {
    const keysToDelete = keys.slice(0, keys.length - maxSize);
    await Promise.all(keysToDelete.map(key => cache.delete(key)));
  }
}

/**
 * Get cache status information
 * @returns {Promise<Object>} Cache status
 */
async function getCacheStatus() {
  const staticCache = await caches.open(CACHE_NAME);
  const dynamicCache = await caches.open(DYNAMIC_CACHE_NAME);
  
  const staticKeys = await staticCache.keys();
  const dynamicKeys = await dynamicCache.keys();
  
  return {
    staticCacheSize: staticKeys.length,
    dynamicCacheSize: dynamicKeys.length,
    totalCachedRequests: staticKeys.length + dynamicKeys.length,
    cacheNames: [CACHE_NAME, DYNAMIC_CACHE_NAME]
  };
}

/**
 * Clear dynamic cache
 * @returns {Promise<boolean>} Success status
 */
async function clearDynamicCache() {
  try {
    await caches.delete(DYNAMIC_CACHE_NAME);
    return true;
  } catch (error) {
    console.error('Failed to clear dynamic cache:', error);
    return false;
  }
}

/* ========================================
   Background Sync (if needed in future)
   ======================================== */

// self.addEventListener('sync', (event) => {
//   if (event.tag === 'background-sync') {
//     event.waitUntil(doBackgroundSync());
//   }
// });

/* ========================================
   Push Notifications (if needed in future)
   ======================================== */

// self.addEventListener('push', (event) => {
//   if (event.data) {
//     const data = event.data.json();
//     showNotification(data);
//   }
// });

console.log('EduLab Service Worker loaded successfully');

