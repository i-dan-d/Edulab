/* ========================================
   EduLab Simulation Card Renderer
   Reusable card components for simulations
   ======================================== */

(function(global) {
  'use strict';

  /* ========================================
     Card Renderer Class
     ======================================== */

  class CardRenderer {
    constructor() {
      this.cardTemplate = null;
      this.animations = true;
      this.renderCount = 0;
    }

    /* ========================================
       Public Methods
       ======================================== */

    /**
     * Render simulation cards in a container
     * @param {HTMLElement} container - Container element
     * @param {Array} simulations - Array of simulation objects
     * @param {Object} options - Rendering options
     * @returns {Promise<void>}
     */
    async renderCards(container, simulations, options = {}) {
      if (!container || !Array.isArray(simulations)) {
        throw new Error('Invalid container or simulations data');
      }

      // Clear container
      container.innerHTML = '';

      // Show loading if there are many cards
      if (simulations.length > 12) {
        this.showLoadingState(container);
      }

      try {
        // Render cards with batch processing for performance
        await this.renderCardsInBatches(container, simulations, options);
        
        // Initialize card interactions
        this.initializeCardInteractions(container);
        
        // Announce to screen readers
        this.announceResults(simulations.length);

      } catch (error) {
        console.error('Failed to render simulation cards:', error);
        this.showErrorState(container, error);
      }
    }

    /**
     * Create a single simulation card element
     * @param {Object} simulation - Simulation data
     * @param {Object} options - Card options
     * @returns {HTMLElement} Card element
     */
    createCard(simulation, options = {}) {
      const card = document.createElement('article');
      card.className = 'simulation-card';
      card.setAttribute('data-simulation-id', simulation.id);
      card.setAttribute('tabindex', '0');
      card.setAttribute('role', 'button');
      card.setAttribute('aria-label', `Thí nghiệm: ${simulation.title}`);

      card.innerHTML = this.getCardHTML(simulation, options);

      // Add click handler for navigation
      this.addCardClickHandler(card, simulation);

      // Add completion indicators if completion tracking is available
      if (typeof window !== 'undefined' && window.ProgressDisplay) {
        window.ProgressDisplay.addCompletionBadge(card, simulation.id);
      }

      return card;
    }

    /**
     * Update existing cards with new data
     * @param {HTMLElement} container - Container element
     * @param {Array} simulations - Updated simulation data
     * @param {Object} options - Update options
     */
    updateCards(container, simulations, options = {}) {
      const existingCards = container.querySelectorAll('.simulation-card');
      const simulationIds = new Set(simulations.map(sim => sim.id));

      // Remove cards that are no longer needed
      existingCards.forEach(card => {
        const cardId = card.getAttribute('data-simulation-id');
        if (!simulationIds.has(cardId)) {
          this.removeCard(card);
        }
      });

      // Update or add cards
      simulations.forEach((simulation, index) => {
        const existingCard = container.querySelector(`[data-simulation-id="${simulation.id}"]`);
        
        if (existingCard) {
          this.updateCard(existingCard, simulation, options);
        } else {
          const newCard = this.createCard(simulation, options);
          container.appendChild(newCard);
          
          // Animate new card if animations are enabled
          if (this.animations) {
            this.animateCardEntry(newCard, index);
          }
        }
      });
    }

    /**
     * Set animation preferences
     * @param {boolean} enabled - Enable/disable animations
     */
    setAnimations(enabled) {
      this.animations = enabled;
    }

    /* ========================================
       Private Methods - Card HTML Generation
       ======================================== */

    /**
     * Generate HTML for a simulation card
     * @param {Object} simulation - Simulation data
     * @param {Object} options - Card options
     * @returns {string} Card HTML
     */
    getCardHTML(simulation, options) {
      const isCustom = simulation.isCustom || false;
      const gradeDisplay = Array.isArray(simulation.gradeLevel) 
        ? simulation.gradeLevel.join(', ')
        : simulation.gradeLevel;
      
      return `
        <div class="card-thumbnail">
          ${this.getThumbnailHTML(simulation)}
          <div class="card-difficulty ${simulation.difficulty}">${this.getDifficultyLabel(simulation.difficulty)}</div>
          ${isCustom ? '<div class="custom-indicator" title="Thí nghiệm tùy chỉnh">👨‍🏫</div>' : ''}
        </div>
        
        <div class="card-content">
          <h3 class="card-title">
            ${this.escapeHTML(simulation.title)}
            ${isCustom ? '<span class="custom-badge">Tùy chỉnh</span>' : ''}
          </h3>
          
          <p class="card-description">${this.escapeHTML(simulation.description)}</p>
          
          <div class="card-meta">
            <span class="card-badge grade">Lớp ${gradeDisplay}</span>
            <span class="card-badge duration">⏱️ ${simulation.duration || '20-30'} phút</span>
            ${isCustom ? '<span class="card-badge custom">🛠️ Tùy chỉnh</span>' : ''}
          </div>
          
          ${simulation.topics ? this.getTopicsHTML(simulation.topics) : ''}
          
          <div class="card-actions">
            <a href="simulation.html?id=${simulation.id}" class="card-btn primary" 
               aria-label="Xem thí nghiệm ${simulation.title}">
              🧪 Xem thí nghiệm
            </a>
            <button class="card-btn secondary" onclick="window.CardRenderer?.showQuickPreview('${simulation.id}')"
                    aria-label="Xem trước thí nghiệm ${simulation.title}">
              👁️ Xem trước
            </button>
          </div>
        </div>
      `;
    }

    /**
     * Get thumbnail HTML for simulation
     * @param {Object} simulation - Simulation data
     * @returns {string} Thumbnail HTML
     */
    getThumbnailHTML(simulation) {
      if (simulation.thumbnailUrl) {
        return `<img src="${simulation.thumbnailUrl}" alt="Ảnh thí nghiệm ${simulation.title}" loading="lazy">`;
      }
      
      // Default thumbnail with subject icon
      const subjectIcon = this.getSubjectIcon(simulation.subject);
      return `<div class="default-thumbnail" aria-hidden="true">${subjectIcon}</div>`;
    }

    /**
     * Get topics HTML
     * @param {Array} topics - Array of topic strings
     * @returns {string} Topics HTML
     */
    getTopicsHTML(topics) {
      if (!topics || topics.length === 0) return '';

      return `
        <div class="card-topics">
          <div class="card-topics-list">
            ${topics.slice(0, 3).map(topic => 
              `<span class="topic-tag">${this.escapeHTML(topic)}</span>`
            ).join('')}
            ${topics.length > 3 ? `<span class="topic-tag">+${topics.length - 3}</span>` : ''}
          </div>
        </div>
      `;
    }

    /* ========================================
       Private Methods - Batch Rendering
       ======================================== */

    /**
     * Render cards in batches for better performance
     * @param {HTMLElement} container - Container element
     * @param {Array} simulations - Simulations to render
     * @param {Object} options - Rendering options
     */
    async renderCardsInBatches(container, simulations, options) {
      const batchSize = 8;
      const batches = this.createBatches(simulations, batchSize);

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        const fragment = document.createDocumentFragment();

        batch.forEach((simulation, index) => {
          const card = this.createCard(simulation, options);
          
          // Add staggered animation delay
          if (this.animations) {
            card.style.animationDelay = `${(i * batchSize + index) * 50}ms`;
          }
          
          fragment.appendChild(card);
        });

        container.appendChild(fragment);

        // Allow browser to render before next batch
        if (i < batches.length - 1) {
          await this.nextFrame();
        }
      }
    }

    /**
     * Create batches from array
     * @param {Array} array - Array to batch
     * @param {number} size - Batch size
     * @returns {Array} Array of batches
     */
    createBatches(array, size) {
      const batches = [];
      for (let i = 0; i < array.length; i += size) {
        batches.push(array.slice(i, i + size));
      }
      return batches;
    }

    /**
     * Wait for next animation frame
     * @returns {Promise} Promise that resolves on next frame
     */
    nextFrame() {
      return new Promise(resolve => requestAnimationFrame(resolve));
    }

    /* ========================================
       Private Methods - Card Interactions
       ======================================== */

    /**
     * Initialize card interactions
     * @param {HTMLElement} container - Container with cards
     */
    initializeCardInteractions(container) {
      const cards = container.querySelectorAll('.simulation-card');
      
      cards.forEach(card => {
        // Keyboard navigation
        card.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            const link = card.querySelector('.card-btn.primary');
            if (link) {
              link.click();
            }
          }
        });

        // Mouse interactions
        card.addEventListener('mouseenter', () => this.onCardHover(card, true));
        card.addEventListener('mouseleave', () => this.onCardHover(card, false));
        
        // Touch interactions
        card.addEventListener('touchstart', () => this.onCardTouch(card), { passive: true });
      });
    }

    /**
     * Add click handler to card
     * @param {HTMLElement} card - Card element
     * @param {Object} simulation - Simulation data
     */
    addCardClickHandler(card, simulation) {
      card.addEventListener('click', (e) => {
        // Don't handle click if it's on a button or link
        if (e.target.closest('button, a')) {
          return;
        }
        
        // Navigate to simulation page
        window.location.href = `simulation.html?id=${simulation.id}`;
      });
    }

    /**
     * Handle card hover
     * @param {HTMLElement} card - Card element
     * @param {boolean} isHovering - Whether mouse is hovering
     */
    onCardHover(card, isHovering) {
      if (isHovering) {
        card.style.zIndex = '10';
        this.announceCardHover(card);
      } else {
        card.style.zIndex = '';
      }
    }

    /**
     * Handle card touch
     * @param {HTMLElement} card - Card element
     */
    onCardTouch(card) {
      // Add touch feedback
      card.style.transform = 'scale(0.98)';
      setTimeout(() => {
        card.style.transform = '';
      }, 150);
    }

    /* ========================================
       Private Methods - Card Updates
       ======================================== */

    /**
     * Update an existing card
     * @param {HTMLElement} card - Card element to update
     * @param {Object} simulation - Updated simulation data
     * @param {Object} options - Update options
     */
    updateCard(card, simulation, options) {
      // Update title
      const title = card.querySelector('.card-title');
      if (title) {
        title.textContent = simulation.title;
      }

      // Update description
      const description = card.querySelector('.card-description');
      if (description) {
        description.textContent = simulation.description;
      }

      // Update grade level
      const gradeBadge = card.querySelector('.card-badge.grade');
      if (gradeBadge) {
        gradeBadge.textContent = `Lớp ${simulation.gradeLevel}`;
      }

      // Update difficulty
      const difficulty = card.querySelector('.card-difficulty');
      if (difficulty) {
        difficulty.className = `card-difficulty ${simulation.difficulty}`;
        difficulty.textContent = this.getDifficultyLabel(simulation.difficulty);
      }

      // Update links
      const primaryLink = card.querySelector('.card-btn.primary');
      if (primaryLink) {
        primaryLink.href = `simulation.html?id=${simulation.id}`;
      }
    }

    /**
     * Remove a card with animation
     * @param {HTMLElement} card - Card to remove
     */
    removeCard(card) {
      if (this.animations) {
        card.style.animation = 'fadeOut 0.3s ease-out forwards';
        setTimeout(() => {
          if (card.parentNode) {
            card.parentNode.removeChild(card);
          }
        }, 300);
      } else {
        if (card.parentNode) {
          card.parentNode.removeChild(card);
        }
      }
    }

    /**
     * Animate card entry
     * @param {HTMLElement} card - Card to animate
     * @param {number} index - Card index for delay
     */
    animateCardEntry(card, index) {
      card.style.opacity = '0';
      card.style.transform = 'translateY(20px)';
      
      setTimeout(() => {
        card.style.transition = 'opacity 0.4s ease-out, transform 0.4s ease-out';
        card.style.opacity = '1';
        card.style.transform = 'translateY(0)';
      }, index * 50);
    }

    /* ========================================
       Private Methods - State Management
       ======================================== */

    /**
     * Show loading state in container
     * @param {HTMLElement} container - Container element
     */
    showLoadingState(container) {
      container.innerHTML = `
        <div class="library-loading">
          <div class="library-spinner"></div>
          <div class="loading-text">Đang tải thí nghiệm...</div>
        </div>
      `;
    }

    /**
     * Show error state in container
     * @param {HTMLElement} container - Container element
     * @param {Error} error - Error that occurred
     */
    showErrorState(container, error) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">⚠️</div>
          <h3 class="empty-title">Không thể tải thí nghiệm</h3>
          <p class="empty-message">${error.message}</p>
          <button class="empty-action" onclick="location.reload()">
            Thử lại
          </button>
        </div>
      `;
    }

    /* ========================================
       Private Methods - Utilities
       ======================================== */

    /**
     * Get difficulty label in Vietnamese
     * @param {string} difficulty - Difficulty level
     * @returns {string} Vietnamese label
     */
    getDifficultyLabel(difficulty) {
      const labels = {
        beginner: 'Cơ bản',
        intermediate: 'Trung bình',
        advanced: 'Nâng cao'
      };
      return labels[difficulty] || difficulty;
    }

    /**
     * Get subject icon
     * @param {string} subject - Subject ID
     * @returns {string} Subject icon
     */
    getSubjectIcon(subject) {
      const icons = {
        physics: '⚛️',
        chemistry: '🧪',
        biology: '🔬',
        mathematics: '📊'
      };
      return icons[subject] || '🧪';
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
     * Announce results count to screen readers
     * @param {number} count - Number of results
     */
    announceResults(count) {
      if (typeof window !== 'undefined' && window.EduLab && window.EduLab.announce) {
        const message = count === 0 
          ? 'Không tìm thấy thí nghiệm nào'
          : `Tìm thấy ${count} thí nghiệm`;
        window.EduLab.announce(message);
      }
    }

    /**
     * Announce card hover to screen readers
     * @param {HTMLElement} card - Card being hovered
     */
    announceCardHover(card) {
      const title = card.querySelector('.card-title');
      if (title && typeof window !== 'undefined' && window.EduLab && window.EduLab.announce) {
        window.EduLab.announce(`Đang xem: ${title.textContent}`);
      }
    }

    /* ========================================
       Public Methods - Quick Preview
       ======================================== */

    /**
     * Show quick preview modal for simulation
     * @param {string} simulationId - Simulation ID
     */
    async showQuickPreview(simulationId) {
      try {
        if (!window.DataManager) {
          throw new Error('DataManager not available');
        }

        const simulation = await window.DataManager.getSimulationById(simulationId);
        if (!simulation) {
          throw new Error('Simulation not found');
        }

        this.createPreviewModal(simulation);

      } catch (error) {
        console.error('Failed to show preview:', error);
        if (typeof window !== 'undefined' && window.EduLab && window.EduLab.announce) {
          window.EduLab.announce('Không thể hiển thị xem trước');
        }
      }
    }

    /**
     * Create preview modal
     * @param {Object} simulation - Simulation data
     */
    createPreviewModal(simulation) {
      const modal = document.createElement('div');
      modal.className = 'preview-modal';
      modal.innerHTML = `
        <div class="modal-backdrop">
          <div class="modal-content">
            <div class="modal-header">
              <h3>${this.escapeHTML(simulation.title)}</h3>
              <button class="modal-close" aria-label="Đóng">&times;</button>
            </div>
            <div class="modal-body">
              <p><strong>Mô tả:</strong> ${this.escapeHTML(simulation.description)}</p>
              <p><strong>Cấp độ:</strong> ${this.getDifficultyLabel(simulation.difficulty)}</p>
              <p><strong>Thời lượng:</strong> ${simulation.duration || '20-30 phút'}</p>
              ${simulation.learningObjectives ? `
                <p><strong>Mục tiêu học tập:</strong></p>
                <ul>
                  ${simulation.learningObjectives.slice(0, 3).map(obj => 
                    `<li>${this.escapeHTML(obj)}</li>`
                  ).join('')}
                </ul>
              ` : ''}
            </div>
            <div class="modal-actions">
              <a href="simulation.html?id=${simulation.id}" class="btn btn-primary">
                Xem thí nghiệm
              </a>
              <button class="btn btn-secondary modal-close">
                Đóng
              </button>
            </div>
          </div>
        </div>
      `;

      // Add styles
      const modalStyle = document.createElement('style');
      modalStyle.textContent = `
        .preview-modal {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0,0,0,0.5);
          z-index: 10000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }
        
        .preview-modal .modal-content {
          background: white;
          border-radius: 12px;
          max-width: 500px;
          max-height: 80vh;
          overflow-y: auto;
          padding: 24px;
          margin: auto;
          box-shadow: 0 20px 40px rgba(0,0,0,0.3);
        }
        
        .preview-modal .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
          padding-bottom: 16px;
          border-bottom: 1px solid #e0e0e0;
        }
        
        .preview-modal .modal-close {
          background: none;
          border: none;
          font-size: 24px;
          cursor: pointer;
          padding: 8px;
          border-radius: 4px;
          color: #666;
        }
        
        .preview-modal .modal-actions {
          display: flex;
          gap: 12px;
          margin-top: 24px;
          justify-content: center;
        }
        
        .preview-modal .btn {
          padding: 12px 24px;
          border: none;
          border-radius: 6px;
          font-weight: 500;
          cursor: pointer;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        
        .preview-modal .btn-primary {
          background: #1a73e8;
          color: white;
        }
        
        .preview-modal .btn-secondary {
          background: #f1f3f4;
          color: #3c4043;
        }
        
        @media (max-width: 768px) {
          .preview-modal {
            padding: 10px;
          }
          
          .preview-modal .modal-content {
            max-width: 100%;
            padding: 16px;
          }
          
          .preview-modal .modal-actions {
            flex-direction: column;
          }
        }
      `;
      document.head.appendChild(modalStyle);

      // Add event listeners
      const closeButtons = modal.querySelectorAll('.modal-close');
      closeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
          document.body.removeChild(modal);
        });
      });

      modal.addEventListener('click', (e) => {
        if (e.target === modal.querySelector('.modal-backdrop')) {
          document.body.removeChild(modal);
        }
      });

      document.body.appendChild(modal);
      modal.querySelector('.modal-close').focus();
    }
  }

  /* ========================================
     Export
     ======================================== */

  const cardRenderer = new CardRenderer();
  global.CardRenderer = cardRenderer;

  /* ========================================
     Development Helpers
     ======================================== */

  if (typeof window !== 'undefined' && window.console) {
    window.EduLabCardRenderer = {
      render: (container, simulations, options) => cardRenderer.renderCards(container, simulations, options),
      create: (simulation, options) => cardRenderer.createCard(simulation, options),
      update: (container, simulations, options) => cardRenderer.updateCards(container, simulations, options),
      setAnimations: (enabled) => cardRenderer.setAnimations(enabled)
    };
  }

})(typeof window !== 'undefined' ? window : global);
