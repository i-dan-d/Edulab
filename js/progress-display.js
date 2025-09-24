/* ========================================
   EduLab Progress Display
   Visual progress tracking components
   ======================================== */

(function(global) {
  'use strict';

  /* ========================================
     Progress Display Class
     ======================================== */

  class ProgressDisplay {
    constructor(completionTracker) {
      this.completionTracker = completionTracker;
      this.updateInterval = null;
      this.animationDuration = 300;
      
      // Listen for completion events
      this.setupEventListeners();
    }

    /* ========================================
       Public Methods
       ======================================== */

    /**
     * Render completion statistics widget
     * @param {HTMLElement|string} container - Container element or selector
     * @param {Object} options - Display options
     * @returns {HTMLElement} Created stats widget
     */
    renderStatistics(container, options = {}) {
      const containerEl = typeof container === 'string' 
        ? document.querySelector(container) 
        : container;

      if (!containerEl) {
        throw new Error('Container element not found');
      }

      const stats = this.completionTracker.getStatistics();
      const widget = this.createStatisticsWidget(stats, options);
      
      containerEl.appendChild(widget);
      
      // Start auto-update if enabled
      if (options.autoUpdate !== false) {
        this.startAutoUpdate(widget);
      }

      return widget;
    }

    /**
     * Add completion badge to simulation card
     * @param {HTMLElement} cardElement - Simulation card element
     * @param {string} simulationId - Simulation ID
     * @param {Object} options - Badge options
     */
    addCompletionBadge(cardElement, simulationId, options = {}) {
      // Remove existing badge
      const existingBadge = cardElement.querySelector('.completion-badge');
      if (existingBadge) {
        existingBadge.remove();
      }

      const isCompleted = this.completionTracker.isCompleted(simulationId);
      const isAccessed = this.completionTracker.isAccessed(simulationId);

      if (isCompleted || isAccessed) {
        const badge = this.createCompletionBadge(simulationId, isCompleted, isAccessed, options);
        cardElement.appendChild(badge);
        
        // Add card styling
        if (isCompleted) {
          cardElement.classList.add('completed');
        } else if (isAccessed) {
          cardElement.classList.add('accessed');
        }
      }
    }

    /**
     * Add progress ring to simulation card
     * @param {HTMLElement} cardElement - Simulation card element
     * @param {string} simulationId - Simulation ID
     * @param {Object} options - Ring options
     */
    addProgressRing(cardElement, simulationId, options = {}) {
      // Remove existing ring
      const existingRing = cardElement.querySelector('.progress-ring');
      if (existingRing) {
        existingRing.remove();
      }

      const isCompleted = this.completionTracker.isCompleted(simulationId);
      const isAccessed = this.completionTracker.isAccessed(simulationId);

      if (isCompleted || isAccessed) {
        const ring = this.createProgressRing(simulationId, isCompleted, isAccessed, options);
        cardElement.appendChild(ring);
      }
    }

    /**
     * Create progress bar widget
     * @param {number} current - Current progress value
     * @param {number} total - Total progress value
     * @param {Object} options - Progress bar options
     * @returns {HTMLElement} Progress bar element
     */
    createProgressBar(current, total, options = {}) {
      const percentage = total > 0 ? Math.round((current / total) * 100) : 0;
      
      const container = document.createElement('div');
      container.className = 'progress-bar-container';
      
      container.innerHTML = `
        <div class="progress-bar-label">
          <span>${options.label || 'Tiến độ'}</span>
          <span>${current}/${total} (${percentage}%)</span>
        </div>
        <div class="progress-bar">
          <div class="progress-bar-fill" style="width: ${percentage}%" role="progressbar" 
               aria-valuenow="${current}" aria-valuemin="0" aria-valuemax="${total}"
               aria-label="${options.ariaLabel || `Tiến độ: ${current} trong số ${total}`}">
          </div>
        </div>
      `;

      return container;
    }

    /**
     * Show completion celebration
     * @param {string} simulationId - Simulation ID
     * @param {string} simulationTitle - Simulation title
     */
    showCompletionCelebration(simulationId, simulationTitle) {
      const celebration = this.createCelebrationModal(simulationId, simulationTitle);
      document.body.appendChild(celebration);

      // Auto-remove after delay
      setTimeout(() => {
        if (celebration.parentNode) {
          celebration.parentNode.removeChild(celebration);
        }
      }, 4000);

      // Announce to screen readers
      this.announceCompletion(simulationTitle);
    }

    /**
     * Update all progress indicators on page
     */
    updateAllIndicators() {
      // Update completion badges
      const cards = document.querySelectorAll('.simulation-card[data-simulation-id]');
      cards.forEach(card => {
        const simulationId = card.getAttribute('data-simulation-id');
        if (simulationId) {
          this.addCompletionBadge(card, simulationId);
        }
      });

      // Update statistics widgets
      const statsWidgets = document.querySelectorAll('.completion-stats');
      statsWidgets.forEach(widget => {
        this.updateStatisticsWidget(widget);
      });
    }

    /* ========================================
       Private Methods - Widget Creation
       ======================================== */

    /**
     * Create statistics widget
     * @param {Object} stats - Statistics data
     * @param {Object} options - Widget options
     * @returns {HTMLElement} Statistics widget
     */
    createStatisticsWidget(stats, options) {
      const widget = document.createElement('div');
      widget.className = 'completion-stats';
      widget.setAttribute('role', 'region');
      widget.setAttribute('aria-label', 'Thống kê tiến độ học tập');

      widget.innerHTML = `
        <div class="completion-stats-header">
          <h3 class="completion-stats-title">
            📊 Tiến độ học tập
          </h3>
        </div>
        
        <div class="completion-stats-grid">
          <div class="completion-stat-item">
            <div class="completion-stat-number">${stats.totalCompleted}</div>
            <div class="completion-stat-label">Đã hoàn thành</div>
          </div>
          
          <div class="completion-stat-item">
            <div class="completion-stat-number">${stats.totalAccessed}</div>
            <div class="completion-stat-label">Đã truy cập</div>
          </div>
          
          <div class="completion-stat-item">
            <div class="completion-stat-number">${Math.round(stats.completionRate)}%</div>
            <div class="completion-stat-label">Tỷ lệ hoàn thành</div>
          </div>
          
          <div class="completion-stat-item">
            <div class="completion-stat-number">${stats.streakDays}</div>
            <div class="completion-stat-label">Chuỗi ngày</div>
          </div>
        </div>

        ${this.createProgressBarHTML(stats.totalCompleted, stats.totalAccessed)}
        
        ${options.showRecentActivity !== false ? this.createRecentActivityHTML(stats.recentlyCompleted) : ''}
        
        ${options.showActions !== false ? this.createActionsHTML() : ''}
      `;

      return widget;
    }

    /**
     * Create completion badge
     * @param {string} simulationId - Simulation ID
     * @param {boolean} isCompleted - Completion status
     * @param {boolean} isAccessed - Access status
     * @param {Object} options - Badge options
     * @returns {HTMLElement} Badge element
     */
    createCompletionBadge(simulationId, isCompleted, isAccessed, options) {
      const badge = document.createElement('div');
      
      if (isCompleted) {
        badge.className = 'completion-badge completed';
        badge.innerHTML = `
          <span class="completion-icon">✓</span>
          <span>Hoàn thành</span>
          <span class="completion-sr-only">Thí nghiệm đã hoàn thành</span>
        `;
      } else if (isAccessed) {
        badge.className = 'completion-badge accessed';
        badge.innerHTML = `
          <span class="completion-icon">👁️</span>
          <span>Đã xem</span>
          <span class="completion-sr-only">Thí nghiệm đã được xem</span>
        `;
      }

      badge.setAttribute('aria-label', isCompleted ? 'Đã hoàn thành' : 'Đã truy cập');
      return badge;
    }

    /**
     * Create progress ring
     * @param {string} simulationId - Simulation ID
     * @param {boolean} isCompleted - Completion status
     * @param {boolean} isAccessed - Access status
     * @param {Object} options - Ring options
     * @returns {HTMLElement} Ring element
     */
    createProgressRing(simulationId, isCompleted, isAccessed, options) {
      const ring = document.createElement('div');
      
      if (isCompleted) {
        ring.className = 'progress-ring completed';
        ring.innerHTML = '✓';
        ring.setAttribute('aria-label', 'Đã hoàn thành');
      } else if (isAccessed) {
        ring.className = 'progress-ring accessed';
        ring.innerHTML = '•';
        ring.setAttribute('aria-label', 'Đã truy cập');
      }

      ring.setAttribute('role', 'status');
      return ring;
    }

    /**
     * Create celebration modal
     * @param {string} simulationId - Simulation ID
     * @param {string} simulationTitle - Simulation title
     * @returns {HTMLElement} Celebration modal
     */
    createCelebrationModal(simulationId, simulationTitle) {
      const modal = document.createElement('div');
      modal.className = 'completion-celebration-modal';
      modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        animation: celebrationFadeIn 0.3s ease-out;
      `;

      modal.innerHTML = `
        <div class="celebration-content" style="
          background: white;
          border-radius: 16px;
          padding: 32px;
          text-align: center;
          max-width: 400px;
          margin: 20px;
          animation: celebrationBounce 0.6s ease-out;
        ">
          <div style="font-size: 4rem; margin-bottom: 16px;">🎉</div>
          <h2 style="color: #4caf50; margin-bottom: 8px;">Chúc mừng!</h2>
          <p style="margin-bottom: 16px;">Bạn đã hoàn thành thí nghiệm:</p>
          <p style="font-weight: bold; color: #1a73e8; margin-bottom: 24px;">${this.escapeHTML(simulationTitle)}</p>
          <button onclick="this.closest('.completion-celebration-modal').remove()" 
                  style="background: #4caf50; color: white; border: none; padding: 12px 24px; 
                         border-radius: 8px; cursor: pointer; font-weight: 500;">
            Tiếp tục học tập
          </button>
        </div>
      `;

      // Add CSS animations
      const style = document.createElement('style');
      style.textContent = `
        @keyframes celebrationFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes celebrationBounce {
          0% { transform: scale(0.8) translateY(20px); opacity: 0; }
          50% { transform: scale(1.05) translateY(-5px); }
          100% { transform: scale(1) translateY(0); opacity: 1; }
        }
      `;
      document.head.appendChild(style);

      return modal;
    }

    /* ========================================
       Private Methods - HTML Generation
       ======================================== */

    /**
     * Create progress bar HTML
     * @param {number} completed - Completed count
     * @param {number} accessed - Accessed count
     * @returns {string} Progress bar HTML
     */
    createProgressBarHTML(completed, accessed) {
      const percentage = accessed > 0 ? Math.round((completed / accessed) * 100) : 0;
      
      return `
        <div class="progress-bar-container">
          <div class="progress-bar-label">
            <span>Tỷ lệ hoàn thành</span>
            <span>${completed}/${accessed} (${percentage}%)</span>
          </div>
          <div class="progress-bar">
            <div class="progress-bar-fill" style="width: ${percentage}%" 
                 role="progressbar" aria-valuenow="${completed}" 
                 aria-valuemin="0" aria-valuemax="${accessed}">
            </div>
          </div>
        </div>
      `;
    }

    /**
     * Create recent activity HTML
     * @param {Array} recentlyCompleted - Recently completed simulations
     * @returns {string} Recent activity HTML
     */
    createRecentActivityHTML(recentlyCompleted) {
      if (!recentlyCompleted || recentlyCompleted.length === 0) {
        return '';
      }

      const activityItems = recentlyCompleted.slice(0, 3).map(completion => {
        const timeAgo = this.getTimeAgo(completion.completedAt);
        return `
          <li class="recent-activity-item">
            <div class="recent-activity-icon">✓</div>
            <div class="recent-activity-content">
              <div class="recent-activity-title-text">Hoàn thành thí nghiệm</div>
              <div class="recent-activity-time">${timeAgo}</div>
            </div>
          </li>
        `;
      }).join('');

      return `
        <div class="recent-activity">
          <h4 class="recent-activity-title">
            ⏱️ Hoạt động gần đây
          </h4>
          <ul class="recent-activity-list">
            ${activityItems}
          </ul>
        </div>
      `;
    }

    /**
     * Create actions HTML
     * @returns {string} Actions HTML
     */
    createActionsHTML() {
      return `
        <div class="completion-actions">
          <button class="completion-btn" onclick="window.ProgressDisplay?.exportProgress()">
            📊 Xuất tiến độ
          </button>
          <button class="completion-btn" onclick="window.ProgressDisplay?.resetProgress()">
            🔄 Đặt lại
          </button>
        </div>
      `;
    }

    /* ========================================
       Private Methods - Event Handling
       ======================================== */

    /**
     * Setup event listeners for completion tracking
     */
    setupEventListeners() {
      if (this.completionTracker) {
        this.completionTracker.addEventListener('completed', (data) => {
          this.updateAllIndicators();
        });

        this.completionTracker.addEventListener('accessed', (data) => {
          this.updateAllIndicators();
        });

        this.completionTracker.addEventListener('cleared', (data) => {
          this.updateAllIndicators();
        });
      }
    }

    /**
     * Start auto-update for statistics widget
     * @param {HTMLElement} widget - Statistics widget
     */
    startAutoUpdate(widget) {
      if (this.updateInterval) {
        clearInterval(this.updateInterval);
      }

      this.updateInterval = setInterval(() => {
        this.updateStatisticsWidget(widget);
      }, 30000); // Update every 30 seconds
    }

    /**
     * Update statistics widget content
     * @param {HTMLElement} widget - Statistics widget
     */
    updateStatisticsWidget(widget) {
      const stats = this.completionTracker.getStatistics();
      
      // Update numbers
      const statNumbers = widget.querySelectorAll('.completion-stat-number');
      if (statNumbers.length >= 4) {
        statNumbers[0].textContent = stats.totalCompleted;
        statNumbers[1].textContent = stats.totalAccessed;
        statNumbers[2].textContent = Math.round(stats.completionRate) + '%';
        statNumbers[3].textContent = stats.streakDays;
      }

      // Update progress bar
      const progressFill = widget.querySelector('.progress-bar-fill');
      if (progressFill) {
        const percentage = stats.totalAccessed > 0 ? 
          Math.round((stats.totalCompleted / stats.totalAccessed) * 100) : 0;
        progressFill.style.width = percentage + '%';
        progressFill.setAttribute('aria-valuenow', stats.totalCompleted);
        progressFill.setAttribute('aria-valuemax', stats.totalAccessed);
      }
    }

    /* ========================================
       Private Methods - Utilities
       ======================================== */

    /**
     * Get time ago string
     * @param {number} timestamp - Timestamp
     * @returns {string} Time ago string
     */
    getTimeAgo(timestamp) {
      const now = Date.now();
      const diff = now - timestamp;
      const seconds = Math.floor(diff / 1000);
      const minutes = Math.floor(seconds / 60);
      const hours = Math.floor(minutes / 60);
      const days = Math.floor(hours / 24);

      if (days > 0) {
        return `${days} ngày trước`;
      } else if (hours > 0) {
        return `${hours} giờ trước`;
      } else if (minutes > 0) {
        return `${minutes} phút trước`;
      } else {
        return 'Vừa xong';
      }
    }

    /**
     * Escape HTML to prevent XSS
     * @param {string} text - Text to escape
     * @returns {string} Escaped text
     */
    escapeHTML(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    /**
     * Announce completion to screen readers
     * @param {string} simulationTitle - Simulation title
     */
    announceCompletion(simulationTitle) {
      if (typeof window !== 'undefined' && window.EduLab && window.EduLab.announce) {
        window.EduLab.announce(`Chúc mừng! Bạn đã hoàn thành thí nghiệm ${simulationTitle}`);
      }
    }

    /* ========================================
       Public Methods - Actions
       ======================================== */

    /**
     * Export progress data
     */
    exportProgress() {
      const data = this.completionTracker.exportData();
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `edulab-progress-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }

    /**
     * Reset all progress
     */
    resetProgress() {
      if (confirm('Bạn có chắc chắn muốn xóa toàn bộ tiến độ học tập? Hành động này không thể hoàn tác.')) {
        this.completionTracker.clearAllData();
        this.updateAllIndicators();
        
        if (typeof window !== 'undefined' && window.EduLab && window.EduLab.announce) {
          window.EduLab.announce('Đã xóa toàn bộ tiến độ học tập');
        }
      }
    }
  }

  /* ========================================
     Export
     ======================================== */

  global.ProgressDisplay = ProgressDisplay;

  /* ========================================
     Auto-initialization
     ======================================== */

  if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', () => {
      if (window.CompletionTracker) {
        window.ProgressDisplay = new ProgressDisplay(window.CompletionTracker);
        console.log('ProgressDisplay initialized');
      }
    });
  }

  /* ========================================
     Development Helpers
     ======================================== */

  if (typeof window !== 'undefined' && window.console) {
    window.EduLabProgress = {
      create: (tracker) => new ProgressDisplay(tracker),
      showStats: (container) => {
        if (window.ProgressDisplay) {
          return window.ProgressDisplay.renderStatistics(container);
        }
      },
      updateAll: () => {
        if (window.ProgressDisplay) {
          window.ProgressDisplay.updateAllIndicators();
        }
      }
    };
  }

})(typeof window !== 'undefined' ? window : global);

