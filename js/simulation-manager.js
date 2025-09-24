/* ========================================
   EduLab Simulation Manager
   Manages custom PhET simulations
   ======================================== */

(function(global) {
  'use strict';

  /* ========================================
     Simulation Manager Class
     ======================================== */

  class SimulationManager {
    constructor() {
      this.storageKey = 'edulab_custom_simulations';
      this.customSimulations = [];
      this.nextId = 1;
      this.initialized = false;
      
      // Auto-initialize
      this.init().catch(error => {
        console.error('SimulationManager auto-initialization failed:', error);
      });
    }

    /**
     * Initialize the manager
     * @returns {Promise<void>}
     */
    async init() {
      try {
        await this.loadFromStorage();
        this.initialized = true;
        console.log('✅ SimulationManager initialized successfully');
      } catch (error) {
        console.error('❌ SimulationManager initialization failed:', error);
        this.initialized = false;
        throw error;
      }
    }

    /**
     * Check if manager is ready
     * @returns {boolean}
     */
    isReady() {
      return this.initialized;
    }

    /* ========================================
       Public Methods - Initialization
       ======================================== */

    /* ========================================
       Public Methods - Simulation Management
       ======================================== */

    /**
     * Add new custom simulation
     * @param {Object} simulationData - Simulation data
     * @returns {Promise<Object>} Added simulation with ID
     */
    async addSimulation(simulationData) {
      try {
        // Validate required fields
        const validation = this.validateSimulationData(simulationData);
        if (!validation.isValid) {
          throw new Error(validation.message);
        }

        // Create simulation object
        const simulation = {
          id: `custom-${this.nextId++}`,
          ...simulationData,
          isCustom: true,
          addedDate: new Date().toISOString(),
          lastModified: new Date().toISOString(),
          accessCount: 0
        };

        // Add to collection
        this.customSimulations.push(simulation);

        // Save to storage
        await this.saveToStorage();

        console.log('✅ Custom simulation added:', simulation.id);
        
        // Dispatch event
        this.dispatchSimulationEvent('simulationAdded', simulation);

        return simulation;

      } catch (error) {
        console.error('❌ Failed to add simulation:', error);
        throw error;
      }
    }

    /**
     * Update existing simulation
     * @param {string} simulationId - Simulation ID
     * @param {Object} updateData - Data to update
     * @returns {Promise<Object>} Updated simulation
     */
    async updateSimulation(simulationId, updateData) {
      try {
        const index = this.customSimulations.findIndex(sim => sim.id === simulationId);
        
        if (index === -1) {
          throw new Error('Simulation not found');
        }

        // Validate update data
        const validation = this.validateSimulationData({
          ...this.customSimulations[index],
          ...updateData
        });
        
        if (!validation.isValid) {
          throw new Error(validation.message);
        }

        // Update simulation
        this.customSimulations[index] = {
          ...this.customSimulations[index],
          ...updateData,
          lastModified: new Date().toISOString()
        };

        // Save to storage
        await this.saveToStorage();

        console.log('✅ Simulation updated:', simulationId);
        
        // Dispatch event
        this.dispatchSimulationEvent('simulationUpdated', this.customSimulations[index]);

        return this.customSimulations[index];

      } catch (error) {
        console.error('❌ Failed to update simulation:', error);
        throw error;
      }
    }

    /**
     * Delete simulation
     * @param {string} simulationId - Simulation ID
     * @returns {Promise<boolean>} Success status
     */
    async deleteSimulation(simulationId) {
      try {
        const index = this.customSimulations.findIndex(sim => sim.id === simulationId);
        
        if (index === -1) {
          throw new Error('Simulation not found');
        }

        const deletedSimulation = this.customSimulations[index];
        this.customSimulations.splice(index, 1);

        // Save to storage
        await this.saveToStorage();

        console.log('✅ Simulation deleted:', simulationId);
        
        // Dispatch event
        this.dispatchSimulationEvent('simulationDeleted', deletedSimulation);

        return true;

      } catch (error) {
        console.error('❌ Failed to delete simulation:', error);
        throw error;
      }
    }

    /**
     * Get all custom simulations
     * @returns {Array} Custom simulations
     */
    getCustomSimulations() {
      return [...this.customSimulations];
    }

    /**
     * Get simulation by ID
     * @param {string} simulationId - Simulation ID
     * @returns {Object|null} Simulation or null
     */
    getSimulationById(simulationId) {
      return this.customSimulations.find(sim => sim.id === simulationId) || null;
    }

    /**
     * Search custom simulations
     * @param {string} query - Search query
     * @returns {Array} Matching simulations
     */
    searchSimulations(query) {
      if (!query || query.trim() === '') {
        return this.getCustomSimulations();
      }

      const searchTerm = query.toLowerCase().trim();
      
      return this.customSimulations.filter(simulation => {
        return (
          simulation.title.toLowerCase().includes(searchTerm) ||
          simulation.description.toLowerCase().includes(searchTerm) ||
          simulation.subject.toLowerCase().includes(searchTerm) ||
          (simulation.topics && simulation.topics.some(topic => 
            topic.toLowerCase().includes(searchTerm)
          )) ||
          (simulation.tags && simulation.tags.some(tag => 
            tag.toLowerCase().includes(searchTerm)
          ))
        );
      });
    }

    /**
     * Get simulations by subject
     * @param {string} subject - Subject to filter by
     * @returns {Array} Filtered simulations
     */
    getSimulationsBySubject(subject) {
      return this.customSimulations.filter(sim => sim.subject === subject);
    }

    /**
     * Get simulations by grade level
     * @param {Array} gradeLevels - Grade levels to filter by
     * @returns {Array} Filtered simulations
     */
    getSimulationsByGrade(gradeLevels) {
      if (!Array.isArray(gradeLevels)) {
        gradeLevels = [gradeLevels];
      }

      return this.customSimulations.filter(sim => {
        return sim.gradeLevel.some(grade => gradeLevels.includes(grade));
      });
    }

    /**
     * Get simulations by collection
     * @param {string} collectionId - Collection ID
     * @returns {Array} Simulations in collection
     */
    getSimulationsByCollection(collectionId) {
      return this.customSimulations.filter(sim => 
        sim.collections && sim.collections.includes(collectionId)
      );
    }

    /* ========================================
       Public Methods - Statistics
       ======================================== */

    /**
     * Get simulation statistics
     * @returns {Object} Statistics
     */
    getStatistics() {
      const stats = {
        total: this.customSimulations.length,
        bySubject: {},
        byGrade: {},
        recentlyAdded: 0,
        totalAccess: 0
      };

      // Calculate stats
      this.customSimulations.forEach(sim => {
        // By subject
        stats.bySubject[sim.subject] = (stats.bySubject[sim.subject] || 0) + 1;

        // By grade
        sim.gradeLevel.forEach(grade => {
          stats.byGrade[grade] = (stats.byGrade[grade] || 0) + 1;
        });

        // Recently added (last 7 days)
        const addedDate = new Date(sim.addedDate);
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        if (addedDate > weekAgo) {
          stats.recentlyAdded++;
        }

        // Total access
        stats.totalAccess += sim.accessCount || 0;
      });

      return stats;
    }

    /**
     * Record simulation access
     * @param {string} simulationId - Simulation ID
     */
    recordAccess(simulationId) {
      const simulation = this.getSimulationById(simulationId);
      if (simulation) {
        simulation.accessCount = (simulation.accessCount || 0) + 1;
        simulation.lastAccessed = new Date().toISOString();
        this.saveCustomSimulations();
      }
    }

    /* ========================================
       Public Methods - Import/Export
       ======================================== */

    /**
     * Export custom simulations
     * @returns {Object} Export data
     */
    exportSimulations() {
      return {
        version: '1.0',
        exportDate: new Date().toISOString(),
        simulations: this.customSimulations,
        statistics: this.getStatistics()
      };
    }

    /**
     * Import simulations from data
     * @param {Object} importData - Import data
     * @param {boolean} merge - Whether to merge or replace
     * @returns {Promise<Object>} Import result
     */
    async importSimulations(importData, merge = true) {
      try {
        if (!importData || !importData.simulations || !Array.isArray(importData.simulations)) {
          throw new Error('Invalid import data format');
        }

        let imported = 0;
        let skipped = 0;
        let errors = [];

        for (const simData of importData.simulations) {
          try {
            // Check if simulation already exists (by URL)
            const exists = this.customSimulations.some(sim => sim.phetUrl === simData.phetUrl);
            
            if (exists && merge) {
              skipped++;
              continue;
            }

            // Validate simulation data
            const validation = this.validateSimulationData(simData);
            if (!validation.isValid) {
              errors.push(`Invalid simulation data: ${validation.message}`);
              continue;
            }

            // Add simulation
            await this.addSimulation({
              ...simData,
              id: undefined // Let system assign new ID
            });
            
            imported++;

          } catch (error) {
            errors.push(`Failed to import simulation: ${error.message}`);
          }
        }

        const result = {
          success: true,
          imported,
          skipped,
          errors,
          total: importData.simulations.length
        };

        console.log('✅ Import completed:', result);
        return result;

      } catch (error) {
        console.error('❌ Import failed:', error);
        throw error;
      }
    }

    /**
     * Reset all custom simulations
     * @returns {Promise<boolean>} Success status
     */
    async resetAllSimulations() {
      try {
        this.customSimulations = [];
        this.nextId = 1;
        await this.saveToStorage();
        
        console.log('✅ All custom simulations reset');
        
        // Dispatch event
        this.dispatchSimulationEvent('allSimulationsReset', {});
        
        return true;

      } catch (error) {
        console.error('❌ Failed to reset simulations:', error);
        throw error;
      }
    }

    /* ========================================
       Private Methods - Data Management
       ======================================== */

    /**
     * Load data from storage
     * @returns {Promise<void>}
     */
    async loadFromStorage() {
      try {
        const stored = localStorage.getItem(this.storageKey);
        
        if (stored) {
          const data = JSON.parse(stored);
          this.customSimulations = data.simulations || [];
          this.nextId = data.nextId || 1;
        } else {
          this.customSimulations = [];
          this.nextId = 1;
        }

        console.log(`📚 Loaded ${this.customSimulations.length} custom simulations`);

      } catch (error) {
        console.error('❌ Failed to load from storage:', error);
        this.customSimulations = [];
        this.nextId = 1;
        throw error;
      }
    }

    /**
     * Save data to storage
     * @returns {Promise<void>}
     */
    async saveToStorage() {
      try {
        const data = {
          simulations: this.customSimulations,
          nextId: this.nextId,
          lastSaved: new Date().toISOString()
        };

        localStorage.setItem(this.storageKey, JSON.stringify(data));
        console.log('💾 Custom simulations saved');

      } catch (error) {
        console.error('❌ Failed to save to storage:', error);
        throw error;
      }
    }

    /**
     * Load custom simulations from storage (legacy method)
     * @returns {Promise<void>}
     */
    async loadCustomSimulations() {
      return this.loadFromStorage();
    }

    /**
     * Save custom simulations to storage (legacy method)
     * @returns {Promise<void>}
     */
    async saveCustomSimulations() {
      return this.saveToStorage();
    }

    /**
     * Validate simulation data
     * @param {Object} data - Simulation data
     * @returns {Object} Validation result
     */
    validateSimulationData(data) {
      const required = ['title', 'description', 'subject', 'gradeLevel', 'phetUrl'];
      const missing = required.filter(field => !data[field]);

      if (missing.length > 0) {
        return {
          isValid: false,
          message: `Missing required fields: ${missing.join(', ')}`
        };
      }

      // Validate URL format
      try {
        new URL(data.phetUrl);
      } catch {
        return {
          isValid: false,
          message: 'Invalid PhET URL format'
        };
      }

      // Validate subject
      const validSubjects = ['physics', 'chemistry', 'biology', 'mathematics'];
      if (!validSubjects.includes(data.subject)) {
        return {
          isValid: false,
          message: 'Invalid subject. Must be one of: ' + validSubjects.join(', ')
        };
      }

      // Validate grade levels
      if (!Array.isArray(data.gradeLevel) || data.gradeLevel.length === 0) {
        return {
          isValid: false,
          message: 'Grade level must be a non-empty array'
        };
      }

      return {
        isValid: true,
        message: 'Validation passed'
      };
    }

    /**
     * Dispatch simulation event
     * @param {string} eventType - Event type
     * @param {Object} simulationData - Simulation data
     */
    dispatchSimulationEvent(eventType, simulationData) {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(eventType, {
          detail: {
            simulation: simulationData,
            timestamp: new Date().toISOString()
          }
        }));
      }
    }

    /* ========================================
       Development Methods
       ======================================== */

    /**
     * Get debug information
     * @returns {Object} Debug info
     */
    getDebugInfo() {
      return {
        initialized: this.initialized,
        customSimulations: this.customSimulations.length,
        nextId: this.nextId,
        storageKey: this.storageKey,
        statistics: this.getStatistics()
      };
    }
  }

  /* ========================================
     Auto-initialization
     ======================================== */

  // Auto-initialize when dependencies are ready
  function initializeSimulationManager() {
    if (typeof window !== 'undefined' && !window.SimulationManager) {
      console.log('🚀 Creating SimulationManager instance...');
      const manager = new SimulationManager();
      window.SimulationManager = manager;
      console.log('✅ SimulationManager instance created and auto-initializing...');
    }
  }

  // Initialize immediately if in browser
  if (typeof window !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initializeSimulationManager);
    } else {
      initializeSimulationManager();
    }
  }

  /* ========================================
     Export
     ======================================== */

  global.SimulationManager = SimulationManager;

  /* ========================================
     Development Helpers
     ======================================== */

  if (typeof window !== 'undefined' && window.console) {
    window.EduLabSimManager = {
      add: (data) => window.SimulationManager?.addSimulation(data),
      list: () => window.SimulationManager?.getCustomSimulations(),
      stats: () => window.SimulationManager?.getStatistics(),
      export: () => window.SimulationManager?.exportSimulations(),
      reset: () => window.SimulationManager?.resetAllSimulations()
    };
  }

})(typeof window !== 'undefined' ? window : global);
