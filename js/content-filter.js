/* ========================================
   EduLab Content Filter
   Filtering and search functionality
   ======================================== */

(function(global) {
  'use strict';

  /* ========================================
     Content Filter Class
     ======================================== */

  class ContentFilter {
    constructor(dataManager) {
      this.dataManager = dataManager;
      this.currentFilters = {
        subject: null,
        gradeLevel: null,
        difficulty: null,
        tags: [],
        keyword: ''
      };
      this.filteredResults = [];
      this.allSimulations = [];
      this.listeners = new Map();
    }

    /* ========================================
       Public Methods
       ======================================== */

    /**
     * Initialize the filter with all simulations
     * @returns {Promise<void>}
     */
    async initialize() {
      try {
        await this.loadAllSimulations();
        this.notifyListeners('initialized', this.filteredResults);
      } catch (error) {
        console.error('Failed to initialize content filter:', error);
        throw error;
      }
    }

    /**
     * Load all simulations including custom ones
     * @returns {Promise<void>}
     */
    async loadAllSimulations() {
      try {
        // Load standard simulations
        const data = await this.dataManager.loadAllData();
        let allSimulations = data.simulations || [];
        
        // Add custom simulations if available
        if (typeof window !== 'undefined' && window.SimulationManager && window.SimulationManager.isReady()) {
          const customSimulations = window.SimulationManager.getCustomSimulations();
          allSimulations = [...allSimulations, ...customSimulations];
        }
        
        this.allSimulations = allSimulations;
        this.filteredResults = [...this.allSimulations];
        
        console.log(`📚 ContentFilter loaded ${this.allSimulations.length} simulations (including custom)`);
      } catch (error) {
        console.error('Failed to load all simulations:', error);
        throw error;
      }
    }

    /**
     * Refresh simulations data (useful when custom simulations are added/removed)
     * @returns {Promise<void>}
     */
    async refreshSimulations() {
      await this.loadAllSimulations();
      await this.applyFilters();
      this.notifyListeners('refreshed', this.filteredResults);
    }

    /**
     * Set subject filter
     * @param {string|null} subjectId - Subject ID or null to clear
     * @returns {Promise<Array>} Filtered results
     */
    async setSubjectFilter(subjectId) {
      this.currentFilters.subject = subjectId;
      return this.applyFilters();
    }

    /**
     * Set grade level filter
     * @param {string|null} gradeLevel - Grade level or null to clear
     * @returns {Promise<Array>} Filtered results
     */
    async setGradeLevelFilter(gradeLevel) {
      this.currentFilters.gradeLevel = gradeLevel;
      return this.applyFilters();
    }

    /**
     * Set difficulty filter
     * @param {string|null} difficulty - Difficulty level or null to clear
     * @returns {Promise<Array>} Filtered results
     */
    async setDifficultyFilter(difficulty) {
      this.currentFilters.difficulty = difficulty;
      return this.applyFilters();
    }

    /**
     * Set tags filter
     * @param {Array<string>} tags - Array of tag IDs
     * @returns {Promise<Array>} Filtered results
     */
    async setTagsFilter(tags) {
      this.currentFilters.tags = Array.isArray(tags) ? tags : [];
      return this.applyFilters();
    }

    /**
     * Set keyword search
     * @param {string} keyword - Search keyword
     * @returns {Promise<Array>} Filtered results
     */
    async setKeywordFilter(keyword) {
      this.currentFilters.keyword = (keyword || '').trim();
      return this.applyFilters();
    }

    /**
     * Set multiple filters at once
     * @param {Object} filters - Filters object
     * @returns {Promise<Array>} Filtered results
     */
    async setFilters(filters) {
      if (filters.subject !== undefined) {
        this.currentFilters.subject = filters.subject;
      }
      if (filters.gradeLevel !== undefined) {
        this.currentFilters.gradeLevel = filters.gradeLevel;
      }
      if (filters.difficulty !== undefined) {
        this.currentFilters.difficulty = filters.difficulty;
      }
      if (filters.tags !== undefined) {
        this.currentFilters.tags = Array.isArray(filters.tags) ? filters.tags : [];
      }
      if (filters.keyword !== undefined) {
        this.currentFilters.keyword = (filters.keyword || '').trim();
      }
      
      return this.applyFilters();
    }

    /**
     * Clear all filters
     * @returns {Promise<Array>} All simulations
     */
    async clearFilters() {
      this.currentFilters = {
        subject: null,
        gradeLevel: null,
        difficulty: null,
        tags: [],
        keyword: ''
      };
      return this.applyFilters();
    }

    /**
     * Get current filters
     * @returns {Object} Current filters
     */
    getCurrentFilters() {
      return { ...this.currentFilters };
    }

    /**
     * Get filtered results
     * @returns {Array} Current filtered results
     */
    getResults() {
      return [...this.filteredResults];
    }

    /**
     * Get total count of filtered results
     * @returns {number} Result count
     */
    getResultCount() {
      return this.filteredResults.length;
    }

    /**
     * Add event listener for filter changes
     * @param {string} event - Event name ('filter', 'initialized')
     * @param {Function} callback - Callback function
     */
    addEventListener(event, callback) {
      if (!this.listeners.has(event)) {
        this.listeners.set(event, []);
      }
      this.listeners.get(event).push(callback);
    }

    /**
     * Remove event listener
     * @param {string} event - Event name
     * @param {Function} callback - Callback function
     */
    removeEventListener(event, callback) {
      if (this.listeners.has(event)) {
        const callbacks = this.listeners.get(event);
        const index = callbacks.indexOf(callback);
        if (index > -1) {
          callbacks.splice(index, 1);
        }
      }
    }

    /* ========================================
       Advanced Search Methods
       ======================================== */

    /**
     * Fuzzy search with scoring
     * @param {string} keyword - Search keyword
     * @returns {Promise<Array>} Scored and sorted results
     */
    async fuzzySearch(keyword) {
      if (!keyword || !keyword.trim()) {
        return this.getResults();
      }

      const searchTerm = keyword.toLowerCase().trim();
      const scored = this.filteredResults.map(simulation => {
        const score = this.calculateRelevanceScore(simulation, searchTerm);
        return { simulation, score };
      });

      // Filter out zero scores and sort by relevance
      const filtered = scored
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .map(item => item.simulation);

      return filtered;
    }

    /**
     * Get suggestions based on partial keyword
     * @param {string} partial - Partial keyword
     * @param {number} limit - Maximum suggestions
     * @returns {Array<string>} Suggestions
     */
    getSuggestions(partial, limit = 5) {
      if (!partial || partial.length < 2) {
        return [];
      }

      const searchTerm = partial.toLowerCase();
      const suggestions = new Set();

      this.allSimulations.forEach(sim => {
        // Check title
        if (sim.title.toLowerCase().includes(searchTerm)) {
          suggestions.add(sim.title);
        }

        // Check topics
        sim.topics.forEach(topic => {
          if (topic.toLowerCase().includes(searchTerm)) {
            suggestions.add(topic);
          }
        });

        // Check vocabulary terms
        if (sim.vocabulary) {
          sim.vocabulary.forEach(vocab => {
            if (vocab.term.toLowerCase().includes(searchTerm)) {
              suggestions.add(vocab.term);
            }
          });
        }
      });

      return Array.from(suggestions).slice(0, limit);
    }

    /* ========================================
       Filter Statistics
       ======================================== */

    /**
     * Get filter statistics
     * @returns {Object} Statistics object
     */
    getFilterStatistics() {
      const stats = {
        totalSimulations: this.allSimulations.length,
        filteredCount: this.filteredResults.length,
        filterBreakdown: {
          subjects: {},
          gradeLevels: {},
          difficulties: {},
          tags: {}
        }
      };

      // Count by categories for filtered results
      this.filteredResults.forEach(sim => {
        // Subject breakdown
        stats.filterBreakdown.subjects[sim.subject] = 
          (stats.filterBreakdown.subjects[sim.subject] || 0) + 1;

        // Grade level breakdown
        stats.filterBreakdown.gradeLevels[sim.gradeLevel] = 
          (stats.filterBreakdown.gradeLevels[sim.gradeLevel] || 0) + 1;

        // Difficulty breakdown
        stats.filterBreakdown.difficulties[sim.difficulty] = 
          (stats.filterBreakdown.difficulties[sim.difficulty] || 0) + 1;

        // Tags breakdown
        sim.tags.forEach(tag => {
          stats.filterBreakdown.tags[tag] = 
            (stats.filterBreakdown.tags[tag] || 0) + 1;
        });
      });

      return stats;
    }

    /* ========================================
       Private Methods
       ======================================== */

    /**
     * Apply all current filters
     * @returns {Promise<Array>} Filtered results
     */
    async applyFilters() {
      let results = [...this.allSimulations];

      // Apply subject filter
      if (this.currentFilters.subject) {
        results = results.filter(sim => sim.subject === this.currentFilters.subject);
      }

      // Apply grade level filter
      if (this.currentFilters.gradeLevel) {
        results = results.filter(sim => sim.gradeLevel === this.currentFilters.gradeLevel);
      }

      // Apply difficulty filter
      if (this.currentFilters.difficulty) {
        results = results.filter(sim => sim.difficulty === this.currentFilters.difficulty);
      }

      // Apply tags filter
      if (this.currentFilters.tags.length > 0) {
        results = results.filter(sim => 
          this.currentFilters.tags.some(tag => sim.tags.includes(tag))
        );
      }

      // Apply keyword filter
      if (this.currentFilters.keyword) {
        const keyword = this.currentFilters.keyword.toLowerCase();
        results = results.filter(sim => this.matchesKeyword(sim, keyword));
      }

      this.filteredResults = results;
      this.notifyListeners('filter', {
        results: this.filteredResults,
        filters: this.currentFilters,
        count: this.filteredResults.length
      });

      return this.filteredResults;
    }

    /**
     * Check if simulation matches keyword
     * @param {Object} simulation - Simulation object
     * @param {string} keyword - Search keyword
     * @returns {boolean} True if matches
     */
    matchesKeyword(simulation, keyword) {
      const searchFields = [
        simulation.title,
        simulation.description,
        ...simulation.topics,
        ...simulation.learningObjectives,
        simulation.instructions || ''
      ];

      // Add vocabulary terms if available
      if (simulation.vocabulary) {
        simulation.vocabulary.forEach(vocab => {
          searchFields.push(vocab.term, vocab.definition);
        });
      }

      return searchFields.some(field => 
        field.toLowerCase().includes(keyword)
      );
    }

    /**
     * Calculate relevance score for fuzzy search
     * @param {Object} simulation - Simulation object
     * @param {string} searchTerm - Search term
     * @returns {number} Relevance score
     */
    calculateRelevanceScore(simulation, searchTerm) {
      let score = 0;

      // Title match (highest weight)
      if (simulation.title.toLowerCase().includes(searchTerm)) {
        score += 10;
        if (simulation.title.toLowerCase().startsWith(searchTerm)) {
          score += 5; // Bonus for prefix match
        }
      }

      // Description match
      if (simulation.description.toLowerCase().includes(searchTerm)) {
        score += 5;
      }

      // Topics match
      simulation.topics.forEach(topic => {
        if (topic.toLowerCase().includes(searchTerm)) {
          score += 3;
        }
      });

      // Learning objectives match
      simulation.learningObjectives.forEach(objective => {
        if (objective.toLowerCase().includes(searchTerm)) {
          score += 2;
        }
      });

      // Vocabulary match
      if (simulation.vocabulary) {
        simulation.vocabulary.forEach(vocab => {
          if (vocab.term.toLowerCase().includes(searchTerm)) {
            score += 4;
          }
          if (vocab.definition.toLowerCase().includes(searchTerm)) {
            score += 1;
          }
        });
      }

      return score;
    }

    /**
     * Notify event listeners
     * @param {string} event - Event name
     * @param {*} data - Event data
     */
    notifyListeners(event, data) {
      if (this.listeners.has(event)) {
        this.listeners.get(event).forEach(callback => {
          try {
            callback(data);
          } catch (error) {
            console.error(`Error in ${event} listener:`, error);
          }
        });
      }
    }

    /* ========================================
       URL State Management
       ======================================== */

    /**
     * Serialize filters to URL parameters
     * @returns {URLSearchParams} URL parameters
     */
    toURLParams() {
      const params = new URLSearchParams();

      if (this.currentFilters.subject) {
        params.set('subject', this.currentFilters.subject);
      }
      if (this.currentFilters.gradeLevel) {
        params.set('grade', this.currentFilters.gradeLevel);
      }
      if (this.currentFilters.difficulty) {
        params.set('difficulty', this.currentFilters.difficulty);
      }
      if (this.currentFilters.tags.length > 0) {
        params.set('tags', this.currentFilters.tags.join(','));
      }
      if (this.currentFilters.keyword) {
        params.set('q', this.currentFilters.keyword);
      }

      return params;
    }

    /**
     * Load filters from URL parameters
     * @param {URLSearchParams|string} params - URL parameters
     * @returns {Promise<Array>} Filtered results
     */
    async fromURLParams(params) {
      if (typeof params === 'string') {
        params = new URLSearchParams(params);
      }

      const filters = {
        subject: params.get('subject'),
        gradeLevel: params.get('grade'),
        difficulty: params.get('difficulty'),
        tags: params.get('tags') ? params.get('tags').split(',') : [],
        keyword: params.get('q') || ''
      };

      return this.setFilters(filters);
    }
  }

  /* ========================================
     Export
     ======================================== */

  global.ContentFilter = ContentFilter;

  /* ========================================
     Development Helpers
     ======================================== */

  if (typeof window !== 'undefined' && window.console) {
    window.EduLabContentFilter = {
      createFilter: (dataManager) => new ContentFilter(dataManager),
      testFilters: async (filter) => {
        console.log('Testing content filter...');
        
        try {
          await filter.initialize();
          console.log('✅ Filter initialized');
          
          // Test subject filter
          const physicsResults = await filter.setSubjectFilter('physics');
          console.log(`✅ Physics filter: ${physicsResults.length} results`);
          
          // Test grade filter
          const gradeResults = await filter.setGradeLevelFilter('6-8');
          console.log(`✅ Grade 6-8 filter: ${gradeResults.length} results`);
          
          // Test search
          const searchResults = await filter.setKeywordFilter('lực');
          console.log(`✅ Keyword search: ${searchResults.length} results`);
          
          // Clear filters
          const allResults = await filter.clearFilters();
          console.log(`✅ Clear filters: ${allResults.length} results`);
          
          return true;
        } catch (error) {
          console.error('❌ Filter test failed:', error);
          return false;
        }
      }
    };
  }

})(typeof window !== 'undefined' ? window : global);
