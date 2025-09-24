/* ========================================
   EduLab PhET Integration
   Secure iframe embedding and management
   ======================================== */

(function(global) {
  'use strict';

  /* ========================================
     PhET Integration Class
     ======================================== */

  class PhETIntegration {
    constructor() {
      this.loadingTimeout = 30000; // 30 seconds
      this.retryAttempts = 3;
      this.loadedSimulations = new Map();
      this.eventListeners = new Map();
    }

    /* ========================================
       Public Methods
       ======================================== */

    /**
     * Embed a PhET simulation in a container
     * @param {HTMLElement|string} container - Container element or selector
     * @param {Object} simulation - Simulation data object
     * @param {Object} options - Additional options
     * @returns {Promise<HTMLIFrameElement>} Loaded iframe element
     */
    async embedSimulation(container, simulation, options = {}) {
      // Get container element
      const containerEl = typeof container === 'string' 
        ? document.querySelector(container) 
        : container;

      if (!containerEl) {
        throw new Error('Container element not found');
      }

      // Validate simulation data
      this.validateSimulation(simulation);

      // Create simulation wrapper
      const wrapper = this.createSimulationWrapper(simulation, options);
      containerEl.appendChild(wrapper);

      try {
        // Create and configure iframe
        const iframe = await this.createSecureIframe(simulation, options);
        
        // Add iframe to wrapper
        const iframeContainer = wrapper.querySelector('.simulation-wrapper');
        iframeContainer.appendChild(iframe);

        // Start loading process
        await this.loadSimulation(iframe, wrapper, simulation);

        // Store reference
        this.loadedSimulations.set(simulation.id, {
          iframe,
          wrapper,
          simulation,
          loadedAt: Date.now()
        });

        return iframe;

      } catch (error) {
        this.showError(wrapper, error, simulation);
        throw error;
      }
    }

    /**
     * Reload a simulation
     * @param {string} simulationId - Simulation ID
     * @returns {Promise<void>}
     */
    async reloadSimulation(simulationId) {
      const simData = this.loadedSimulations.get(simulationId);
      if (!simData) {
        throw new Error('Simulation not found');
      }

      const { iframe, wrapper, simulation } = simData;
      
      // Reset states
      this.showLoading(wrapper);
      this.hideError(wrapper);

      try {
        // Reload iframe
        iframe.src = simulation.phetUrl;
        await this.loadSimulation(iframe, wrapper, simulation);
      } catch (error) {
        this.showError(wrapper, error, simulation);
        
        // Handle error with error handler if available
        if (window.ErrorHandler) {
          window.ErrorHandler.handlePhETError(error, simulation.id, {
            enableRetry: true,
            retryCallback: () => this.reloadSimulation(simulation.id),
            showAlternatives: true
          });
        }
        
        throw error;
      }
    }

    /**
     * Remove a simulation
     * @param {string} simulationId - Simulation ID
     */
    removeSimulation(simulationId) {
      const simData = this.loadedSimulations.get(simulationId);
      if (simData) {
        const { wrapper } = simData;
        if (wrapper.parentNode) {
          wrapper.parentNode.removeChild(wrapper);
        }
        this.loadedSimulations.delete(simulationId);
      }
    }

    /**
     * Toggle fullscreen mode
     * @param {string} simulationId - Simulation ID
     */
    toggleFullscreen(simulationId) {
      const simData = this.loadedSimulations.get(simulationId);
      if (!simData) return;

      const { wrapper } = simData;
      
      if (wrapper.classList.contains('fullscreen')) {
        this.exitFullscreen(wrapper);
      } else {
        this.enterFullscreen(wrapper);
      }
    }

    /* ========================================
       Private Methods - DOM Creation
       ======================================== */

    /**
     * Create simulation wrapper HTML structure
     * @param {Object} simulation - Simulation data
     * @param {Object} options - Options
     * @returns {HTMLElement} Wrapper element
     */
    createSimulationWrapper(simulation, options) {
      const wrapper = document.createElement('div');
      wrapper.className = 'simulation-container';
      wrapper.setAttribute('data-simulation-id', simulation.id);

      wrapper.innerHTML = `
        ${options.showHeader !== false ? this.createHeaderHTML(simulation) : ''}
        
        <div class="simulation-wrapper" data-simulation-url="${simulation.phetUrl}">
          <!-- Iframe will be inserted here -->
          
          <!-- Loading state -->
          <div class="simulation-loading">
            <div class="simulation-spinner"></div>
            <div class="loading-text">Đang tải thí nghiệm...</div>
            <div class="loading-progress">
              <div class="loading-progress-bar"></div>
            </div>
            <div class="sr-simulation-status" aria-live="polite" aria-atomic="true">
              Đang tải thí nghiệm ${simulation.title}
            </div>
          </div>

          <!-- Error state -->
          <div class="simulation-error hidden">
            <div class="error-icon">⚠️</div>
            <div class="error-title">Không thể tải thí nghiệm</div>
            <div class="error-message">
              Thí nghiệm không thể được tải. Vui lòng kiểm tra kết nối mạng hoặc thử lại sau.
            </div>
            <div class="error-actions">
              <button class="error-btn primary" onclick="window.PhETIntegration?.reloadSimulation('${simulation.id}')">
                Thử lại
              </button>
              <a href="${simulation.phetUrl}" target="_blank" class="error-btn">
                Mở trực tiếp
              </a>
            </div>
          </div>
        </div>

        ${options.showControls !== false ? this.createControlsHTML(simulation) : ''}
      `;

      return wrapper;
    }

    /**
     * Create header HTML
     * @param {Object} simulation - Simulation data
     * @returns {string} Header HTML
     */
    createHeaderHTML(simulation) {
      return `
        <div class="simulation-header">
          <h2 class="simulation-title">${simulation.title}</h2>
          <div class="simulation-meta">
            <span class="simulation-badge subject">${this.getSubjectName(simulation.subject)}</span>
            <span class="simulation-badge grade">Lớp ${simulation.gradeLevel}</span>
            <span class="simulation-badge difficulty">${this.getDifficultyName(simulation.difficulty)}</span>
            <span class="simulation-duration">⏱️ ${simulation.duration || '20-30 phút'}</span>
          </div>
        </div>
      `;
    }

    /**
     * Create controls HTML
     * @param {Object} simulation - Simulation data
     * @returns {string} Controls HTML
     */
    createControlsHTML(simulation) {
      return `
        <div class="simulation-controls">
          <div class="control-group">
            <button class="control-btn" onclick="window.PhETIntegration?.reloadSimulation('${simulation.id}')" 
                    title="Tải lại thí nghiệm">
              🔄 Tải lại
            </button>
            <a href="${simulation.phetUrl}" target="_blank" class="control-btn" 
               title="Mở trong tab mới">
              🔗 Mở riêng
            </a>
          </div>
          <div class="control-group">
            <button class="control-btn fullscreen-btn" 
                    onclick="window.PhETIntegration?.toggleFullscreen('${simulation.id}')"
                    title="Chế độ toàn màn hình">
              ⛶ Toàn màn hình
            </button>
          </div>
        </div>
      `;
    }

    /**
     * Create secure iframe element
     * @param {Object} simulation - Simulation data
     * @param {Object} options - Options
     * @returns {Promise<HTMLIFrameElement>} Configured iframe
     */
    async createSecureIframe(simulation, options) {
      const iframe = document.createElement('iframe');
      
      // Security attributes
      iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups allow-forms');
      iframe.setAttribute('loading', 'lazy');
      iframe.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
      
      // Accessibility attributes
      iframe.setAttribute('title', `Thí nghiệm PhET: ${simulation.title}`);
      iframe.setAttribute('aria-label', simulation.description);
      
      // Styling
      iframe.className = 'phet-iframe';
      
      // Allow fullscreen
      iframe.setAttribute('allowfullscreen', 'true');
      
      // Touch and interaction
      iframe.style.touchAction = 'manipulation';
      
      return iframe;
    }

    /* ========================================
       Private Methods - Loading Management
       ======================================== */

    /**
     * Load simulation with progress tracking
     * @param {HTMLIFrameElement} iframe - Iframe element
     * @param {HTMLElement} wrapper - Wrapper element
     * @param {Object} simulation - Simulation data
     * @returns {Promise<void>}
     */
    async loadSimulation(iframe, wrapper, simulation) {
      return new Promise((resolve, reject) => {
        let loadTimeout;
        let progressInterval;
        let progress = 0;

        const cleanup = () => {
          if (loadTimeout) clearTimeout(loadTimeout);
          if (progressInterval) clearInterval(progressInterval);
          iframe.removeEventListener('load', onLoad);
          iframe.removeEventListener('error', onError);
        };

        const onLoad = () => {
          cleanup();
          this.hideLoading(wrapper);
          iframe.classList.add('loaded');
          this.announceToScreenReader(`Thí nghiệm ${simulation.title} đã tải thành công`);
          resolve();
        };

        const onError = () => {
          cleanup();
          const error = new Error(`Failed to load simulation: ${simulation.title}`);
          reject(error);
        };

        const onTimeout = () => {
          cleanup();
          const error = new Error(`Simulation loading timed out after ${this.loadingTimeout / 1000} seconds`);
          reject(error);
        };

        // Set up event listeners
        iframe.addEventListener('load', onLoad);
        iframe.addEventListener('error', onError);

        // Set up timeout
        loadTimeout = setTimeout(onTimeout, this.loadingTimeout);

        // Simulate progress for better UX
        progressInterval = setInterval(() => {
          progress = Math.min(progress + Math.random() * 15, 90);
          this.updateProgress(wrapper, progress);
        }, 200);

        // Start loading
        iframe.src = simulation.phetUrl;
      });
    }

    /**
     * Show loading state
     * @param {HTMLElement} wrapper - Wrapper element
     */
    showLoading(wrapper) {
      const loading = wrapper.querySelector('.simulation-loading');
      const error = wrapper.querySelector('.simulation-error');
      
      if (loading) {
        loading.classList.remove('hidden');
      }
      if (error) {
        error.classList.add('hidden');
      }
      
      wrapper.classList.add('loading');
      wrapper.classList.remove('error');
    }

    /**
     * Hide loading state
     * @param {HTMLElement} wrapper - Wrapper element
     */
    hideLoading(wrapper) {
      const loading = wrapper.querySelector('.simulation-loading');
      
      if (loading) {
        loading.classList.add('hidden');
      }
      
      wrapper.classList.remove('loading');
    }

    /**
     * Update loading progress
     * @param {HTMLElement} wrapper - Wrapper element
     * @param {number} progress - Progress percentage (0-100)
     */
    updateProgress(wrapper, progress) {
      const progressBar = wrapper.querySelector('.loading-progress-bar');
      if (progressBar) {
        progressBar.style.width = `${progress}%`;
      }
    }

    /* ========================================
       Private Methods - Error Handling
       ======================================== */

    /**
     * Show error state
     * @param {HTMLElement} wrapper - Wrapper element
     * @param {Error} error - Error object
     * @param {Object} simulation - Simulation data
     */
    showError(wrapper, error, simulation) {
      const loading = wrapper.querySelector('.simulation-loading');
      const errorEl = wrapper.querySelector('.simulation-error');
      const errorMessage = wrapper.querySelector('.error-message');
      
      if (loading) {
        loading.classList.add('hidden');
      }
      
      if (errorEl) {
        errorEl.classList.remove('hidden');
      }

      if (errorMessage) {
        errorMessage.textContent = this.getErrorMessage(error);
      }
      
      wrapper.classList.remove('loading');
      wrapper.classList.add('error');
      
      this.announceToScreenReader(`Lỗi khi tải thí nghiệm ${simulation.title}: ${this.getErrorMessage(error)}`);
    }

    /**
     * Hide error state
     * @param {HTMLElement} wrapper - Wrapper element
     */
    hideError(wrapper) {
      const errorEl = wrapper.querySelector('.simulation-error');
      
      if (errorEl) {
        errorEl.classList.add('hidden');
      }
      
      wrapper.classList.remove('error');
    }

    /**
     * Get user-friendly error message
     * @param {Error} error - Error object
     * @returns {string} Error message
     */
    getErrorMessage(error) {
      if (error.message.includes('timeout')) {
        return 'Thí nghiệm mất quá nhiều thời gian để tải. Vui lòng kiểm tra kết nối mạng.';
      }
      if (error.message.includes('network')) {
        return 'Không thể kết nối với máy chủ PhET. Vui lòng kiểm tra kết nối internet.';
      }
      if (error.message.includes('blocked')) {
        return 'Thí nghiệm bị chặn bởi trình duyệt. Vui lòng thử trình duyệt khác.';
      }
      
      return 'Có lỗi xảy ra khi tải thí nghiệm. Vui lòng thử lại sau.';
    }

    /* ========================================
       Private Methods - Fullscreen
       ======================================== */

    /**
     * Enter fullscreen mode
     * @param {HTMLElement} wrapper - Wrapper element
     */
    enterFullscreen(wrapper) {
      wrapper.classList.add('fullscreen');
      document.body.style.overflow = 'hidden';
      
      // Add escape key listener
      this.addEscapeListener(wrapper);
      
      this.announceToScreenReader('Đã vào chế độ toàn màn hình. Nhấn Escape để thoát.');
    }

    /**
     * Exit fullscreen mode
     * @param {HTMLElement} wrapper - Wrapper element
     */
    exitFullscreen(wrapper) {
      wrapper.classList.remove('fullscreen');
      document.body.style.overflow = '';
      
      this.removeEscapeListener(wrapper);
      
      this.announceToScreenReader('Đã thoát chế độ toàn màn hình.');
    }

    /**
     * Add escape key listener for fullscreen
     * @param {HTMLElement} wrapper - Wrapper element
     */
    addEscapeListener(wrapper) {
      const listener = (e) => {
        if (e.key === 'Escape') {
          this.exitFullscreen(wrapper);
        }
      };
      
      document.addEventListener('keydown', listener);
      this.eventListeners.set(wrapper, listener);
    }

    /**
     * Remove escape key listener
     * @param {HTMLElement} wrapper - Wrapper element
     */
    removeEscapeListener(wrapper) {
      const listener = this.eventListeners.get(wrapper);
      if (listener) {
        document.removeEventListener('keydown', listener);
        this.eventListeners.delete(wrapper);
      }
    }

    /* ========================================
       Private Methods - Utilities
       ======================================== */

    /**
     * Validate simulation data
     * @param {Object} simulation - Simulation data
     */
    validateSimulation(simulation) {
      if (!simulation || typeof simulation !== 'object') {
        throw new Error('Invalid simulation data');
      }
      
      const required = ['id', 'title', 'phetUrl'];
      required.forEach(field => {
        if (!simulation[field]) {
          throw new Error(`Missing required field: ${field}`);
        }
      });
      
      // Validate PhET URL
      if (!this.isValidPhETUrl(simulation.phetUrl)) {
        throw new Error('Invalid PhET URL');
      }
    }

    /**
     * Check if URL is a valid PhET simulation URL
     * @param {string} url - URL to validate
     * @returns {boolean} True if valid
     */
    isValidPhETUrl(url) {
      try {
        const urlObj = new URL(url);
        return urlObj.hostname === 'phet.colorado.edu' && 
               urlObj.pathname.includes('/sims/');
      } catch (error) {
        return false;
      }
    }

    /**
     * Get subject display name
     * @param {string} subjectId - Subject ID
     * @returns {string} Subject name
     */
    getSubjectName(subjectId) {
      const subjects = {
        physics: 'Vật Lý',
        chemistry: 'Hóa Học',
        biology: 'Sinh Học',
        mathematics: 'Toán Học'
      };
      return subjects[subjectId] || subjectId;
    }

    /**
     * Get difficulty display name
     * @param {string} difficultyId - Difficulty ID
     * @returns {string} Difficulty name
     */
    getDifficultyName(difficultyId) {
      const difficulties = {
        beginner: 'Cơ bản',
        intermediate: 'Trung bình',
        advanced: 'Nâng cao'
      };
      return difficulties[difficultyId] || difficultyId;
    }

    /**
     * Announce message to screen readers
     * @param {string} message - Message to announce
     */
    announceToScreenReader(message) {
      if (typeof window !== 'undefined' && window.EduLab && window.EduLab.announce) {
        window.EduLab.announce(message);
      }
    }
  }

  /* ========================================
     Export
     ======================================== */

  const phetIntegration = new PhETIntegration();
  global.PhETIntegration = phetIntegration;

  /* ========================================
     Development Helpers
     ======================================== */

  if (typeof window !== 'undefined' && window.console) {
    window.EduLabPhET = {
      embed: (container, simulation, options) => phetIntegration.embedSimulation(container, simulation, options),
      reload: (id) => phetIntegration.reloadSimulation(id),
      remove: (id) => phetIntegration.removeSimulation(id),
      toggleFullscreen: (id) => phetIntegration.toggleFullscreen(id),
      getLoaded: () => Array.from(phetIntegration.loadedSimulations.keys())
    };
  }

})(typeof window !== 'undefined' ? window : global);
