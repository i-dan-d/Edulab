/* ========================================
   EduLab Completion Tracker
   Local storage-based progress tracking
   ======================================== */

(function(global) {
  'use strict';

  /* ========================================
     Completion Tracker Class
     ======================================== */

  class CompletionTracker {
    constructor() {
      this.storageKey = 'edulab_completion_data';
      this.maxStorageSize = 4 * 1024 * 1024; // 4MB limit for localStorage
      this.completionData = this.loadCompletionData();
      this.listeners = new Map();
    }

    /* ========================================
       Public Methods
       ======================================== */

    /**
     * Mark a simulation as completed
     * @param {string} simulationId - Simulation ID
     * @param {Object} metadata - Additional completion metadata
     * @returns {boolean} Success status
     */
    markCompleted(simulationId, metadata = {}) {
      try {
        const timestamp = Date.now();
        const completionEntry = {
          simulationId,
          completedAt: timestamp,
          completedDate: new Date(timestamp).toISOString(),
          sessionId: this.getSessionId(),
          ...metadata
        };

        this.completionData.completed[simulationId] = completionEntry;
        this.completionData.lastUpdated = timestamp;
        this.completionData.totalCompleted = Object.keys(this.completionData.completed).length;

        // Save to localStorage
        const success = this.saveCompletionData();
        
        if (success) {
          this.notifyListeners('completed', { simulationId, ...completionEntry });
          console.log(`Marked simulation ${simulationId} as completed`);
        }

        return success;

      } catch (error) {
        console.error('Failed to mark simulation as completed:', error);
        return false;
      }
    }

    /**
     * Mark a simulation as accessed/started
     * @param {string} simulationId - Simulation ID
     * @param {Object} metadata - Additional access metadata
     * @returns {boolean} Success status
     */
    markAccessed(simulationId, metadata = {}) {
      try {
        const timestamp = Date.now();
        const accessEntry = {
          simulationId,
          accessedAt: timestamp,
          accessedDate: new Date(timestamp).toISOString(),
          sessionId: this.getSessionId(),
          count: (this.completionData.accessed[simulationId]?.count || 0) + 1,
          ...metadata
        };

        this.completionData.accessed[simulationId] = accessEntry;
        this.completionData.lastUpdated = timestamp;

        // Save to localStorage
        const success = this.saveCompletionData();
        
        if (success) {
          this.notifyListeners('accessed', { simulationId, ...accessEntry });
        }

        return success;

      } catch (error) {
        console.error('Failed to mark simulation as accessed:', error);
        return false;
      }
    }

    /**
     * Check if a simulation is completed
     * @param {string} simulationId - Simulation ID
     * @returns {boolean} Completion status
     */
    isCompleted(simulationId) {
      return !!this.completionData.completed[simulationId];
    }

    /**
     * Check if a simulation has been accessed
     * @param {string} simulationId - Simulation ID
     * @returns {boolean} Access status
     */
    isAccessed(simulationId) {
      return !!this.completionData.accessed[simulationId];
    }

    /**
     * Get completion details for a simulation
     * @param {string} simulationId - Simulation ID
     * @returns {Object|null} Completion details
     */
    getCompletionDetails(simulationId) {
      return this.completionData.completed[simulationId] || null;
    }

    /**
     * Get access details for a simulation
     * @param {string} simulationId - Simulation ID
     * @returns {Object|null} Access details
     */
    getAccessDetails(simulationId) {
      return this.completionData.accessed[simulationId] || null;
    }

    /**
     * Get completion statistics
     * @returns {Object} Statistics object
     */
    getStatistics() {
      const completed = Object.keys(this.completionData.completed);
      const accessed = Object.keys(this.completionData.accessed);
      
      return {
        totalCompleted: completed.length,
        totalAccessed: accessed.length,
        completionRate: accessed.length > 0 ? (completed.length / accessed.length) * 100 : 0,
        lastActivity: this.completionData.lastUpdated,
        recentlyCompleted: this.getRecentlyCompleted(5),
        streakDays: this.calculateStreak(),
        storageUsed: this.getStorageUsage()
      };
    }

    /**
     * Get recently completed simulations
     * @param {number} limit - Number of results to return
     * @returns {Array} Recently completed simulations
     */
    getRecentlyCompleted(limit = 10) {
      const completed = Object.values(this.completionData.completed);
      return completed
        .sort((a, b) => b.completedAt - a.completedAt)
        .slice(0, limit);
    }

    /**
     * Clear completion status for a simulation
     * @param {string} simulationId - Simulation ID
     * @returns {boolean} Success status
     */
    clearCompletion(simulationId) {
      try {
        delete this.completionData.completed[simulationId];
        this.completionData.lastUpdated = Date.now();
        this.completionData.totalCompleted = Object.keys(this.completionData.completed).length;

        const success = this.saveCompletionData();
        
        if (success) {
          this.notifyListeners('cleared', { simulationId });
        }

        return success;

      } catch (error) {
        console.error('Failed to clear completion status:', error);
        return false;
      }
    }

    /**
     * Clear all completion data
     * @returns {boolean} Success status
     */
    clearAllData() {
      try {
        this.completionData = this.createEmptyData();
        const success = this.saveCompletionData();
        
        if (success) {
          this.notifyListeners('cleared_all', {});
        }

        return success;

      } catch (error) {
        console.error('Failed to clear all data:', error);
        return false;
      }
    }

    /**
     * Export completion data
     * @returns {string} JSON string of completion data
     */
    exportData() {
      return JSON.stringify(this.completionData, null, 2);
    }

    /**
     * Import completion data
     * @param {string} jsonData - JSON string of completion data
     * @returns {boolean} Success status
     */
    importData(jsonData) {
      try {
        const importedData = JSON.parse(jsonData);
        
        // Validate data structure
        if (!this.validateDataStructure(importedData)) {
          throw new Error('Invalid data structure');
        }

        this.completionData = importedData;
        const success = this.saveCompletionData();
        
        if (success) {
          this.notifyListeners('imported', { data: importedData });
        }

        return success;

      } catch (error) {
        console.error('Failed to import data:', error);
        return false;
      }
    }

    /**
     * Add event listener
     * @param {string} event - Event name
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
       Private Methods - Data Management
       ======================================== */

    /**
     * Load completion data from localStorage
     * @returns {Object} Completion data
     */
    loadCompletionData() {
      try {
        const stored = localStorage.getItem(this.storageKey);
        if (stored) {
          const data = JSON.parse(stored);
          
          // Validate and migrate data if needed
          if (this.validateDataStructure(data)) {
            return this.migrateDataIfNeeded(data);
          }
        }
      } catch (error) {
        console.warn('Failed to load completion data from localStorage:', error);
      }

      // Return empty data structure if loading fails
      return this.createEmptyData();
    }

    /**
     * Save completion data to localStorage
     * @returns {boolean} Success status
     */
    saveCompletionData() {
      try {
        const dataString = JSON.stringify(this.completionData);
        
        // Check storage size
        if (dataString.length > this.maxStorageSize) {
          this.cleanupOldData();
          return this.saveCompletionData(); // Retry after cleanup
        }

        localStorage.setItem(this.storageKey, dataString);
        return true;

      } catch (error) {
        if (error.name === 'QuotaExceededError') {
          console.warn('localStorage quota exceeded, attempting cleanup');
          this.cleanupOldData();
          return this.saveCompletionData(); // Retry after cleanup
        }
        
        console.error('Failed to save completion data:', error);
        return false;
      }
    }

    /**
     * Create empty data structure
     * @returns {Object} Empty completion data
     */
    createEmptyData() {
      return {
        version: '1.0.0',
        created: Date.now(),
        lastUpdated: Date.now(),
        sessionId: this.getSessionId(),
        totalCompleted: 0,
        completed: {},
        accessed: {}
      };
    }

    /**
     * Validate data structure
     * @param {Object} data - Data to validate
     * @returns {boolean} Valid status
     */
    validateDataStructure(data) {
      return data &&
             typeof data === 'object' &&
             typeof data.completed === 'object' &&
             typeof data.accessed === 'object' &&
             typeof data.lastUpdated === 'number';
    }

    /**
     * Migrate data structure if needed
     * @param {Object} data - Data to migrate
     * @returns {Object} Migrated data
     */
    migrateDataIfNeeded(data) {
      // Add version if missing
      if (!data.version) {
        data.version = '1.0.0';
      }

      // Add totalCompleted if missing
      if (typeof data.totalCompleted !== 'number') {
        data.totalCompleted = Object.keys(data.completed || {}).length;
      }

      // Add sessionId if missing
      if (!data.sessionId) {
        data.sessionId = this.getSessionId();
      }

      return data;
    }

    /**
     * Cleanup old data to free storage space
     */
    cleanupOldData() {
      const cutoffTime = Date.now() - (90 * 24 * 60 * 60 * 1000); // 90 days ago

      // Remove old access records
      Object.keys(this.completionData.accessed).forEach(id => {
        if (this.completionData.accessed[id].accessedAt < cutoffTime) {
          delete this.completionData.accessed[id];
        }
      });

      // Keep all completion records but remove old ones if necessary
      const completedEntries = Object.entries(this.completionData.completed);
      if (completedEntries.length > 1000) {
        // Keep only most recent 500 completions
        const sortedEntries = completedEntries
          .sort(([,a], [,b]) => b.completedAt - a.completedAt)
          .slice(0, 500);
        
        this.completionData.completed = Object.fromEntries(sortedEntries);
        this.completionData.totalCompleted = sortedEntries.length;
      }

      this.completionData.lastUpdated = Date.now();
    }

    /* ========================================
       Private Methods - Utilities
       ======================================== */

    /**
     * Get current session ID
     * @returns {string} Session ID
     */
    getSessionId() {
      if (!this.sessionId) {
        this.sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substring(2, 15);
      }
      return this.sessionId;
    }

    /**
     * Calculate completion streak (consecutive days with completions)
     * @returns {number} Streak in days
     */
    calculateStreak() {
      const completions = Object.values(this.completionData.completed);
      if (completions.length === 0) return 0;

      // Group completions by date
      const completionDates = {};
      completions.forEach(completion => {
        const date = new Date(completion.completedAt).toDateString();
        completionDates[date] = true;
      });

      const sortedDates = Object.keys(completionDates).sort((a, b) => new Date(b) - new Date(a));
      
      let streak = 0;
      let currentDate = new Date();
      
      for (const dateString of sortedDates) {
        const date = new Date(dateString);
        const daysDiff = Math.floor((currentDate - date) / (1000 * 60 * 60 * 24));
        
        if (daysDiff === streak) {
          streak++;
          currentDate = date;
        } else {
          break;
        }
      }

      return streak;
    }

    /**
     * Get storage usage information
     * @returns {Object} Storage usage details
     */
    getStorageUsage() {
      try {
        const dataString = JSON.stringify(this.completionData);
        const usedBytes = dataString.length;
        const usedKB = Math.round(usedBytes / 1024);
        const usedPercent = Math.round((usedBytes / this.maxStorageSize) * 100);

        return {
          usedBytes,
          usedKB,
          usedPercent,
          maxBytes: this.maxStorageSize,
          maxKB: Math.round(this.maxStorageSize / 1024)
        };

      } catch (error) {
        console.error('Failed to calculate storage usage:', error);
        return { usedBytes: 0, usedKB: 0, usedPercent: 0 };
      }
    }

    /**
     * Notify event listeners
     * @param {string} event - Event name
     * @param {Object} data - Event data
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
  }

  /* ========================================
     Export
     ======================================== */

  const completionTracker = new CompletionTracker();
  global.CompletionTracker = completionTracker;

  /* ========================================
     Development Helpers
     ======================================== */

  if (typeof window !== 'undefined' && window.console) {
    window.EduLabCompletion = {
      markCompleted: (id) => completionTracker.markCompleted(id),
      markAccessed: (id) => completionTracker.markAccessed(id),
      isCompleted: (id) => completionTracker.isCompleted(id),
      getStats: () => completionTracker.getStatistics(),
      clearAll: () => completionTracker.clearAllData(),
      export: () => completionTracker.exportData(),
      import: (data) => completionTracker.importData(data)
    };
  }

})(typeof window !== 'undefined' ? window : global);

