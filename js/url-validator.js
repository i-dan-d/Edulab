/* ========================================
   EduLab PhET URL Validator
   Validates and tests PhET simulation URLs
   ======================================== */

(function(global) {
  'use strict';

  /* ========================================
     URL Validator Class
     ======================================== */

  class URLValidator {
    constructor() {
      this.phetDomains = [
        'phet.colorado.edu',
        'phet-dev.colorado.edu',
        'phet.cs.colorado.edu'
      ];
      
      this.validationCache = new Map();
      this.previewTimeouts = new Map();
      this.maxPreviewTime = 15000; // 15 seconds
    }

    /* ========================================
       Public Methods - URL Validation
       ======================================== */

    /**
     * Validate PhET simulation URL
     * @param {string} url - URL to validate
     * @returns {Promise<Object>} Validation result
     */
    async validatePhETURL(url) {
      try {
        // Basic URL format validation
        const basicValidation = this.validateURLFormat(url);
        if (!basicValidation.isValid) {
          return basicValidation;
        }

        // Check cache first
        const cacheKey = this.getCacheKey(url);
        if (this.validationCache.has(cacheKey)) {
          const cached = this.validationCache.get(cacheKey);
          // Return cached result if less than 5 minutes old
          if (Date.now() - cached.timestamp < 5 * 60 * 1000) {
            return cached.result;
          }
        }

        // Advanced validation - check if simulation loads
        const advancedValidation = await this.validateSimulationAccess(url);
        
        // Cache result
        this.validationCache.set(cacheKey, {
          result: advancedValidation,
          timestamp: Date.now()
        });

        return advancedValidation;

      } catch (error) {
        console.error('URL validation error:', error);
        return {
          isValid: false,
          error: 'VALIDATION_ERROR',
          message: 'Có lỗi xảy ra khi kiểm tra URL. Vui lòng thử lại.',
          details: error.message
        };
      }
    }

    /**
     * Extract simulation metadata from URL
     * @param {string} url - PhET simulation URL
     * @returns {Object} Extracted metadata
     */
    extractSimulationMetadata(url) {
      try {
        const urlObj = new URL(url);
        const pathParts = urlObj.pathname.split('/');
        
        // Find simulation name from URL path
        let simulationName = '';
        let language = 'en';
        
        // Pattern: /sims/html/simulation-name/latest/simulation-name_lang.html
        if (pathParts.includes('sims') && pathParts.includes('html')) {
          const simIndex = pathParts.findIndex(part => part === 'html') + 1;
          if (simIndex < pathParts.length) {
            simulationName = pathParts[simIndex];
          }
        }
        
        // Extract language from filename if present
        const filename = pathParts[pathParts.length - 1];
        if (filename && filename.includes('_')) {
          const langMatch = filename.match(/_([a-z]{2})\.html$/);
          if (langMatch) {
            language = langMatch[1];
          }
        }

        return {
          simulationName,
          language,
          domain: urlObj.hostname,
          fullPath: urlObj.pathname,
          title: this.generateTitleFromName(simulationName),
          isHTML5: url.includes('/html/'),
          isLatest: url.includes('/latest/')
        };

      } catch (error) {
        console.error('Error extracting metadata:', error);
        return {
          simulationName: '',
          language: 'en',
          domain: '',
          fullPath: '',
          title: '',
          isHTML5: false,
          isLatest: false
        };
      }
    }

    /**
     * Generate Vietnamese title suggestions
     * @param {string} simulationName - English simulation name
     * @returns {Array} Vietnamese title suggestions
     */
    generateVietnameseTitles(simulationName) {
      const titleMap = {
        'forces-and-motion-basics': ['Lực và Chuyển động Cơ bản', 'Cơ bản về Lực và Chuyển động'],
        'energy-skate-park': ['Công viên Trượt ván - Năng lượng', 'Năng lượng trong Công viên Trượt ván'],
        'projectile-motion': ['Chuyển động Ném xiên', 'Chuyển động Vật thể Bay'],
        'wave-on-a-string': ['Sóng trên Dây', 'Sóng Cơ học'],
        'circuit-construction-kit': ['Bộ dụng cụ Mạch điện', 'Xây dựng Mạch điện'],
        'ph-scale': ['Thang đo pH', 'Độ pH'],
        'acid-base-solutions': ['Dung dịch Acid-Base', 'Acid và Base'],
        'molarity': ['Nồng độ Mol', 'Độ Mol'],
        'balancing-chemical-equations': ['Cân bằng Phương trình Hóa học', 'Cân bằng Phương trình'],
        'gene-expression-essentials': ['Cơ bản về Biểu hiện Gen', 'Biểu hiện Gen'],
        'natural-selection': ['Chọn lọc Tự nhiên', 'Tiến hóa Tự nhiên'],
        'graphing-lines': ['Vẽ đồ thị Đường thẳng', 'Đồ thị Hàm số Bậc nhất']
      };

      if (titleMap[simulationName]) {
        return titleMap[simulationName];
      }

      // Generate generic title suggestions
      const formatted = simulationName
        .replace(/-/g, ' ')
        .replace(/\b\w/g, l => l.toUpperCase());

      return [
        `Thí nghiệm ${formatted}`,
        `Mô phỏng ${formatted}`,
        formatted
      ];
    }

    /**
     * Preview simulation in iframe
     * @param {string} url - PhET simulation URL
     * @param {HTMLElement} previewContainer - Container for preview
     * @returns {Promise<Object>} Preview result
     */
    async previewSimulation(url, previewContainer) {
      return new Promise((resolve) => {
        // Clear existing preview
        previewContainer.innerHTML = '';
        
        // Create preview iframe
        const iframe = document.createElement('iframe');
        iframe.src = url;
        iframe.width = '100%';
        iframe.height = '400px';
        iframe.style.border = 'none';
        iframe.style.borderRadius = '8px';
        iframe.sandbox = 'allow-scripts allow-same-origin allow-forms';

        // Loading indicator
        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'preview-loading';
        loadingDiv.innerHTML = `
          <div class="loading-spinner"></div>
          <p>Đang tải thí nghiệm...</p>
        `;
        previewContainer.appendChild(loadingDiv);

        let isResolved = false;
        const timeoutId = setTimeout(() => {
          if (!isResolved) {
            isResolved = true;
            resolve({
              success: false,
              error: 'TIMEOUT',
              message: 'Thí nghiệm mất quá nhiều thời gian để tải. Vui lòng kiểm tra URL.'
            });
          }
        }, this.maxPreviewTime);

        iframe.onload = () => {
          if (!isResolved) {
            isResolved = true;
            clearTimeout(timeoutId);
            
            // Remove loading indicator
            loadingDiv.remove();
            
            // Add iframe to container
            previewContainer.appendChild(iframe);
            
            resolve({
              success: true,
              message: 'Thí nghiệm tải thành công!',
              iframe: iframe
            });
          }
        };

        iframe.onerror = () => {
          if (!isResolved) {
            isResolved = true;
            clearTimeout(timeoutId);
            
            resolve({
              success: false,
              error: 'LOAD_ERROR',
              message: 'Không thể tải thí nghiệm. Vui lòng kiểm tra URL.'
            });
          }
        };

        // Store timeout reference for cleanup
        this.previewTimeouts.set(url, timeoutId);
      });
    }

    /**
     * Clear preview and cleanup
     * @param {string} url - URL being previewed
     */
    clearPreview(url) {
      if (this.previewTimeouts.has(url)) {
        clearTimeout(this.previewTimeouts.get(url));
        this.previewTimeouts.delete(url);
      }
    }

    /* ========================================
       Private Methods - Validation Logic
       ======================================== */

    /**
     * Validate basic URL format
     * @param {string} url - URL to validate
     * @returns {Object} Validation result
     */
    validateURLFormat(url) {
      if (!url || typeof url !== 'string') {
        return {
          isValid: false,
          error: 'EMPTY_URL',
          message: 'Vui lòng nhập URL của thí nghiệm PhET.'
        };
      }

      // Check if URL is properly formatted
      try {
        const urlObj = new URL(url);
        
        // Check if it's a PhET domain
        if (!this.phetDomains.some(domain => urlObj.hostname.includes(domain))) {
          return {
            isValid: false,
            error: 'INVALID_DOMAIN',
            message: 'URL phải từ trang web PhET (phet.colorado.edu).',
            suggestion: 'Ví dụ: https://phet.colorado.edu/sims/html/forces-and-motion-basics/latest/forces-and-motion-basics_vi.html'
          };
        }

        // Check if it's an HTML5 simulation
        if (!url.includes('/html/')) {
          return {
            isValid: false,
            error: 'NOT_HTML5',
            message: 'Chỉ hỗ trợ thí nghiệm HTML5. URL phải chứa "/html/".',
            suggestion: 'Tìm phiên bản HTML5 của thí nghiệm trên trang PhET.'
          };
        }

        // Check if URL ends with .html
        if (!urlObj.pathname.endsWith('.html')) {
          return {
            isValid: false,
            error: 'INVALID_FORMAT',
            message: 'URL phải kết thúc bằng ".html".',
            suggestion: 'Đảm bảo URL trỏ đến file HTML của thí nghiệm.'
          };
        }

        return {
          isValid: true,
          message: 'Định dạng URL hợp lệ.',
          metadata: this.extractSimulationMetadata(url)
        };

      } catch (error) {
        return {
          isValid: false,
          error: 'MALFORMED_URL',
          message: 'URL không đúng định dạng. Vui lòng kiểm tra lại.',
          suggestion: 'Đảm bảo URL bắt đầu bằng https:// và đúng cú pháp.'
        };
      }
    }

    /**
     * Validate simulation accessibility
     * @param {string} url - URL to validate
     * @returns {Promise<Object>} Validation result
     */
    async validateSimulationAccess(url) {
      try {
        // Use head request to check if resource exists
        const response = await fetch(url, { 
          method: 'HEAD',
          mode: 'no-cors' // Handle CORS limitations
        });

        // Note: With no-cors, we can't read the response status
        // So we'll do a more comprehensive check using an iframe test
        return await this.validateWithIframe(url);

      } catch (error) {
        return {
          isValid: false,
          error: 'ACCESS_ERROR',
          message: 'Không thể truy cập URL. Vui lòng kiểm tra kết nối mạng.',
          details: error.message
        };
      }
    }

    /**
     * Validate using iframe loading test
     * @param {string} url - URL to validate
     * @returns {Promise<Object>} Validation result
     */
    async validateWithIframe(url) {
      return new Promise((resolve) => {
        const iframe = document.createElement('iframe');
        iframe.src = url;
        iframe.style.display = 'none';
        iframe.sandbox = 'allow-scripts allow-same-origin';

        let isResolved = false;
        const timeoutId = setTimeout(() => {
          if (!isResolved) {
            isResolved = true;
            document.body.removeChild(iframe);
            resolve({
              isValid: false,
              error: 'TIMEOUT',
              message: 'Thí nghiệm mất quá nhiều thời gian để tải. URL có thể không hợp lệ.'
            });
          }
        }, 10000); // 10 second timeout

        iframe.onload = () => {
          if (!isResolved) {
            isResolved = true;
            clearTimeout(timeoutId);
            document.body.removeChild(iframe);
            
            resolve({
              isValid: true,
              message: 'URL hợp lệ và thí nghiệm có thể tải được.',
              metadata: this.extractSimulationMetadata(url)
            });
          }
        };

        iframe.onerror = () => {
          if (!isResolved) {
            isResolved = true;
            clearTimeout(timeoutId);
            document.body.removeChild(iframe);
            
            resolve({
              isValid: false,
              error: 'LOAD_ERROR',
              message: 'Không thể tải thí nghiệm từ URL này.'
            });
          }
        };

        document.body.appendChild(iframe);
      });
    }

    /* ========================================
       Private Methods - Utilities
       ======================================== */

    /**
     * Generate cache key for URL
     * @param {string} url - URL
     * @returns {string} Cache key
     */
    getCacheKey(url) {
      return btoa(url).replace(/[^a-zA-Z0-9]/g, '');
    }

    /**
     * Generate title from simulation name
     * @param {string} name - Simulation name
     * @returns {string} Formatted title
     */
    generateTitleFromName(name) {
      return name
        .replace(/-/g, ' ')
        .replace(/\b\w/g, l => l.toUpperCase());
    }

    /**
     * Get popular PhET simulations for suggestions
     * @returns {Array} Popular simulation URLs
     */
    getPopularSimulations() {
      return [
        {
          url: 'https://phet.colorado.edu/sims/html/forces-and-motion-basics/latest/forces-and-motion-basics_vi.html',
          title: 'Lực và Chuyển động Cơ bản',
          subject: 'physics'
        },
        {
          url: 'https://phet.colorado.edu/sims/html/energy-skate-park/latest/energy-skate-park_vi.html',
          title: 'Công viên Trượt ván - Năng lượng',
          subject: 'physics'
        },
        {
          url: 'https://phet.colorado.edu/sims/html/ph-scale/latest/ph-scale_vi.html',
          title: 'Thang đo pH',
          subject: 'chemistry'
        },
        {
          url: 'https://phet.colorado.edu/sims/html/circuit-construction-kit-dc/latest/circuit-construction-kit-dc_vi.html',
          title: 'Bộ dụng cụ Mạch điện DC',
          subject: 'physics'
        }
      ];
    }

    /**
     * Clear validation cache
     */
    clearCache() {
      this.validationCache.clear();
    }

    /**
     * Get cache statistics
     * @returns {Object} Cache stats
     */
    getCacheStats() {
      return {
        size: this.validationCache.size,
        entries: Array.from(this.validationCache.keys())
      };
    }
  }

  /* ========================================
     Export
     ======================================== */

  const urlValidator = new URLValidator();
  global.URLValidator = urlValidator;

  /* ========================================
     Development Helpers
     ======================================== */

  if (typeof window !== 'undefined' && window.console) {
    window.EduLabValidator = {
      validate: (url) => urlValidator.validatePhETURL(url),
      extract: (url) => urlValidator.extractSimulationMetadata(url),
      preview: (url, container) => urlValidator.previewSimulation(url, container),
      suggestions: () => urlValidator.getPopularSimulations(),
      clearCache: () => urlValidator.clearCache()
    };
  }

})(typeof window !== 'undefined' ? window : global);



