/* ========================================
   EduLab Collection Manager
   Manages custom simulation collections
   ======================================== */

(function(global) {
  'use strict';

  /* ========================================
     Collection Manager Class
     ======================================== */

  class CollectionManager {
    constructor() {
      this.storageKey = 'edulab_collections';
      this.collections = [];
      this.nextId = 1;
      this.initialized = false;
      
      // Auto-initialize
      this.init().catch(error => {
        console.error('CollectionManager auto-initialization failed:', error);
      });
    }

    /**
     * Initialize the manager
     * @returns {Promise<void>}
     */
    async init() {
      try {
        await this.loadFromStorage();
        this.createDefaultCollections();
        this.initialized = true;
        console.log('✅ CollectionManager initialized successfully');
      } catch (error) {
        console.error('❌ CollectionManager initialization failed:', error);
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
       Public Methods - Collection Management
       ======================================== */

    /**
     * Create new collection
     * @param {Object} collectionData - Collection data
     * @returns {Promise<Object>} Created collection
     */
    async createCollection(collectionData) {
      try {
        // Validate required fields
        const validation = this.validateCollectionData(collectionData);
        if (!validation.isValid) {
          throw new Error(validation.message);
        }

        // Check for duplicate names
        if (this.collections.some(col => col.name === collectionData.name)) {
          throw new Error('Collection name already exists');
        }

        // Create collection object
        const collection = {
          id: `collection-${this.nextId++}`,
          ...collectionData,
          simulationIds: collectionData.simulationIds || [],
          createdDate: new Date().toISOString(),
          lastModified: new Date().toISOString(),
          isDefault: false
        };

        // Add to collections
        this.collections.push(collection);

        // Save to storage
        await this.saveToStorage();

        console.log('✅ Collection created:', collection.id);
        
        // Dispatch event
        this.dispatchCollectionEvent('collectionCreated', collection);

        return collection;

      } catch (error) {
        console.error('❌ Failed to create collection:', error);
        throw error;
      }
    }

    /**
     * Update existing collection
     * @param {string} collectionId - Collection ID
     * @param {Object} updateData - Data to update
     * @returns {Promise<Object>} Updated collection
     */
    async updateCollection(collectionId, updateData) {
      try {
        const index = this.collections.findIndex(col => col.id === collectionId);
        
        if (index === -1) {
          throw new Error('Collection not found');
        }

        // Don't allow updating default collections' core properties
        if (this.collections[index].isDefault && 
            (updateData.name || updateData.subject || updateData.isDefault !== undefined)) {
          throw new Error('Cannot modify default collection properties');
        }

        // Validate update data
        const validation = this.validateCollectionData({
          ...this.collections[index],
          ...updateData
        });
        
        if (!validation.isValid) {
          throw new Error(validation.message);
        }

        // Check for duplicate names (excluding current collection)
        if (updateData.name && 
            this.collections.some((col, i) => i !== index && col.name === updateData.name)) {
          throw new Error('Collection name already exists');
        }

        // Update collection
        this.collections[index] = {
          ...this.collections[index],
          ...updateData,
          lastModified: new Date().toISOString()
        };

        // Save to storage
        await this.saveToStorage();

        console.log('✅ Collection updated:', collectionId);
        
        // Dispatch event
        this.dispatchCollectionEvent('collectionUpdated', this.collections[index]);

        return this.collections[index];

      } catch (error) {
        console.error('❌ Failed to update collection:', error);
        throw error;
      }
    }

    /**
     * Delete collection
     * @param {string} collectionId - Collection ID
     * @returns {Promise<boolean>} Success status
     */
    async deleteCollection(collectionId) {
      try {
        const index = this.collections.findIndex(col => col.id === collectionId);
        
        if (index === -1) {
          throw new Error('Collection not found');
        }

        // Don't allow deleting default collections
        if (this.collections[index].isDefault) {
          throw new Error('Cannot delete default collections');
        }

        const deletedCollection = this.collections[index];
        this.collections.splice(index, 1);

        // Remove collection from all simulations
        if (typeof window !== 'undefined' && window.SimulationManager) {
          await this.removeCollectionFromSimulations(collectionId);
        }

        // Save to storage
        await this.saveToStorage();

        console.log('✅ Collection deleted:', collectionId);
        
        // Dispatch event
        this.dispatchCollectionEvent('collectionDeleted', deletedCollection);

        return true;

      } catch (error) {
        console.error('❌ Failed to delete collection:', error);
        throw error;
      }
    }

    /**
     * Get all collections
     * @returns {Array} Collections
     */
    getCollections() {
      return [...this.collections];
    }

    /**
     * Get collection by ID
     * @param {string} collectionId - Collection ID
     * @returns {Object|null} Collection or null
     */
    getCollectionById(collectionId) {
      return this.collections.find(col => col.id === collectionId) || null;
    }

    /**
     * Get collections by subject
     * @param {string} subject - Subject to filter by
     * @returns {Array} Filtered collections
     */
    getCollectionsBySubject(subject) {
      return this.collections.filter(col => col.subject === subject);
    }

    /**
     * Get custom collections (non-default)
     * @returns {Array} Custom collections
     */
    getCustomCollections() {
      return this.collections.filter(col => !col.isDefault);
    }

    /**
     * Search collections
     * @param {string} query - Search query
     * @returns {Array} Matching collections
     */
    searchCollections(query) {
      if (!query || query.trim() === '') {
        return this.getCollections();
      }

      const searchTerm = query.toLowerCase().trim();
      
      return this.collections.filter(collection => {
        return (
          collection.name.toLowerCase().includes(searchTerm) ||
          collection.description.toLowerCase().includes(searchTerm) ||
          collection.subject.toLowerCase().includes(searchTerm) ||
          (collection.tags && collection.tags.some(tag => 
            tag.toLowerCase().includes(searchTerm)
          ))
        );
      });
    }

    /* ========================================
       Public Methods - Simulation Management
       ======================================== */

    /**
     * Add simulation to collection
     * @param {string} collectionId - Collection ID
     * @param {string} simulationId - Simulation ID
     * @returns {Promise<boolean>} Success status
     */
    async addSimulationToCollection(collectionId, simulationId) {
      try {
        const collection = this.getCollectionById(collectionId);
        
        if (!collection) {
          throw new Error('Collection not found');
        }

        // Check if simulation already in collection
        if (collection.simulationIds.includes(simulationId)) {
          return true; // Already in collection
        }

        // Add simulation ID
        collection.simulationIds.push(simulationId);
        collection.lastModified = new Date().toISOString();

        // Save to storage
        await this.saveToStorage();

        console.log('✅ Simulation added to collection:', simulationId, '→', collectionId);
        
        // Dispatch event
        this.dispatchCollectionEvent('simulationAddedToCollection', {
          collection,
          simulationId
        });

        return true;

      } catch (error) {
        console.error('❌ Failed to add simulation to collection:', error);
        throw error;
      }
    }

    /**
     * Remove simulation from collection
     * @param {string} collectionId - Collection ID
     * @param {string} simulationId - Simulation ID
     * @returns {Promise<boolean>} Success status
     */
    async removeSimulationFromCollection(collectionId, simulationId) {
      try {
        const collection = this.getCollectionById(collectionId);
        
        if (!collection) {
          throw new Error('Collection not found');
        }

        // Remove simulation ID
        const index = collection.simulationIds.indexOf(simulationId);
        if (index > -1) {
          collection.simulationIds.splice(index, 1);
          collection.lastModified = new Date().toISOString();

          // Save to storage
          await this.saveToStorage();

          console.log('✅ Simulation removed from collection:', simulationId, '←', collectionId);
          
          // Dispatch event
          this.dispatchCollectionEvent('simulationRemovedFromCollection', {
            collection,
            simulationId
          });
        }

        return true;

      } catch (error) {
        console.error('❌ Failed to remove simulation from collection:', error);
        throw error;
      }
    }

    /**
     * Get simulations in collection
     * @param {string} collectionId - Collection ID
     * @returns {Array} Simulation IDs
     */
    getSimulationsInCollection(collectionId) {
      const collection = this.getCollectionById(collectionId);
      return collection ? [...collection.simulationIds] : [];
    }

    /**
     * Get collections containing simulation
     * @param {string} simulationId - Simulation ID
     * @returns {Array} Collections containing the simulation
     */
    getCollectionsContainingSimulation(simulationId) {
      return this.collections.filter(col => 
        col.simulationIds.includes(simulationId)
      );
    }

    /* ========================================
       Public Methods - Statistics
       ======================================== */

    /**
     * Get collection statistics
     * @returns {Object} Statistics
     */
    getStatistics() {
      const stats = {
        total: this.collections.length,
        custom: this.getCustomCollections().length,
        default: this.collections.filter(col => col.isDefault).length,
        bySubject: {},
        simulationCounts: {},
        totalSimulations: 0
      };

      // Calculate stats
      this.collections.forEach(col => {
        // By subject
        stats.bySubject[col.subject] = (stats.bySubject[col.subject] || 0) + 1;

        // Simulation counts
        const simCount = col.simulationIds.length;
        stats.simulationCounts[col.id] = simCount;
        stats.totalSimulations += simCount;
      });

      return stats;
    }

    /* ========================================
       Public Methods - Import/Export
       ======================================== */

    /**
     * Export collections
     * @returns {Object} Export data
     */
    exportCollections() {
      return {
        version: '1.0',
        exportDate: new Date().toISOString(),
        collections: this.getCustomCollections(), // Only export custom collections
        statistics: this.getStatistics()
      };
    }

    /**
     * Import collections from data
     * @param {Object} importData - Import data
     * @param {boolean} merge - Whether to merge or replace
     * @returns {Promise<Object>} Import result
     */
    async importCollections(importData, merge = true) {
      try {
        if (!importData || !importData.collections || !Array.isArray(importData.collections)) {
          throw new Error('Invalid import data format');
        }

        let imported = 0;
        let skipped = 0;
        let errors = [];

        for (const colData of importData.collections) {
          try {
            // Check if collection already exists (by name)
            const exists = this.collections.some(col => col.name === colData.name);
            
            if (exists && merge) {
              skipped++;
              continue;
            }

            // Validate collection data
            const validation = this.validateCollectionData(colData);
            if (!validation.isValid) {
              errors.push(`Invalid collection data: ${validation.message}`);
              continue;
            }

            // Create collection
            await this.createCollection({
              ...colData,
              id: undefined // Let system assign new ID
            });
            
            imported++;

          } catch (error) {
            errors.push(`Failed to import collection: ${error.message}`);
          }
        }

        const result = {
          success: true,
          imported,
          skipped,
          errors,
          total: importData.collections.length
        };

        console.log('✅ Collections import completed:', result);
        return result;

      } catch (error) {
        console.error('❌ Collections import failed:', error);
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
          this.collections = data.collections || [];
          this.nextId = data.nextId || 1;
        } else {
          this.collections = [];
          this.nextId = 1;
        }

        console.log(`📚 Loaded ${this.collections.length} collections`);

      } catch (error) {
        console.error('❌ Failed to load from storage:', error);
        this.collections = [];
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
          collections: this.collections,
          nextId: this.nextId,
          lastSaved: new Date().toISOString()
        };

        localStorage.setItem(this.storageKey, JSON.stringify(data));
        console.log('💾 Collections saved');

      } catch (error) {
        console.error('❌ Failed to save to storage:', error);
        throw error;
      }
    }

    /**
     * Load collections from storage (legacy method)
     * @returns {Promise<void>}
     */
    async loadCollections() {
      return this.loadFromStorage();
    }

    /**
     * Save collections to storage (legacy method)
     * @returns {Promise<void>}
     */
    async saveCollections() {
      return this.saveToStorage();
    }

    /**
     * Create default collections
     */
    createDefaultCollections() {
      const defaultCollections = [
        {
          id: 'default-physics',
          name: 'Vật lý',
          description: 'Thí nghiệm Vật lý cơ bản',
          subject: 'physics',
          icon: '🔬',
          color: '#3498db',
          isDefault: true,
          simulationIds: [],
          createdDate: new Date().toISOString(),
          lastModified: new Date().toISOString()
        },
        {
          id: 'default-chemistry',
          name: 'Hóa học',
          description: 'Thí nghiệm Hóa học cơ bản',
          subject: 'chemistry',
          icon: '🧪',
          color: '#e74c3c',
          isDefault: true,
          simulationIds: [],
          createdDate: new Date().toISOString(),
          lastModified: new Date().toISOString()
        },
        {
          id: 'default-biology',
          name: 'Sinh học',
          description: 'Thí nghiệm Sinh học cơ bản',
          subject: 'biology',
          icon: '🌱',
          color: '#27ae60',
          isDefault: true,
          simulationIds: [],
          createdDate: new Date().toISOString(),
          lastModified: new Date().toISOString()
        },
        {
          id: 'default-mathematics',
          name: 'Toán học',
          description: 'Thí nghiệm Toán học cơ bản',
          subject: 'mathematics',
          icon: '📊',
          color: '#f39c12',
          isDefault: true,
          simulationIds: [],
          createdDate: new Date().toISOString(),
          lastModified: new Date().toISOString()
        }
      ];

      // Add default collections if they don't exist
      defaultCollections.forEach(defaultCol => {
        if (!this.collections.some(col => col.id === defaultCol.id)) {
          this.collections.push(defaultCol);
        }
      });
    }

    /**
     * Remove collection from all simulations
     * @param {string} collectionId - Collection ID
     * @returns {Promise<void>}
     */
    async removeCollectionFromSimulations(collectionId) {
      // This would integrate with SimulationManager to remove collection references
      // Implementation depends on how simulations store collection data
      console.log('TODO: Remove collection references from simulations:', collectionId);
    }

    /**
     * Validate collection data
     * @param {Object} data - Collection data
     * @returns {Object} Validation result
     */
    validateCollectionData(data) {
      const required = ['name', 'subject'];
      const missing = required.filter(field => !data[field]);

      if (missing.length > 0) {
        return {
          isValid: false,
          message: `Missing required fields: ${missing.join(', ')}`
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

      // Validate name length
      if (data.name.length < 2 || data.name.length > 50) {
        return {
          isValid: false,
          message: 'Collection name must be between 2 and 50 characters'
        };
      }

      return {
        isValid: true,
        message: 'Validation passed'
      };
    }

    /**
     * Dispatch collection event
     * @param {string} eventType - Event type
     * @param {Object} collectionData - Collection data
     */
    dispatchCollectionEvent(eventType, collectionData) {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(eventType, {
          detail: {
            collection: collectionData,
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
        collectionsCount: this.collections.length,
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
  function initializeCollectionManager() {
    if (typeof window !== 'undefined' && !window.CollectionManager) {
      console.log('🚀 Creating CollectionManager instance...');
      const manager = new CollectionManager();
      window.CollectionManager = manager;
      console.log('✅ CollectionManager instance created and auto-initializing...');
    }
  }

  // Initialize immediately if in browser
  if (typeof window !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initializeCollectionManager);
    } else {
      initializeCollectionManager();
    }
  }

  /* ========================================
     Export
     ======================================== */

  global.CollectionManager = CollectionManager;

  /* ========================================
     Development Helpers
     ======================================== */

  if (typeof window !== 'undefined' && window.console) {
    window.EduLabCollections = {
      create: (data) => window.CollectionManager?.createCollection(data),
      list: () => window.CollectionManager?.getCollections(),
      stats: () => window.CollectionManager?.getStatistics(),
      export: () => window.CollectionManager?.exportCollections()
    };
  }

})(typeof window !== 'undefined' ? window : global);
