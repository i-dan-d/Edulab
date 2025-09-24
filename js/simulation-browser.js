/* ========================================
   EduLab Simulation Browser
   Main browsing interface controller
   ======================================== */

(function(global) {
  'use strict';

  /* ========================================
     Simulation Browser Class
     ======================================== */

  class SimulationBrowser {
    constructor(dataManager, contentFilter, cardRenderer) {
      this.dataManager = dataManager;
      this.contentFilter = contentFilter;
      this.cardRenderer = cardRenderer;
      
      this.currentView = 'all';
      this.currentFilters = {
        subject: null,
        gradeLevel: null,
        difficulty: null,
        search: ''
      };
      
      this.elements = {};
      this.isInitialized = false;
      this.searchTimeout = null;
    }

    /* ========================================
       Public Methods
       ======================================== */

    /**
     * Initialize the simulation browser
     * @param {string|HTMLElement} container - Container selector or element
     * @returns {Promise<void>}
     */
    async initialize(container) {
      try {
        // Get container element
        this.elements.container = typeof container === 'string' 
          ? document.querySelector(container) 
          : container;

        if (!this.elements.container) {
          throw new Error('Container element not found');
        }

        // Initialize content filter
        await this.contentFilter.initialize();

        // Cache DOM elements
        this.cacheElements();

        // Set up event listeners
        this.setupEventListeners();

        // Load initial data
        await this.loadInitialData();

        // Mark as initialized
        this.isInitialized = true;

        console.log('SimulationBrowser initialized');

      } catch (error) {
        console.error('Failed to initialize SimulationBrowser:', error);
        this.showError('Không thể khởi tạo giao diện duyệt thí nghiệm');
        throw error;
      }
    }

    /**
     * Set current subject filter
     * @param {string|null} subject - Subject ID or null for all
     */
    async setSubject(subject) {
      this.currentFilters.subject = subject;
      await this.updateResults();
      this.updateFilterUI();
    }

    /**
     * Set current grade level filter
     * @param {string|null} gradeLevel - Grade level or null for all
     */
    async setGradeLevel(gradeLevel) {
      this.currentFilters.gradeLevel = gradeLevel;
      await this.updateResults();
      this.updateFilterUI();
    }

    /**
     * Set current difficulty filter
     * @param {string|null} difficulty - Difficulty level or null for all
     */
    async setDifficulty(difficulty) {
      this.currentFilters.difficulty = difficulty;
      await this.updateResults();
      this.updateFilterUI();
    }

    /**
     * Set search query
     * @param {string} query - Search query
     */
    setSearch(query) {
      this.currentFilters.search = query.trim();
      
      // Debounce search to avoid too many updates
      if (this.searchTimeout) {
        clearTimeout(this.searchTimeout);
      }
      
      this.searchTimeout = setTimeout(() => {
        this.updateResults();
      }, 300);
    }

    /**
     * Clear all filters
     */
    async clearFilters() {
      this.currentFilters = {
        subject: null,
        gradeLevel: null,
        difficulty: null,
        search: ''
      };
      
      await this.updateResults();
      this.updateFilterUI();
      this.clearSearchInput();
    }

    /**
     * Get current statistics
     * @returns {Object} Browser statistics
     */
    getStatistics() {
      return {
        isInitialized: this.isInitialized,
        currentFilters: { ...this.currentFilters },
        currentView: this.currentView,
        resultsCount: this.getResultsCount()
      };
    }

    /* ========================================
       Private Methods - Initialization
       ======================================== */

    /**
     * Cache DOM elements for performance
     */
    cacheElements() {
      const container = this.elements.container;
      
      this.elements.searchInput = container.querySelector('#search-input');
      this.elements.searchClear = container.querySelector('#search-clear');
      this.elements.subjectFilters = container.querySelector('#subject-filters');
      this.elements.gradeFilters = container.querySelector('#grade-filters');
      this.elements.difficultyFilters = container.querySelector('#difficulty-filters');
      this.elements.resultsCount = container.querySelector('#results-count');
      this.elements.simulationsGrid = container.querySelector('#simulations-grid');
      this.elements.clearFiltersBtn = container.querySelector('#clear-filters');
      this.elements.sortSelect = container.querySelector('#sort-select');
    }

    /**
     * Set up event listeners
     */
    setupEventListeners() {
      // Search input
      if (this.elements.searchInput) {
        this.elements.searchInput.addEventListener('input', (e) => {
          this.setSearch(e.target.value);
        });

        this.elements.searchInput.addEventListener('keydown', (e) => {
          if (e.key === 'Escape') {
            this.clearSearchInput();
          }
        });
      }

      // Search clear button
      if (this.elements.searchClear) {
        this.elements.searchClear.addEventListener('click', () => {
          this.clearSearchInput();
        });
      }

      // Subject filters
      if (this.elements.subjectFilters) {
        this.elements.subjectFilters.addEventListener('click', (e) => {
          if (e.target.classList.contains('filter-btn')) {
            const subject = e.target.dataset.subject || null;
            this.setSubject(subject);
          }
        });
      }

      // Grade level filters
      if (this.elements.gradeFilters) {
        this.elements.gradeFilters.addEventListener('click', (e) => {
          if (e.target.classList.contains('filter-btn')) {
            const grade = e.target.dataset.grade || null;
            this.setGradeLevel(grade);
          }
        });
      }

      // Difficulty filters
      if (this.elements.difficultyFilters) {
        this.elements.difficultyFilters.addEventListener('click', (e) => {
          if (e.target.classList.contains('filter-btn')) {
            const difficulty = e.target.dataset.difficulty || null;
            this.setDifficulty(difficulty);
          }
        });
      }

      // Clear filters button
      if (this.elements.clearFiltersBtn) {
        this.elements.clearFiltersBtn.addEventListener('click', () => {
          this.clearFilters();
        });
      }

      // Sort select
      if (this.elements.sortSelect) {
        this.elements.sortSelect.addEventListener('change', (e) => {
          this.setSortOrder(e.target.value);
        });
      }

      // Keyboard navigation
      document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 'f') {
          e.preventDefault();
          if (this.elements.searchInput) {
            this.elements.searchInput.focus();
          }
        }
      });
    }

    /**
     * Load initial data and display
     */
    async loadInitialData() {
      try {
        this.showLoading();
        
        // Set default subject to physics
        this.currentFilters.subject = 'physics';
        
        // Apply filters and get results
        await this.contentFilter.setFilters(this.currentFilters);
        const results = this.contentFilter.getResults();
        
        // Render cards
        await this.cardRenderer.renderCards(this.elements.simulationsGrid, results);
        
        // Update UI
        this.updateResultsCount(results.length);
        this.updateFilterUI();
        
        this.hideLoading();

      } catch (error) {
        console.error('Failed to load initial data:', error);
        this.showError('Không thể tải dữ liệu thí nghiệm');
      }
    }

    /* ========================================
       Private Methods - Data Management
       ======================================== */

    /**
     * Update results based on current filters
     */
    async updateResults() {
      if (!this.isInitialized) return;

      try {
        this.showLoading();

        // Apply filters
        await this.contentFilter.setFilters({
          subject: this.currentFilters.subject,
          gradeLevel: this.currentFilters.gradeLevel,
          difficulty: this.currentFilters.difficulty,
          keyword: this.currentFilters.search
        });

        // Get filtered results
        const results = this.contentFilter.getResults();

        // Render updated cards
        await this.cardRenderer.renderCards(this.elements.simulationsGrid, results);

        // Update results count
        this.updateResultsCount(results.length);

        // Show empty state if no results
        if (results.length === 0) {
          this.showEmptyState();
        }

        this.hideLoading();

      } catch (error) {
        console.error('Failed to update results:', error);
        this.showError('Không thể cập nhật kết quả');
      }
    }

    /**
     * Set sort order for results
     * @param {string} sortOrder - Sort order (title, difficulty, grade)
     */
    setSortOrder(sortOrder) {
      // Get current results
      const results = this.contentFilter.getResults();
      
      // Sort results
      const sortedResults = this.sortResults(results, sortOrder);
      
      // Re-render with sorted results
      this.cardRenderer.renderCards(this.elements.simulationsGrid, sortedResults);
    }

    /**
     * Sort results array
     * @param {Array} results - Results to sort
     * @param {string} sortOrder - Sort order
     * @returns {Array} Sorted results
     */
    sortResults(results, sortOrder) {
      const sorted = [...results];
      
      switch (sortOrder) {
        case 'title':
          return sorted.sort((a, b) => a.title.localeCompare(b.title, 'vi'));
          
        case 'difficulty':
          const difficultyOrder = { beginner: 1, intermediate: 2, advanced: 3 };
          return sorted.sort((a, b) => difficultyOrder[a.difficulty] - difficultyOrder[b.difficulty]);
          
        case 'grade':
          return sorted.sort((a, b) => a.gradeLevel.localeCompare(b.gradeLevel));
          
        default:
          return sorted;
      }
    }

    /* ========================================
       Private Methods - UI Updates
       ======================================== */

    /**
     * Update filter UI to reflect current state
     */
    updateFilterUI() {
      // Update subject filter buttons
      if (this.elements.subjectFilters) {
        this.updateFilterButtons(this.elements.subjectFilters, this.currentFilters.subject, 'subject');
      }

      // Update grade level filter buttons
      if (this.elements.gradeFilters) {
        this.updateFilterButtons(this.elements.gradeFilters, this.currentFilters.gradeLevel, 'grade');
      }

      // Update difficulty filter buttons
      if (this.elements.difficultyFilters) {
        this.updateFilterButtons(this.elements.difficultyFilters, this.currentFilters.difficulty, 'difficulty');
      }

      // Update clear filters button visibility
      this.updateClearFiltersButton();
    }

    /**
     * Update filter button states
     * @param {HTMLElement} container - Filter buttons container
     * @param {string|null} activeValue - Currently active value
     * @param {string} dataAttribute - Data attribute name
     */
    updateFilterButtons(container, activeValue, dataAttribute) {
      const buttons = container.querySelectorAll('.filter-btn');
      
      buttons.forEach(button => {
        const value = button.dataset[dataAttribute] || null;
        
        if (value === activeValue) {
          button.classList.add('active');
          button.setAttribute('aria-pressed', 'true');
        } else {
          button.classList.remove('active');
          button.setAttribute('aria-pressed', 'false');
        }
      });
    }

    /**
     * Update clear filters button visibility
     */
    updateClearFiltersButton() {
      if (!this.elements.clearFiltersBtn) return;

      const hasActiveFilters = this.currentFilters.subject !== null ||
                               this.currentFilters.gradeLevel !== null ||
                               this.currentFilters.difficulty !== null ||
                               this.currentFilters.search !== '';

      this.elements.clearFiltersBtn.style.display = hasActiveFilters ? 'block' : 'none';
    }

    /**
     * Update results count display
     * @param {number} count - Number of results
     */
    updateResultsCount(count) {
      if (!this.elements.resultsCount) return;

      const text = count === 0 
        ? 'Không tìm thấy thí nghiệm nào'
        : count === 1
        ? '1 thí nghiệm'
        : `${count} thí nghiệm`;

      this.elements.resultsCount.textContent = text;
    }

    /**
     * Clear search input
     */
    clearSearchInput() {
      if (this.elements.searchInput) {
        this.elements.searchInput.value = '';
        this.setSearch('');
      }
    }

    /**
     * Get current results count
     * @returns {number} Results count
     */
    getResultsCount() {
      return this.contentFilter.getResultCount();
    }

    /* ========================================
       Private Methods - State Management
       ======================================== */

    /**
     * Show loading state
     */
    showLoading() {
      if (this.elements.simulationsGrid) {
        this.elements.simulationsGrid.innerHTML = `
          <div class="library-loading">
            <div class="library-spinner"></div>
            <div class="loading-text">Đang tải thí nghiệm...</div>
          </div>
        `;
      }
    }

    /**
     * Hide loading state
     */
    hideLoading() {
      // Loading state will be replaced by card rendering
    }

    /**
     * Show empty state
     */
    showEmptyState() {
      if (this.elements.simulationsGrid) {
        const hasFilters = this.currentFilters.subject !== null ||
                          this.currentFilters.gradeLevel !== null ||
                          this.currentFilters.difficulty !== null ||
                          this.currentFilters.search !== '';

        this.elements.simulationsGrid.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon">🔍</div>
            <h3 class="empty-title">Không tìm thấy thí nghiệm</h3>
            <p class="empty-message">
              ${hasFilters 
                ? 'Thử điều chỉnh bộ lọc hoặc từ khóa tìm kiếm để xem thêm kết quả.'
                : 'Hiện tại chưa có thí nghiệm nào cho môn học này.'
              }
            </p>
            ${hasFilters ? `
              <button class="empty-action" onclick="window.SimulationBrowser?.clearFilters()">
                Xóa bộ lọc
              </button>
            ` : ''}
          </div>
        `;
      }
    }

    /**
     * Show error state
     * @param {string} message - Error message
     */
    showError(message) {
      if (this.elements.simulationsGrid) {
        this.elements.simulationsGrid.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon">⚠️</div>
            <h3 class="empty-title">Có lỗi xảy ra</h3>
            <p class="empty-message">${message}</p>
            <button class="empty-action" onclick="location.reload()">
              Tải lại trang
            </button>
          </div>
        `;
      }
    }

    /* ========================================
       Public Methods - Advanced Features
       ======================================== */

    /**
     * Export current results to JSON
     * @returns {string} JSON string of current results
     */
    exportResults() {
      const results = this.contentFilter.getResults();
      return JSON.stringify({
        filters: this.currentFilters,
        count: results.length,
        results: results
      }, null, 2);
    }

    /**
     * Get browsing analytics
     * @returns {Object} Analytics data
     */
    getAnalytics() {
      const stats = this.contentFilter.getFilterStatistics();
      
      return {
        totalSimulations: stats.totalSimulations,
        filteredCount: stats.filteredCount,
        filterEfficiency: stats.filteredCount / stats.totalSimulations,
        activeFilters: Object.keys(this.currentFilters).filter(key => 
          this.currentFilters[key] !== null && this.currentFilters[key] !== ''
        ).length,
        popularSubjects: Object.entries(stats.filterBreakdown.subjects)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 3)
      };
    }
  }

  /* ========================================
     Export
     ======================================== */

  global.SimulationBrowser = SimulationBrowser;

  /* ========================================
     Auto-initialization
     ======================================== */

  // Export the class for manual instantiation
  if (typeof window !== 'undefined') {
    // Store the class constructor globally
    window.SimulationBrowser = SimulationBrowser;
    
    // Also create a convenience factory method
    window.createSimulationBrowser = function(dataManager, contentFilter, cardRenderer) {
      return new SimulationBrowser(dataManager, contentFilter, cardRenderer);
    };
    
    console.log('SimulationBrowser class available');
  }

  /* ========================================
     Development Helpers
     ======================================== */

  if (typeof window !== 'undefined' && window.console) {
    window.EduLabBrowser = {
      create: (dataManager, filter, renderer) => new SimulationBrowser(dataManager, filter, renderer),
      
      testBrowser: async (containerId) => {
        if (window.SimulationBrowser) {
          try {
            await window.SimulationBrowser.initialize(containerId);
            console.log('✅ Browser test successful');
          } catch (error) {
            console.error('❌ Browser test failed:', error);
          }
        }
      },
      
      getStats: () => {
        return window.SimulationBrowser ? window.SimulationBrowser.getStatistics() : null;
      }
    };
  }

})(typeof window !== 'undefined' ? window : global);
