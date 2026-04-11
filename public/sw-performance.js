// Performance-optimized Service Worker for SaaS Vala
const CACHE_NAME = 'saasvala-v1.0.0';
const STATIC_CACHE = 'saasvala-static-v1.0.0';
const RUNTIME_CACHE = 'saasvala-runtime-v1.0.0';

// Critical assets to cache immediately
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/favicon.png',
  '/softwarevala-logo.png',
  '/vala-ai-logo.jpg'
];

// API patterns for runtime caching
const API_CACHE_PATTERNS = [
  /^https:\/\/.*\.supabase\.co\/functions\/v1\/api-gateway/,
  /^https:\/\/.*\.supabase\.co\/rest\/v1\//
];

// Cache strategies
const CACHE_STRATEGIES = {
  // Cache first for static assets
  STATIC: 'cache-first',
  // Network first for API calls
  API: 'network-first',
  // Stale while revalidate for content
  CONTENT: 'stale-while-revalidate'
};

// Install event - cache critical assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('Static assets cached successfully');
        return self.skipWaiting();
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== STATIC_CACHE && 
                cacheName !== RUNTIME_CACHE &&
                cacheName !== CACHE_NAME) {
              console.log('Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('Old caches cleaned up');
        return self.clients.claim();
      })
  );
});

// Fetch event - implement caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Handle different request types
  if (isStaticAsset(request.url)) {
    event.respondWith(cacheFirst(request));
  } else if (isApiCall(request.url)) {
    event.respondWith(networkFirst(request));
  } else if (isHTMLPage(request.url)) {
    event.respondWith(staleWhileRevalidate(request));
  }
});

// Cache strategy implementations
async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  
  if (cached) {
    return cached;
  }
  
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.error('Cache first failed:', error);
    return new Response('Offline', { status: 503 });
  }
}

async function networkFirst(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  
  try {
    const response = await fetch(request);
    if (response.ok) {
      // Cache successful responses for 5 minutes
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.log('Network failed, trying cache:', request.url);
    const cached = await cache.match(request);
    if (cached) {
      return cached;
    }
    return new Response('Offline', { status: 503 });
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);
  
  // Always try to update the cache
  const fetchPromise = fetch(request).then((response) => {
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  });
  
  // Return cached version immediately if available
  if (cached) {
    return cached;
  }
  
  // Otherwise wait for network
  return fetchPromise;
}

// Helper functions
function isStaticAsset(url) {
  return url.includes('/assets/') || 
         url.includes('.png') || 
         url.includes('.jpg') || 
         url.includes('.jpeg') || 
         url.includes('.svg') || 
         url.includes('.css') || 
         url.includes('.js') ||
         url.includes('.woff') ||
         url.includes('.woff2');
}

function isApiCall(url) {
  return API_CACHE_PATTERNS.some(pattern => pattern.test(url));
}

function isHTMLPage(url) {
  return url.endsWith('.html') || 
         url.endsWith('/') || 
         !url.includes('.');
}

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    event.waitUntil(doBackgroundSync());
  }
});

async function doBackgroundSync() {
  console.log('Background sync triggered');
  // Implement background sync logic here
}

// Push notifications
self.addEventListener('push', (event) => {
  const options = {
    body: event.data ? event.data.text() : 'New notification',
    icon: '/favicon.png',
    badge: '/favicon.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    }
  };

  event.waitUntil(
    self.registration.showNotification('SaaS Vala', options)
  );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow('/')
  );
});

// Performance monitoring
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'PERFORMANCE_METRICS') {
    console.log('Performance metrics:', event.data.metrics);
  }
});
