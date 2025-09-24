/* ========================================
   EduLab Performance Optimizer
   Caching and optimization utilities
   ======================================== */

(function(global) {
  'use strict';

  /* ========================================
     Performance Optimizer Class
     ======================================== */

  class PerformanceOptimizer {
    constructor() {
      this.cache = new Map();
      this.requestQueue = new Map();
      this.observerMap = new Map();
      this.preloadQueue = [];
      this.maxCacheSize = 100;
      this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
      this.isInitialized = false;
      
      this.metrics = {
        cacheHits: 0,
        cacheMisses: 0,
        totalRequests: 0,
        averageLoadTime: 0,
        slowNetworkDetected: false
      };
    }

    /* ========================================
       Public Methods - Initialization
       ======================================== */

    /**
     * Initialize performance optimizer
     */
    init() {
      if (this.isInitialized) return;

      this.setupIntersectionObserver();
      this.setupPreconnections();
      this.setupResourceHints();
      this.monitorNetworkQuality();
      this.optimizeImages();
      this.setupServiceWorker();
      
      this.isInitialized = true;
      console.log('PerformanceOptimizer initialized');
    }

    /* ========================================
       Public Methods - Caching
       ======================================== */

    /**
     * Enhanced fetch with caching and optimization
     * @param {string} url - URL to fetch
     * @param {Object} options - Fetch options
     * @returns {Promise} Fetch response
     */
    async optimizedFetch(url, options = {}) {
      const startTime = performance.now();
      const cacheKey = this.getCacheKey(url, options);

      try {
        this.metrics.totalRequests++;

        // Check cache first
        const cachedResponse = this.getFromCache(cacheKey);
        if (cachedResponse && !options.skipCache) {
          this.metrics.cacheHits++;
          return cachedResponse;
        }

        this.metrics.cacheMisses++;

        // Check if request is already in progress
        if (this.requestQueue.has(cacheKey)) {
          return this.requestQueue.get(cacheKey);
        }

        // Create new request
        const requestPromise = this.performRequest(url, options);
        this.requestQueue.set(cacheKey, requestPromise);

        const response = await requestPromise;
        
        // Cache successful responses
        if (response.ok && !options.skipCache) {
          this.setCache(cacheKey, response.clone());
        }

        // Clean up request queue
        this.requestQueue.delete(cacheKey);

        // Update metrics
        const loadTime = performance.now() - startTime;
        this.updateLoadTimeMetrics(loadTime);

        return response;

      } catch (error) {
        this.requestQueue.delete(cacheKey);
        
        // Handle network errors with fallback
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
          if (global.ErrorHandler) {
            global.ErrorHandler.handleNetworkError(error, url, {
              enableRetry: true,
              retryCallback: () => this.optimizedFetch(url, options)
            });
          }
        }
        
        throw error;
      }
    }

    /**
     * Preload resources
     * @param {Array} urls - URLs to preload
     * @param {Object} options - Preload options
     */
    preloadResources(urls, options = {}) {
      urls.forEach(url => {
        if (!this.preloadQueue.includes(url)) {
          this.preloadQueue.push(url);
          this.preloadResource(url, options);
        }
      });
    }

    /**
     * Clear cache
     * @param {string} pattern - Pattern to match (optional)
     */
    clearCache(pattern = null) {
      if (pattern) {
        for (const [key, value] of this.cache) {
          if (key.includes(pattern)) {
            this.cache.delete(key);
          }
        }
      } else {
        this.cache.clear();
      }
    }

    /* ========================================
       Public Methods - Lazy Loading
       ======================================== */

    /**
     * Setup lazy loading for images
     * @param {string} selector - Image selector
     * @param {Object} options - Lazy loading options
     */
    setupLazyLoading(selector = 'img[data-src]', options = {}) {
      const images = document.querySelectorAll(selector);
      
      if ('IntersectionObserver' in window) {
        const imageObserver = new IntersectionObserver((entries, observer) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              const img = entry.target;
              this.loadImage(img, options);
              observer.unobserve(img);
            }
          });
        }, {
          rootMargin: options.rootMargin || '50px 0px',
          threshold: options.threshold || 0.01
        });

        images.forEach(img => imageObserver.observe(img));
        this.observerMap.set(selector, imageObserver);
      } else {
        // Fallback for older browsers
        images.forEach(img => this.loadImage(img, options));
      }
    }

    /**
     * Setup lazy loading for simulation cards
     * @param {string} containerSelector - Container selector
     */
    setupSimulationLazyLoading(containerSelector = '.simulation-grid') {
      const container = document.querySelector(containerSelector);
      if (!container) return;

      const cardObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const card = entry.target;
            this.loadSimulationCard(card);
            cardObserver.unobserve(card);
          }
        });
      }, {
        rootMargin: '100px 0px',
        threshold: 0.1
      });

      // Observe existing cards
      const cards = container.querySelectorAll('.simulation-card[data-simulation-id]');
      cards.forEach(card => {
        if (!card.dataset.loaded) {
          cardObserver.observe(card);
        }
      });

      this.observerMap.set('simulation-cards', cardObserver);
    }

    /* ========================================
       Public Methods - Performance Monitoring
       ======================================== */

    /**
     * Get performance metrics
     * @returns {Object} Performance metrics
     */
    getMetrics() {
      return {
        ...this.metrics,
        cacheSize: this.cache.size,
        cacheHitRate: this.metrics.totalRequests > 0 ? 
          (this.metrics.cacheHits / this.metrics.totalRequests * 100).toFixed(1) + '%' : '0%',
        queueSize: this.requestQueue.size,
        preloadQueueSize: this.preloadQueue.length
      };
    }

    /**
     * Optimize for slow network
     */
    optimizeForSlowNetwork() {
      this.metrics.slowNetworkDetected = true;
      
      // Reduce image quality
      this.optimizeImageQuality(0.7);
      
      // Increase cache timeout
      this.cacheTimeout = 10 * 60 * 1000; // 10 minutes
      
      // Preload fewer resources
      this.preloadQueue = this.preloadQueue.slice(0, 3);
      
      console.log('Optimized for slow network connection');
    }

    /**
     * Monitor network quality
     */
    monitorNetworkQuality() {
      if ('connection' in navigator) {
        const connection = navigator.connection;
        
        const updateNetworkInfo = () => {
          const isSlowNetwork = connection.effectiveType === 'slow-2g' || 
                               connection.effectiveType === '2g' ||
                               connection.downlink < 1.5;
          
          if (isSlowNetwork && !this.metrics.slowNetworkDetected) {
            this.optimizeForSlowNetwork();
          }
          
          // Update UI with network status
          this.updateNetworkStatus(connection);
        };

        connection.addEventListener('change', updateNetworkInfo);
        updateNetworkInfo();
      }

      // Monitor online/offline status
      window.addEventListener('online', () => {
        this.handleOnlineStatus(true);
      });

      window.addEventListener('offline', () => {
        this.handleOnlineStatus(false);
      });
    }

    /* ========================================
       Private Methods - Caching
       ======================================== */

    /**
     * Generate cache key
     * @param {string} url - URL
     * @param {Object} options - Options
     * @returns {string} Cache key
     */
    getCacheKey(url, options) {
      const method = options.method || 'GET';
      const headers = JSON.stringify(options.headers || {});
      return `${method}:${url}:${headers}`;
    }

    /**
     * Get item from cache
     * @param {string} key - Cache key
     * @returns {*} Cached item or null
     */
    getFromCache(key) {
      const item = this.cache.get(key);
      if (item && Date.now() - item.timestamp < this.cacheTimeout) {
        return item.data;
      } else if (item) {
        this.cache.delete(key);
      }
      return null;
    }

    /**
     * Set item in cache
     * @param {string} key - Cache key
     * @param {*} data - Data to cache
     */
    setCache(key, data) {
      // Maintain cache size
      if (this.cache.size >= this.maxCacheSize) {
        const firstKey = this.cache.keys().next().value;
        this.cache.delete(firstKey);
      }

      this.cache.set(key, {
        data: data,
        timestamp: Date.now()
      });
    }

    /**
     * Perform actual network request
     * @param {string} url - URL
     * @param {Object} options - Options
     * @returns {Promise} Response
     */
    async performRequest(url, options) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), options.timeout || 30000);

      try {
        const response = await fetch(url, {
          ...options,
          signal: controller.signal
        });

        clearTimeout(timeoutId);
        return response;
      } catch (error) {
        clearTimeout(timeoutId);
        throw error;
      }
    }

    /* ========================================
       Private Methods - Resource Loading
       ======================================== */

    /**
     * Preload single resource
     * @param {string} url - URL to preload
     * @param {Object} options - Options
     */
    preloadResource(url, options) {
      if (options.priority === 'low' && this.metrics.slowNetworkDetected) {
        return; // Skip low priority preloads on slow networks
      }

      const link = document.createElement('link');
      link.rel = 'prefetch';
      link.href = url;
      
      if (options.as) {
        link.as = options.as;
      }

      document.head.appendChild(link);
    }

    /**
     * Load image with optimization
     * @param {HTMLImageElement} img - Image element
     * @param {Object} options - Options
     */
    loadImage(img, options = {}) {
      const src = img.dataset.src || img.src;
      if (!src) return;

      // Create optimized image URL for slow networks
      const optimizedSrc = this.metrics.slowNetworkDetected ? 
        this.getOptimizedImageUrl(src, options) : src;

      // Show loading placeholder
      if (options.showPlaceholder !== false) {
        img.classList.add('loading');
      }

      const tempImg = new Image();
      tempImg.onload = () => {
        img.src = optimizedSrc;
        img.classList.remove('loading');
        img.classList.add('loaded');
        
        if (img.dataset.src) {
          delete img.dataset.src;
        }
      };

      tempImg.onerror = () => {
        img.classList.remove('loading');
        img.classList.add('error');
        
        // Set fallback image
        if (options.fallback) {
          img.src = options.fallback;
        }
      };

      tempImg.src = optimizedSrc;
    }

    /**
     * Load simulation card content
     * @param {HTMLElement} card - Card element
     */
    loadSimulationCard(card) {
      const simulationId = card.dataset.simulationId;
      if (!simulationId || card.dataset.loaded) return;

      // Mark as loaded to prevent duplicate loading
      card.dataset.loaded = 'true';

      // Load card images
      const images = card.querySelectorAll('img[data-src]');
      images.forEach(img => this.loadImage(img));

      // Load additional data if needed
      if (card.dataset.needsDetail) {
        this.loadSimulationDetails(simulationId, card);
      }
    }

    /**
     * Load simulation details
     * @param {string} simulationId - Simulation ID
     * @param {HTMLElement} card - Card element
     */
    async loadSimulationDetails(simulationId, card) {
      try {
        if (global.DataManager) {
          const simulation = await global.DataManager.getSimulationById(simulationId);
          if (simulation) {
            this.updateCardWithDetails(card, simulation);
          }
        }
      } catch (error) {
        console.warn('Failed to load simulation details:', error);
      }
    }

    /* ========================================
       Private Methods - Setup
       ======================================== */

    /**
     * Setup intersection observer
     */
    setupIntersectionObserver() {
      // This will be used by lazy loading methods
      if (!('IntersectionObserver' in window)) {
        console.warn('IntersectionObserver not supported, fallback to immediate loading');
      }
    }

    /**
     * Setup preconnections for external resources
     */
    setupPreconnections() {
      const preconnectUrls = [
        'https://phet.colorado.edu',
        'https://fonts.googleapis.com',
        'https://fonts.gstatic.com'
      ];

      preconnectUrls.forEach(url => {
        const link = document.createElement('link');
        link.rel = 'preconnect';
        link.href = url;
        link.crossOrigin = 'anonymous';
        document.head.appendChild(link);
      });
    }

    /**
     * Setup resource hints
     */
    setupResourceHints() {
      // Preload critical CSS
      const criticalCSS = ['css/styles.css', 'css/responsive.css'];
      criticalCSS.forEach(href => {
        const link = document.createElement('link');
        link.rel = 'preload';
        link.href = href;
        link.as = 'style';
        document.head.appendChild(link);
      });
    }

    /**
     * Optimize images
     */
    optimizeImages() {
      // Add loading attribute to images for native lazy loading
      const images = document.querySelectorAll('img');
      images.forEach(img => {
        if (!img.hasAttribute('loading')) {
          img.loading = 'lazy';
        }
      });
    }

    /**
     * Setup service worker
     */
    setupServiceWorker() {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js')
          .then(registration => {
            console.log('ServiceWorker registered:', registration);
          })
          .catch(error => {
            console.log('ServiceWorker registration failed:', error);
          });
      }
    }

    /* ========================================
       Private Methods - Utilities
       ======================================== */

    /**
     * Update load time metrics
     * @param {number} loadTime - Load time in ms
     */
    updateLoadTimeMetrics(loadTime) {
      this.metrics.averageLoadTime = 
        (this.metrics.averageLoadTime + loadTime) / 2;
    }

    /**
     * Get optimized image URL
     * @param {string} src - Original image URL
     * @param {Object} options - Options
     * @returns {string} Optimized URL
     */
    getOptimizedImageUrl(src, options) {
      // For slow networks, could add query parameters for smaller images
      if (this.metrics.slowNetworkDetected) {
        if (src.includes('?')) {
          return src + '&quality=70&width=400';
        } else {
          return src + '?quality=70&width=400';
        }
      }
      return src;
    }

    /**
     * Optimize image quality
     * @param {number} quality - Quality factor (0-1)
     */
    optimizeImageQuality(quality) {
      const images = document.querySelectorAll('img');
      images.forEach(img => {
        if (img.src && img.src.includes('quality=')) {
          img.src = img.src.replace(/quality=\d+/, `quality=${Math.round(quality * 100)}`);
        }
      });
    }

    /**
     * Update network status in UI
     * @param {Object} connection - Connection info
     */
    updateNetworkStatus(connection) {
      let statusElement = document.getElementById('network-status');
      
      if (!statusElement) {
        statusElement = document.createElement('div');
        statusElement.id = 'network-status';
        statusElement.className = 'network-status';
        document.body.appendChild(statusElement);
      }

      const effectiveType = connection.effectiveType;
      const downlink = connection.downlink;
      
      let statusClass = 'good';
      let statusText = '🟢 Kết nối tốt';
      
      if (effectiveType === 'slow-2g' || effectiveType === '2g') {
        statusClass = 'slow';
        statusText = '🟡 Kết nối chậm';
      } else if (!navigator.onLine) {
        statusClass = 'offline';
        statusText = '🔴 Không có mạng';
      }

      statusElement.className = `network-status ${statusClass}`;
      statusElement.innerHTML = `
        <span class="network-indicator"></span>
        <span>${statusText}</span>
        <small>(${effectiveType}, ${downlink} Mbps)</small>
      `;
    }

    /**
     * Handle online/offline status
     * @param {boolean} isOnline - Online status
     */
    handleOnlineStatus(isOnline) {
      const statusElement = document.getElementById('network-status');
      if (statusElement) {
        if (isOnline) {
          statusElement.className = 'network-status good';
          statusElement.innerHTML = `
            <span class="network-indicator"></span>
            <span>🟢 Đã kết nối lại</span>
          `;
          setTimeout(() => statusElement.style.display = 'none', 3000);
        } else {
          statusElement.className = 'network-status offline';
          statusElement.innerHTML = `
            <span class="network-indicator"></span>
            <span>🔴 Mất kết nối</span>
          `;
          statusElement.style.display = 'flex';
        }
      }

      // Clear request queue on offline
      if (!isOnline) {
        this.requestQueue.clear();
      }
    }

    /**
     * Update card with simulation details
     * @param {HTMLElement} card - Card element
     * @param {Object} simulation - Simulation data
     */
    updateCardWithDetails(card, simulation) {
      // Add additional information to card
      const detailsElement = card.querySelector('.card-details');
      if (detailsElement && simulation.topics) {
        const topicsHTML = simulation.topics.slice(0, 3).map(topic => 
          `<span class="topic-tag">${topic}</span>`
        ).join('');
        
        detailsElement.innerHTML = topicsHTML;
      }
    }
  }

  /* ========================================
     Export
     ======================================== */

  const performanceOptimizer = new PerformanceOptimizer();
  global.PerformanceOptimizer = performanceOptimizer;

  /* ========================================
     Auto-initialization
     ======================================== */

  if (typeof window !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => performanceOptimizer.init());
    } else {
      performanceOptimizer.init();
    }
  }

  /* ========================================
     Development Helpers
     ======================================== */

  if (typeof window !== 'undefined' && window.console) {
    window.EduLabPerf = {
      metrics: () => performanceOptimizer.getMetrics(),
      cache: () => performanceOptimizer.cache,
      clear: () => performanceOptimizer.clearCache(),
      preload: (urls) => performanceOptimizer.preloadResources(urls),
      slowNetwork: () => performanceOptimizer.optimizeForSlowNetwork()
    };
  }

})(typeof window !== 'undefined' ? window : global);

