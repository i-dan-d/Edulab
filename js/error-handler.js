/* ========================================
   EduLab Centralized Error Handler
   Comprehensive error management system
   ======================================== */

(function(global) {
  'use strict';

  /* ========================================
     Error Handler Class
     ======================================== */

  class ErrorHandler {
    constructor() {
      this.errorQueue = [];
      this.maxQueueSize = 50;
      this.errorContainer = null;
      this.isInitialized = false;
      this.retryAttempts = new Map();
      this.maxRetryAttempts = 3;
      
      this.errorTypes = {
        NETWORK: 'network',
        PHET_LOADING: 'phet_loading',
        DATA_LOADING: 'data_loading',
        AUTHENTICATION: 'authentication',
        VALIDATION: 'validation',
        PERMISSION: 'permission',
        UNKNOWN: 'unknown'
      };

      this.errorMessages = {
        [this.errorTypes.NETWORK]: {
          title: 'Lỗi kết nối mạng',
          message: 'Không thể kết nối đến máy chủ. Vui lòng kiểm tra kết nối internet.',
          icon: '🌐',
          actions: ['retry', 'refresh']
        },
        [this.errorTypes.PHET_LOADING]: {
          title: 'Lỗi tải thí nghiệm',
          message: 'Không thể tải thí nghiệm PhET. Có thể do kết nối mạng hoặc thí nghiệm không khả dụng.',
          icon: '🧪',
          actions: ['retry', 'alternative']
        },
        [this.errorTypes.DATA_LOADING]: {
          title: 'Lỗi tải dữ liệu',
          message: 'Không thể tải dữ liệu ứng dụng. Vui lòng thử lại sau.',
          icon: '📄',
          actions: ['retry', 'refresh']
        },
        [this.errorTypes.AUTHENTICATION]: {
          title: 'Lỗi xác thực',
          message: 'Phiên đăng nhập đã hết hạn hoặc không hợp lệ.',
          icon: '🔐',
          actions: ['login']
        },
        [this.errorTypes.VALIDATION]: {
          title: 'Dữ liệu không hợp lệ',
          message: 'Dữ liệu nhập vào không đúng định dạng. Vui lòng kiểm tra lại.',
          icon: '⚠️',
          actions: ['dismiss']
        },
        [this.errorTypes.PERMISSION]: {
          title: 'Không có quyền truy cập',
          message: 'Bạn không có quyền thực hiện thao tác này.',
          icon: '🚫',
          actions: ['login', 'dismiss']
        },
        [this.errorTypes.UNKNOWN]: {
          title: 'Lỗi không xác định',
          message: 'Đã xảy ra lỗi không mong muốn. Vui lòng thử lại.',
          icon: '❓',
          actions: ['retry', 'refresh']
        }
      };
    }

    /* ========================================
       Public Methods - Error Handling
       ======================================== */

    /**
     * Initialize error handler
     */
    init() {
      if (this.isInitialized) return;

      this.createErrorContainer();
      this.setupGlobalErrorHandlers();
      this.setupUnhandledRejectionHandler();
      this.isInitialized = true;

      console.log('ErrorHandler initialized');
    }

    /**
     * Handle and display error
     * @param {Error|string} error - Error object or message
     * @param {string} type - Error type
     * @param {Object} context - Additional context
     * @param {Object} options - Display options
     */
    handleError(error, type = this.errorTypes.UNKNOWN, context = {}, options = {}) {
      const errorObj = this.normalizeError(error, type, context);
      
      // Add to queue
      this.addToQueue(errorObj);
      
      // Log error
      this.logError(errorObj);
      
      // Display error if not suppressed
      if (!options.silent) {
        this.displayError(errorObj, options);
      }

      // Trigger custom event
      this.triggerErrorEvent(errorObj);

      return errorObj.id;
    }

    /**
     * Handle network errors specifically
     * @param {Error} error - Network error
     * @param {string} url - Failed URL
     * @param {Object} options - Retry options
     */
    handleNetworkError(error, url = '', options = {}) {
      const context = {
        url,
        timestamp: Date.now(),
        userAgent: navigator.userAgent,
        online: navigator.onLine
      };

      const errorId = this.handleError(error, this.errorTypes.NETWORK, context, options);

      // Setup retry if enabled
      if (options.enableRetry !== false) {
        this.setupRetry(errorId, options.retryCallback);
      }

      return errorId;
    }

    /**
     * Handle PhET loading errors
     * @param {Error} error - PhET loading error
     * @param {string} simulationId - Simulation ID
     * @param {Object} options - Options
     */
    handlePhETError(error, simulationId = '', options = {}) {
      const context = {
        simulationId,
        timestamp: Date.now(),
        userAgent: navigator.userAgent
      };

      const errorId = this.handleError(error, this.errorTypes.PHET_LOADING, context, options);

      // Setup alternative suggestions
      if (options.showAlternatives !== false) {
        this.setupAlternatives(errorId, simulationId);
      }

      return errorId;
    }

    /**
     * Clear specific error
     * @param {string} errorId - Error ID
     */
    clearError(errorId) {
      const errorElement = document.getElementById(`error-${errorId}`);
      if (errorElement) {
        errorElement.remove();
      }

      // Remove from queue
      this.errorQueue = this.errorQueue.filter(e => e.id !== errorId);
    }

    /**
     * Clear all errors
     */
    clearAllErrors() {
      if (this.errorContainer) {
        this.errorContainer.innerHTML = '';
      }
      this.errorQueue = [];
      this.retryAttempts.clear();
    }

    /**
     * Get error statistics
     * @returns {Object} Error statistics
     */
    getErrorStats() {
      const now = Date.now();
      const last24h = this.errorQueue.filter(e => now - e.timestamp < 24 * 60 * 60 * 1000);
      
      const typeCount = {};
      last24h.forEach(error => {
        typeCount[error.type] = (typeCount[error.type] || 0) + 1;
      });

      return {
        total: this.errorQueue.length,
        last24h: last24h.length,
        byType: typeCount,
        mostRecent: this.errorQueue[this.errorQueue.length - 1] || null
      };
    }

    /* ========================================
       Private Methods - Error Processing
       ======================================== */

    /**
     * Normalize error to standard format
     * @param {Error|string} error - Error
     * @param {string} type - Error type
     * @param {Object} context - Context
     * @returns {Object} Normalized error
     */
    normalizeError(error, type, context) {
      const errorObj = {
        id: this.generateErrorId(),
        type: type,
        timestamp: Date.now(),
        message: '',
        stack: '',
        context: context,
        resolved: false
      };

      if (error instanceof Error) {
        errorObj.message = error.message;
        errorObj.stack = error.stack;
        errorObj.name = error.name;
      } else if (typeof error === 'string') {
        errorObj.message = error;
      } else {
        errorObj.message = 'Unknown error occurred';
      }

      return errorObj;
    }

    /**
     * Add error to queue
     * @param {Object} errorObj - Error object
     */
    addToQueue(errorObj) {
      this.errorQueue.push(errorObj);
      
      // Maintain queue size
      if (this.errorQueue.length > this.maxQueueSize) {
        this.errorQueue.shift();
      }
    }

    /**
     * Log error to console
     * @param {Object} errorObj - Error object
     */
    logError(errorObj) {
      const logData = {
        id: errorObj.id,
        type: errorObj.type,
        message: errorObj.message,
        context: errorObj.context,
        timestamp: new Date(errorObj.timestamp).toISOString()
      };

      console.error('EduLab Error:', logData);
      
      if (errorObj.stack) {
        console.error('Stack trace:', errorObj.stack);
      }
    }

    /**
     * Display error in UI
     * @param {Object} errorObj - Error object
     * @param {Object} options - Display options
     */
    displayError(errorObj, options = {}) {
      if (!this.errorContainer) return;

      const errorConfig = this.errorMessages[errorObj.type] || this.errorMessages[this.errorTypes.UNKNOWN];
      const errorElement = this.createErrorElement(errorObj, errorConfig, options);
      
      this.errorContainer.appendChild(errorElement);

      // Auto-dismiss after delay if specified
      if (options.autoDismiss !== false) {
        setTimeout(() => {
          this.clearError(errorObj.id);
        }, options.dismissDelay || 10000);
      }

      // Scroll into view
      errorElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    /**
     * Create error element
     * @param {Object} errorObj - Error object
     * @param {Object} errorConfig - Error configuration
     * @param {Object} options - Options
     * @returns {HTMLElement} Error element
     */
    createErrorElement(errorObj, errorConfig, options) {
      const errorEl = document.createElement('div');
      errorEl.id = `error-${errorObj.id}`;
      errorEl.className = `error-message error-${errorObj.type}`;
      errorEl.setAttribute('role', 'alert');
      errorEl.setAttribute('aria-live', 'polite');

      const actions = this.createErrorActions(errorObj, errorConfig.actions, options);
      
      errorEl.innerHTML = `
        <div class="error-content">
          <div class="error-header">
            <span class="error-icon" aria-hidden="true">${errorConfig.icon}</span>
            <h4 class="error-title">${errorConfig.title}</h4>
            <button class="error-close" onclick="window.ErrorHandler?.clearError('${errorObj.id}')" 
                    aria-label="Đóng thông báo lỗi">✕</button>
          </div>
          <div class="error-body">
            <p class="error-message-text">${options.customMessage || errorConfig.message}</p>
            ${errorObj.context.url ? `<p class="error-details">URL: ${errorObj.context.url}</p>` : ''}
            ${options.showDetails && errorObj.message ? `<details class="error-technical">
              <summary>Chi tiết kỹ thuật</summary>
              <pre>${errorObj.message}</pre>
            </details>` : ''}
          </div>
          ${actions ? `<div class="error-actions">${actions}</div>` : ''}
        </div>
      `;

      return errorEl;
    }

    /**
     * Create error action buttons
     * @param {Object} errorObj - Error object
     * @param {Array} actions - Available actions
     * @param {Object} options - Options
     * @returns {string} Actions HTML
     */
    createErrorActions(errorObj, actions, options) {
      if (!actions || actions.length === 0) return '';

      const actionButtons = actions.map(action => {
        switch (action) {
          case 'retry':
            return `<button class="error-btn retry-btn" onclick="window.ErrorHandler?.retryAction('${errorObj.id}')">
              🔄 Thử lại
            </button>`;
          
          case 'refresh':
            return `<button class="error-btn refresh-btn" onclick="window.location.reload()">
              ↻ Tải lại trang
            </button>`;
          
          case 'alternative':
            return `<button class="error-btn alternative-btn" onclick="window.ErrorHandler?.showAlternatives('${errorObj.id}')">
              🔍 Xem thí nghiệm khác
            </button>`;
          
          case 'login':
            return `<button class="error-btn login-btn" onclick="window.location.href='teacher-login.html'">
              🔐 Đăng nhập lại
            </button>`;
          
          case 'dismiss':
            return `<button class="error-btn dismiss-btn" onclick="window.ErrorHandler?.clearError('${errorObj.id}')">
              ✓ Đã hiểu
            </button>`;
          
          default:
            return '';
        }
      }).filter(btn => btn).join('');

      return actionButtons;
    }

    /* ========================================
       Private Methods - Setup and Utils
       ======================================== */

    /**
     * Create error container
     */
    createErrorContainer() {
      this.errorContainer = document.createElement('div');
      this.errorContainer.id = 'error-container';
      this.errorContainer.className = 'error-container';
      this.errorContainer.setAttribute('aria-live', 'polite');
      this.errorContainer.setAttribute('aria-label', 'Thông báo lỗi');

      // Insert at top of body
      document.body.insertBefore(this.errorContainer, document.body.firstChild);
    }

    /**
     * Setup global error handlers
     */
    setupGlobalErrorHandlers() {
      window.addEventListener('error', (event) => {
        this.handleError(event.error || event.message, this.errorTypes.UNKNOWN, {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno
        });
      });
    }

    /**
     * Setup unhandled promise rejection handler
     */
    setupUnhandledRejectionHandler() {
      window.addEventListener('unhandledrejection', (event) => {
        this.handleError(event.reason, this.errorTypes.UNKNOWN, {
          type: 'unhandled_rejection',
          promise: event.promise
        });
      });
    }

    /**
     * Setup retry mechanism
     * @param {string} errorId - Error ID
     * @param {Function} retryCallback - Retry function
     */
    setupRetry(errorId, retryCallback) {
      if (typeof retryCallback === 'function') {
        this.retryAttempts.set(errorId, {
          callback: retryCallback,
          attempts: 0,
          maxAttempts: this.maxRetryAttempts
        });
      }
    }

    /**
     * Execute retry action
     * @param {string} errorId - Error ID
     */
    retryAction(errorId) {
      const retryInfo = this.retryAttempts.get(errorId);
      
      if (retryInfo && retryInfo.attempts < retryInfo.maxAttempts) {
        retryInfo.attempts++;
        
        try {
          retryInfo.callback();
          this.clearError(errorId);
        } catch (error) {
          if (retryInfo.attempts >= retryInfo.maxAttempts) {
            this.handleError('Đã thử lại nhiều lần nhưng vẫn lỗi', this.errorTypes.UNKNOWN);
            this.retryAttempts.delete(errorId);
          }
        }
      }
    }

    /**
     * Generate unique error ID
     * @returns {string} Error ID
     */
    generateErrorId() {
      return 'err_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
    }

    /**
     * Trigger error event
     * @param {Object} errorObj - Error object
     */
    triggerErrorEvent(errorObj) {
      const event = new CustomEvent('edulabError', {
        detail: errorObj,
        bubbles: true
      });
      document.dispatchEvent(event);
    }

    /* ========================================
       Public Methods - Action Handlers
       ======================================== */

    /**
     * Show alternatives for failed simulation
     * @param {string} errorId - Error ID
     */
    showAlternatives(errorId) {
      const error = this.errorQueue.find(e => e.id === errorId);
      if (error && error.context.simulationId) {
        // Redirect to browse page with related simulations
        window.location.href = `browse.html?related=${error.context.simulationId}`;
      }
    }

    /**
     * Setup alternatives for simulation
     * @param {string} errorId - Error ID
     * @param {string} simulationId - Simulation ID
     */
    setupAlternatives(errorId, simulationId) {
      // This could be enhanced to show inline alternatives
      console.log(`Setting up alternatives for ${simulationId}`);
    }
  }

  /* ========================================
     Export
     ======================================== */

  const errorHandler = new ErrorHandler();
  global.ErrorHandler = errorHandler;

  /* ========================================
     Auto-initialization
     ======================================== */

  if (typeof window !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => errorHandler.init());
    } else {
      errorHandler.init();
    }
  }

  /* ========================================
     Development Helpers
     ======================================== */

  if (typeof window !== 'undefined' && window.console) {
    window.EduLabError = {
      test: (type) => errorHandler.handleError('Test error', type),
      stats: () => errorHandler.getErrorStats(),
      clear: () => errorHandler.clearAllErrors(),
      network: (url) => errorHandler.handleNetworkError(new Error('Network test'), url),
      phet: (id) => errorHandler.handlePhETError(new Error('PhET test'), id)
    };
  }

})(typeof window !== 'undefined' ? window : global);



