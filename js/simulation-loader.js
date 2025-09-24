/* ========================================
   EduLab Simulation Loader
   Advanced loading states and coordination
   ======================================== */

(function(global) {
  'use strict';

  /* ========================================
     Simulation Loader Class
     ======================================== */

  class SimulationLoader {
    constructor(dataManager, phetIntegration) {
      this.dataManager = dataManager;
      this.phetIntegration = phetIntegration;
      this.loadingQueue = [];
      this.maxConcurrentLoads = 2;
      this.currentLoads = 0;
      this.preloadCache = new Set();
      this.loadStatistics = {
        totalLoads: 0,
        successfulLoads: 0,
        failedLoads: 0,
        averageLoadTime: 0
      };
    }

    /* ========================================
       Public Methods
       ======================================== */

    /**
     * Load simulation by ID into container
     * @param {string} simulationId - Simulation ID
     * @param {HTMLElement|string} container - Container element or selector
     * @param {Object} options - Loading options
     * @returns {Promise<HTMLIFrameElement>} Loaded iframe
     */
    async loadSimulation(simulationId, container, options = {}) {
      const startTime = Date.now();
      
      try {
        // Get simulation data
        const simulation = await this.dataManager.getSimulationById(simulationId);
        if (!simulation) {
          throw new Error(`Simulation not found: ${simulationId}`);
        }

        // Show loading state if needed
        if (options.showLoadingMessage !== false) {
          this.showGlobalLoadingMessage(simulation);
        }

        // Queue or load immediately
        const iframe = await this.queueLoad(simulation, container, options);

        // Update statistics
        const loadTime = Date.now() - startTime;
        this.updateStatistics(true, loadTime);

        // Hide loading message
        this.hideGlobalLoadingMessage();

        return iframe;

      } catch (error) {
        // Update statistics
        const loadTime = Date.now() - startTime;
        this.updateStatistics(false, loadTime);

        // Hide loading message
        this.hideGlobalLoadingMessage();

        throw error;
      }
    }

    /**
     * Load multiple simulations sequentially
     * @param {Array<string>} simulationIds - Array of simulation IDs
     * @param {HTMLElement|string} container - Container element or selector
     * @param {Object} options - Loading options
     * @returns {Promise<Array>} Array of loaded iframes
     */
    async loadMultipleSimulations(simulationIds, container, options = {}) {
      const results = [];
      const containerEl = typeof container === 'string' 
        ? document.querySelector(container) 
        : container;

      if (!containerEl) {
        throw new Error('Container element not found');
      }

      // Create individual containers for each simulation
      for (const simulationId of simulationIds) {
        try {
          const simContainer = document.createElement('div');
          simContainer.className = 'simulation-item';
          containerEl.appendChild(simContainer);

          const iframe = await this.loadSimulation(simulationId, simContainer, {
            ...options,
            showLoadingMessage: false
          });

          results.push({ simulationId, iframe, success: true });

        } catch (error) {
          console.error(`Failed to load simulation ${simulationId}:`, error);
          results.push({ simulationId, error, success: false });
        }
      }

      return results;
    }

    /**
     * Preload simulations for faster access
     * @param {Array<string>} simulationIds - Simulation IDs to preload
     * @returns {Promise<void>}
     */
    async preloadSimulations(simulationIds) {
      const toPreload = simulationIds.filter(id => !this.preloadCache.has(id));
      
      if (toPreload.length === 0) {
        return;
      }

      console.log(`Preloading ${toPreload.length} simulations...`);

      // Create hidden container for preloading
      const preloadContainer = this.createPreloadContainer();
      document.body.appendChild(preloadContainer);

      try {
        // Load simulations in background
        const preloadPromises = toPreload.map(async (simulationId) => {
          try {
            await this.loadSimulation(simulationId, preloadContainer, {
              showLoadingMessage: false,
              showHeader: false,
              showControls: false
            });
            this.preloadCache.add(simulationId);
          } catch (error) {
            console.warn(`Failed to preload simulation ${simulationId}:`, error);
          }
        });

        await Promise.allSettled(preloadPromises);

      } finally {
        // Clean up preload container
        if (preloadContainer.parentNode) {
          preloadContainer.parentNode.removeChild(preloadContainer);
        }
      }

      console.log(`Preloaded ${this.preloadCache.size} simulations successfully`);
    }

    /**
     * Get loading queue status
     * @returns {Object} Queue status
     */
    getQueueStatus() {
      return {
        queueLength: this.loadingQueue.length,
        currentLoads: this.currentLoads,
        maxConcurrentLoads: this.maxConcurrentLoads,
        preloadedCount: this.preloadCache.size
      };
    }

    /**
     * Get loading statistics
     * @returns {Object} Loading statistics
     */
    getStatistics() {
      return { ...this.loadStatistics };
    }

    /**
     * Clear preload cache
     */
    clearPreloadCache() {
      this.preloadCache.clear();
    }

    /* ========================================
       Private Methods - Queue Management
       ======================================== */

    /**
     * Queue simulation loading with concurrency control
     * @param {Object} simulation - Simulation data
     * @param {HTMLElement} container - Container element
     * @param {Object} options - Loading options
     * @returns {Promise<HTMLIFrameElement>} Loaded iframe
     */
    async queueLoad(simulation, container, options) {
      return new Promise((resolve, reject) => {
        const loadRequest = {
          simulation,
          container,
          options,
          resolve,
          reject,
          timestamp: Date.now()
        };

        this.loadingQueue.push(loadRequest);
        this.processQueue();
      });
    }

    /**
     * Process loading queue
     */
    async processQueue() {
      if (this.currentLoads >= this.maxConcurrentLoads || this.loadingQueue.length === 0) {
        return;
      }

      const loadRequest = this.loadingQueue.shift();
      this.currentLoads++;

      try {
        const iframe = await this.phetIntegration.embedSimulation(
          loadRequest.container,
          loadRequest.simulation,
          loadRequest.options
        );

        loadRequest.resolve(iframe);

      } catch (error) {
        loadRequest.reject(error);

      } finally {
        this.currentLoads--;
        
        // Process next item in queue
        if (this.loadingQueue.length > 0) {
          setTimeout(() => this.processQueue(), 100);
        }
      }
    }

    /* ========================================
       Private Methods - Loading States
       ======================================== */

    /**
     * Show global loading message
     * @param {Object} simulation - Simulation data
     */
    showGlobalLoadingMessage(simulation) {
      // Check if global loading indicator exists
      let loadingEl = document.getElementById('global-simulation-loading');
      
      if (!loadingEl) {
        loadingEl = document.createElement('div');
        loadingEl.id = 'global-simulation-loading';
        loadingEl.innerHTML = `
          <div class="global-loading-content">
            <div class="global-loading-spinner"></div>
            <div class="global-loading-text">Đang tải thí nghiệm...</div>
            <div class="global-loading-simulation"></div>
          </div>
        `;
        loadingEl.style.cssText = `
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(255, 255, 255, 0.95);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10000;
          backdrop-filter: blur(2px);
        `;
        
        const style = document.createElement('style');
        style.textContent = `
          .global-loading-content {
            text-align: center;
            max-width: 300px;
            padding: 2rem;
          }
          .global-loading-spinner {
            width: 50px;
            height: 50px;
            border: 4px solid #e0e0e0;
            border-top: 4px solid #1a73e8;
            border-radius: 50%;
            animation: globalSpin 1s linear infinite;
            margin: 0 auto 1rem;
          }
          .global-loading-text {
            font-size: 1.1rem;
            font-weight: 500;
            color: #333;
            margin-bottom: 0.5rem;
          }
          .global-loading-simulation {
            font-size: 0.9rem;
            color: #666;
          }
          @keyframes globalSpin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `;
        document.head.appendChild(style);
        document.body.appendChild(loadingEl);
      }

      // Update simulation name
      const simNameEl = loadingEl.querySelector('.global-loading-simulation');
      if (simNameEl) {
        simNameEl.textContent = simulation.title;
      }

      loadingEl.style.display = 'flex';
    }

    /**
     * Hide global loading message
     */
    hideGlobalLoadingMessage() {
      const loadingEl = document.getElementById('global-simulation-loading');
      if (loadingEl) {
        loadingEl.style.display = 'none';
      }
    }

    /**
     * Create preload container
     * @returns {HTMLElement} Hidden container for preloading
     */
    createPreloadContainer() {
      const container = document.createElement('div');
      container.id = 'simulation-preload-container';
      container.style.cssText = `
        position: absolute;
        top: -9999px;
        left: -9999px;
        width: 1px;
        height: 1px;
        overflow: hidden;
        visibility: hidden;
        pointer-events: none;
      `;
      return container;
    }

    /* ========================================
       Private Methods - Statistics
       ======================================== */

    /**
     * Update loading statistics
     * @param {boolean} success - Whether load was successful
     * @param {number} loadTime - Load time in milliseconds
     */
    updateStatistics(success, loadTime) {
      this.loadStatistics.totalLoads++;
      
      if (success) {
        this.loadStatistics.successfulLoads++;
      } else {
        this.loadStatistics.failedLoads++;
      }

      // Update average load time
      const totalTime = this.loadStatistics.averageLoadTime * (this.loadStatistics.totalLoads - 1) + loadTime;
      this.loadStatistics.averageLoadTime = totalTime / this.loadStatistics.totalLoads;
    }

    /* ========================================
       Public Methods - Smart Loading
       ======================================== */

    /**
     * Smart preload based on user behavior
     * @param {string} currentSimulationId - Currently viewed simulation
     * @returns {Promise<void>}
     */
    async smartPreload(currentSimulationId) {
      try {
        // Get current simulation data
        const currentSim = await this.dataManager.getSimulationById(currentSimulationId);
        if (!currentSim) return;

        // Get related simulations to preload
        const relatedSims = await this.dataManager.getSimulationsBySubject(currentSim.subject);
        const sameGradeSims = await this.dataManager.getSimulationsByGrade(currentSim.gradeLevel);

        // Combine and prioritize
        const toPreload = new Set();
        
        // Add same subject simulations (highest priority)
        relatedSims.slice(0, 3).forEach(sim => {
          if (sim.id !== currentSimulationId) {
            toPreload.add(sim.id);
          }
        });

        // Add same grade simulations
        sameGradeSims.slice(0, 2).forEach(sim => {
          if (sim.id !== currentSimulationId) {
            toPreload.add(sim.id);
          }
        });

        if (toPreload.size > 0) {
          this.preloadSimulations(Array.from(toPreload));
        }

      } catch (error) {
        console.warn('Smart preload failed:', error);
      }
    }

    /**
     * Load simulation with fallback options
     * @param {string} simulationId - Simulation ID
     * @param {HTMLElement|string} container - Container element
     * @param {Object} options - Loading options
     * @returns {Promise<HTMLIFrameElement>} Loaded iframe
     */
    async loadWithFallback(simulationId, container, options = {}) {
      try {
        // Try normal loading first
        return await this.loadSimulation(simulationId, container, options);

      } catch (error) {
        console.warn('Normal loading failed, trying fallback:', error);

        // Try with different options
        const fallbackOptions = {
          ...options,
          showHeader: false,
          showControls: false,
          timeout: 60000 // Longer timeout
        };

        try {
          return await this.loadSimulation(simulationId, container, fallbackOptions);
        } catch (fallbackError) {
          // Show error with manual link
          this.showFallbackError(container, simulationId, fallbackError);
          throw fallbackError;
        }
      }
    }

    /**
     * Show fallback error with manual options
     * @param {HTMLElement} container - Container element
     * @param {string} simulationId - Simulation ID
     * @param {Error} error - Error that occurred
     */
    async showFallbackError(container, simulationId, error) {
      try {
        const simulation = await this.dataManager.getSimulationById(simulationId);
        
        const errorDiv = document.createElement('div');
        errorDiv.className = 'simulation-fallback-error';
        errorDiv.innerHTML = `
          <div style="text-align: center; padding: 2rem; border: 2px dashed #ccc; border-radius: 8px;">
            <div style="font-size: 2rem; margin-bottom: 1rem;">⚠️</div>
            <h3 style="margin-bottom: 1rem;">Không thể tải thí nghiệm</h3>
            <p style="margin-bottom: 1.5rem; color: #666;">
              ${simulation ? simulation.title : 'Thí nghiệm'} không thể được tải trong trang này.
            </p>
            <a href="${simulation ? simulation.phetUrl : '#'}" 
               target="_blank" 
               style="display: inline-block; padding: 12px 24px; background: #1a73e8; color: white; text-decoration: none; border-radius: 6px;">
              Mở thí nghiệm trực tiếp
            </a>
          </div>
        `;

        container.appendChild(errorDiv);

      } catch (dataError) {
        console.error('Failed to show fallback error:', dataError);
      }
    }
  }

  /* ========================================
     Export
     ======================================== */

  global.SimulationLoader = SimulationLoader;

  /* ========================================
     Auto-initialization
     ======================================== */

  // Auto-create instance when dependencies are available
  if (typeof window !== 'undefined') {
    const initializeLoader = () => {
      if (window.DataManager && window.PhETIntegration) {
        window.SimulationLoader = new SimulationLoader(window.DataManager, window.PhETIntegration);
        console.log('SimulationLoader initialized');
        
        // Dispatch custom event to notify other components
        window.dispatchEvent(new CustomEvent('SimulationLoaderReady', { 
          detail: { loader: window.SimulationLoader } 
        }));
      } else {
        // Retry after a short delay if dependencies aren't ready
        setTimeout(initializeLoader, 100);
      }
    };
    
    // Try to initialize immediately if dependencies are already available
    if (document.readyState === 'loading') {
      window.addEventListener('DOMContentLoaded', initializeLoader);
    } else {
      initializeLoader();
    }
  }

  /* ========================================
     Development Helpers
     ======================================== */

  if (typeof window !== 'undefined' && window.console) {
    window.EduLabSimLoader = {
      createLoader: (dataManager, phetIntegration) => new SimulationLoader(dataManager, phetIntegration),
      testLoad: async (simulationId, containerId) => {
        if (window.SimulationLoader) {
          try {
            await window.SimulationLoader.loadSimulation(simulationId, containerId);
            console.log(`✅ Successfully loaded simulation: ${simulationId}`);
          } catch (error) {
            console.error(`❌ Failed to load simulation: ${simulationId}`, error);
          }
        }
      }
    };
  }

})(typeof window !== 'undefined' ? window : global);
