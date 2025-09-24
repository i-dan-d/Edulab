/* ========================================
   EduLab Data Manager
   JSON data loading and caching system
   ======================================== */

(function(global) {
  'use strict';

  /* ========================================
     Data Manager Class
     ======================================== */

  class DataManager {
    constructor() {
      this.cache = new Map();
      this.loadingPromises = new Map();
      this.baseUrl = '';
      this.retryAttempts = 3;
      this.retryDelay = 1000;
    }

    /* ========================================
       Public Methods
       ======================================== */

    /**
     * Load subjects data with caching
     * @returns {Promise<Object>} Subjects data
     */
    async loadSubjects() {
      return this.loadJSON('data/subjects.json', 'subjects');
    }

    /**
     * Load simulations data with caching
     * @returns {Promise<Object>} Simulations data
     */
    async loadSimulations() {
      return this.loadJSON('data/simulations.json', 'simulations');
    }

    /**
     * Get all data needed for the application
     * @returns {Promise<Object>} Combined data object
     */
    async loadAllData() {
      try {
        const [subjects, simulations] = await Promise.all([
          this.loadSubjects(),
          this.loadSimulations()
        ]);

        return {
          subjects: subjects.subjects,
          difficultyLevels: subjects.difficultyLevels,
          tags: subjects.tags,
          simulations: simulations.simulations,
          metadata: simulations.metadata
        };
      } catch (error) {
        console.error('Failed to load application data:', error);
        throw new Error('Không thể tải dữ liệu ứng dụng. Vui lòng kiểm tra kết nối mạng.');
      }
    }

    /**
     * Get simulations by subject
     * @param {string} subjectId - Subject identifier
     * @returns {Promise<Array>} Filtered simulations
     */
    async getSimulationsBySubject(subjectId) {
      const data = await this.loadSimulations();
      return data.simulations.filter(sim => sim.subject === subjectId);
    }

    /**
     * Get simulations by grade level
     * @param {string} gradeLevel - Grade level identifier
     * @returns {Promise<Array>} Filtered simulations
     */
    async getSimulationsByGrade(gradeLevel) {
      const data = await this.loadSimulations();
      return data.simulations.filter(sim => sim.gradeLevel === gradeLevel);
    }

    /**
     * Get simulation by ID
     * @param {string} simulationId - Simulation identifier
     * @returns {Promise<Object|null>} Simulation object or null
     */
    async getSimulationById(simulationId) {
      const data = await this.loadSimulations();
      return data.simulations.find(sim => sim.id === simulationId) || null;
    }

    /**
     * Search simulations by keyword
     * @param {string} keyword - Search keyword
     * @param {Object} filters - Additional filters
     * @returns {Promise<Array>} Matching simulations
     */
    async searchSimulations(keyword, filters = {}) {
      const data = await this.loadSimulations();
      let results = data.simulations;

      // Keyword search
      if (keyword && keyword.trim()) {
        const searchTerm = keyword.toLowerCase().trim();
        results = results.filter(sim => 
          sim.title.toLowerCase().includes(searchTerm) ||
          sim.description.toLowerCase().includes(searchTerm) ||
          sim.topics.some(topic => topic.toLowerCase().includes(searchTerm)) ||
          sim.learningObjectives.some(obj => obj.toLowerCase().includes(searchTerm))
        );
      }

      // Apply filters
      if (filters.subject) {
        results = results.filter(sim => sim.subject === filters.subject);
      }

      if (filters.gradeLevel) {
        results = results.filter(sim => sim.gradeLevel === filters.gradeLevel);
      }

      if (filters.difficulty) {
        results = results.filter(sim => sim.difficulty === filters.difficulty);
      }

      if (filters.tags && filters.tags.length > 0) {
        results = results.filter(sim => 
          filters.tags.some(tag => sim.tags.includes(tag))
        );
      }

      return results;
    }

    /**
     * Get all simulations including custom ones
     * @returns {Promise<Array>} All simulations
     */
    async getAllSimulations() {
      const data = await this.loadSimulations();
      let allSimulations = [...data.simulations];
      
      // Add custom simulations if available
      if (typeof window !== 'undefined' && window.SimulationManager && window.SimulationManager.isReady()) {
        const customSimulations = window.SimulationManager.getCustomSimulations();
        allSimulations = [...allSimulations, ...customSimulations];
      }
      
      return allSimulations;
    }

    /**
     * Get simulation by ID (including custom simulations)
     * @param {string} simulationId - Simulation ID
     * @returns {Promise<Object|null>} Simulation or null
     */
    async getSimulationByIdIncludingCustom(simulationId) {
      // First try standard simulations
      const standardSim = await this.getSimulationById(simulationId);
      if (standardSim) {
        return standardSim;
      }
      
      // Then try custom simulations
      if (typeof window !== 'undefined' && window.SimulationManager && window.SimulationManager.isReady()) {
        return window.SimulationManager.getSimulationById(simulationId);
      }
      
      return null;
    }

    /**
     * Get simulations by subject including custom ones
     * @param {string} subject - Subject name
     * @returns {Promise<Array>} Simulations for the subject
     */
    async getSimulationsBySubjectIncludingCustom(subject) {
      const standardSims = await this.getSimulationsBySubject(subject);
      let allSims = [...standardSims];
      
      // Add custom simulations for this subject
      if (typeof window !== 'undefined' && window.SimulationManager && window.SimulationManager.isReady()) {
        const customSims = window.SimulationManager.getSimulationsBySubject(subject);
        allSims = [...allSims, ...customSims];
      }
      
      return allSims;
    }

    /**
     * Search all simulations including custom ones
     * @param {string} keyword - Search keyword
     * @param {Object} filters - Additional filters
     * @returns {Promise<Array>} Matching simulations
     */
    async searchAllSimulations(keyword, filters = {}) {
      // Search standard simulations
      const standardResults = await this.searchSimulations(keyword, filters);
      let allResults = [...standardResults];
      
      // Search custom simulations
      if (typeof window !== 'undefined' && window.SimulationManager && window.SimulationManager.isReady()) {
        const customSims = window.SimulationManager.searchSimulations(keyword);
        
        // Apply filters to custom simulations
        let filteredCustomSims = customSims;
        
        if (filters.subject) {
          filteredCustomSims = filteredCustomSims.filter(sim => sim.subject === filters.subject);
        }
        
        if (filters.gradeLevel) {
          filteredCustomSims = filteredCustomSims.filter(sim => 
            sim.gradeLevel.includes(parseInt(filters.gradeLevel))
          );
        }
        
        if (filters.difficulty) {
          filteredCustomSims = filteredCustomSims.filter(sim => sim.difficulty === filters.difficulty);
        }
        
        allResults = [...allResults, ...filteredCustomSims];
      }
      
      return allResults;
    }

    /**
     * Get statistics including custom simulations
     * @returns {Promise<Object>} Combined statistics
     */
    async getCombinedStatistics() {
      const standardStats = await this.getStatistics();
      
      if (typeof window !== 'undefined' && window.SimulationManager && window.SimulationManager.isReady()) {
        const customStats = window.SimulationManager.getStatistics();
        
        return {
          standard: standardStats,
          custom: customStats,
          total: {
            simulations: standardStats.totalSimulations + customStats.total,
            subjects: Object.keys(standardStats.bySubject).length,
            totalBySubject: {
              ...standardStats.bySubject,
              // Merge custom simulation counts
              ...Object.keys(customStats.bySubject).reduce((acc, subject) => {
                acc[subject] = (standardStats.bySubject[subject] || 0) + customStats.bySubject[subject];
                return acc;
              }, {})
            }
          }
        };
      }
      
      return {
        standard: standardStats,
        custom: { total: 0, bySubject: {}, recentlyAdded: 0, totalAccess: 0 },
        total: {
          simulations: standardStats.totalSimulations,
          subjects: Object.keys(standardStats.bySubject).length,
          totalBySubject: standardStats.bySubject
        }
      };
    }

    /**
     * Clear cache
     */
    clearCache() {
      this.cache.clear();
      this.loadingPromises.clear();
    }

    /**
     * Check if data is cached
     * @param {string} key - Cache key
     * @returns {boolean} True if cached
     */
    isCached(key) {
      return this.cache.has(key);
    }

    /* ========================================
       Private Methods
       ======================================== */

    /**
     * Load JSON data with caching and retry logic
     * @param {string} url - JSON file URL
     * @param {string} cacheKey - Cache key
     * @returns {Promise<Object>} Parsed JSON data
     */
    async loadJSON(url, cacheKey) {
      // Check cache first
      if (this.cache.has(cacheKey)) {
        return this.cache.get(cacheKey);
      }

      // Check if already loading
      if (this.loadingPromises.has(cacheKey)) {
        return this.loadingPromises.get(cacheKey);
      }

      // Create loading promise
      const loadingPromise = this.fetchWithRetry(url, cacheKey);
      this.loadingPromises.set(cacheKey, loadingPromise);

      try {
        const data = await loadingPromise;
        this.cache.set(cacheKey, data);
        this.loadingPromises.delete(cacheKey);
        return data;
      } catch (error) {
        this.loadingPromises.delete(cacheKey);
        throw error;
      }
    }

    /**
     * Fetch with retry logic
     * @param {string} url - URL to fetch
     * @param {string} cacheKey - Cache key for error context
     * @returns {Promise<Object>} Parsed response
     */
    async fetchWithRetry(url, cacheKey) {
      let lastError;

      for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
        try {
          // Use optimized fetch if available
          const fetchFunction = (window.PerformanceOptimizer && window.PerformanceOptimizer.optimizedFetch) 
            ? window.PerformanceOptimizer.optimizedFetch.bind(window.PerformanceOptimizer)
            : fetch;
          
          const response = await fetchFunction(this.baseUrl + url, {
            timeout: 10000, // 10 second timeout
            skipCache: attempt > 1 // Skip cache on retries
          });
          
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          const data = await response.json();
          this.validateData(data, cacheKey);
          return data;

        } catch (error) {
          lastError = error;
          console.warn(`Attempt ${attempt} failed for ${url}:`, error.message);

          if (attempt < this.retryAttempts) {
            await this.delay(this.retryDelay * attempt);
          }
        }
      }

      // Handle error with error handler if available
      if (window.ErrorHandler) {
        window.ErrorHandler.handleNetworkError(lastError, this.baseUrl + url, {
          enableRetry: true,
          retryCallback: () => this.fetchWithRetry(url, cacheKey)
        });
      }
      
      throw new Error(`Failed to load ${url} after ${this.retryAttempts} attempts: ${lastError.message}`);
    }

    /**
     * Validate loaded data structure
     * @param {Object} data - Data to validate
     * @param {string} type - Data type for validation
     */
    validateData(data, type) {
      if (!data || typeof data !== 'object') {
        throw new Error(`Invalid data format for ${type}`);
      }

      switch (type) {
        case 'subjects':
          if (!data.subjects || typeof data.subjects !== 'object') {
            throw new Error('Subjects data missing or invalid');
          }
          break;

        case 'simulations':
          if (!Array.isArray(data.simulations)) {
            throw new Error('Simulations data must be an array');
          }
          
          // Validate required fields for each simulation
          data.simulations.forEach((sim, index) => {
            const requiredFields = ['id', 'title', 'subject', 'gradeLevel', 'phetUrl'];
            requiredFields.forEach(field => {
              if (!sim[field]) {
                throw new Error(`Simulation ${index}: Missing required field '${field}'`);
              }
            });
          });
          break;
      }
    }

    /**
     * Delay utility for retry logic
     * @param {number} ms - Milliseconds to delay
     * @returns {Promise} Delay promise
     */
    delay(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    }

    /* ========================================
       Statistics and Analytics
       ======================================== */

    /**
     * Get statistics about the data
     * @returns {Promise<Object>} Statistics object
     */
    async getStatistics() {
      try {
        const [subjects, simulations] = await Promise.all([
          this.loadSubjects(),
          this.loadSimulations()
        ]);

        const stats = {
          totalSubjects: Object.keys(subjects.subjects).length,
          totalSimulations: simulations.simulations.length,
          simulationsBySubject: {},
          simulationsByGrade: {},
          simulationsByDifficulty: {}
        };

        // Count simulations by subject
        simulations.simulations.forEach(sim => {
          stats.simulationsBySubject[sim.subject] = 
            (stats.simulationsBySubject[sim.subject] || 0) + 1;
          
          stats.simulationsByGrade[sim.gradeLevel] = 
            (stats.simulationsByGrade[sim.gradeLevel] || 0) + 1;
            
          stats.simulationsByDifficulty[sim.difficulty] = 
            (stats.simulationsByDifficulty[sim.difficulty] || 0) + 1;
        });

        return stats;
      } catch (error) {
        console.error('Failed to generate statistics:', error);
        return null;
      }
    }
  }

  /* ========================================
     Error Classes
     ======================================== */

  class DataLoadError extends Error {
    constructor(message, url, originalError) {
      super(message);
      this.name = 'DataLoadError';
      this.url = url;
      this.originalError = originalError;
    }
  }

  class DataValidationError extends Error {
    constructor(message, dataType) {
      super(message);
      this.name = 'DataValidationError';
      this.dataType = dataType;
    }
  }

  /* ========================================
     Singleton Instance
     ======================================== */

  const dataManager = new DataManager();

  /* ========================================
     Public API
     ======================================== */

  // Export for global use
  global.DataManager = dataManager;

  // Export classes for error handling
  global.DataLoadError = DataLoadError;
  global.DataValidationError = DataValidationError;

  /* ========================================
     Development Helpers
     ======================================== */

  if (typeof window !== 'undefined' && window.console) {
    // Expose development methods
    window.EduLabDataManager = {
      clearCache: () => dataManager.clearCache(),
      getCache: () => dataManager.cache,
      getStatistics: () => dataManager.getStatistics(),
      validateConnection: async () => {
        try {
          await dataManager.loadSubjects();
          console.log('✅ Data connection validated');
          return true;
        } catch (error) {
          console.error('❌ Data connection failed:', error.message);
          return false;
        }
      }
    };
  }

})(typeof window !== 'undefined' ? window : global);
