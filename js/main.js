/* ========================================
   EduLab Main JavaScript
   Progressive enhancement and accessibility
   ======================================== */

(function() {
  'use strict';

  /* ========================================
     DOM Ready State
     ======================================== */

  // Wait for DOM to be fully loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
  } else {
    initializeApp();
  }

  /* ========================================
     Main Application Initialization
     ======================================== */

  function initializeApp() {
    // Initialize all components
    initializeNavigation();
    initializeSmoothScrolling();
    initializeAccessibility();
    initializeLoadingStates();
    initializeAnimations();
    initializeErrorHandling();
    initializeDataManagement();
    
    // Hide loading screen
    hideLoadingScreen();
    
    // Log initialization (development only)
    console.log('EduLab initialized successfully');
  }

  /* ========================================
     Navigation Functionality
     ======================================== */

  function initializeNavigation() {
    const navToggle = document.querySelector('.nav-toggle');
    const navMenu = document.querySelector('.nav-menu');
    const navLinks = document.querySelectorAll('.nav-link');
    
    if (!navToggle || !navMenu) return;
    
    // Mobile menu toggle
    navToggle.addEventListener('click', function() {
      const isExpanded = this.getAttribute('aria-expanded') === 'true';
      
      // Toggle menu visibility
      navMenu.classList.toggle('active');
      
      // Update ARIA attributes
      this.setAttribute('aria-expanded', !isExpanded);
      
      // Focus management
      if (!isExpanded) {
        navMenu.querySelector('.nav-link').focus();
      }
    });
    
    // Close mobile menu when clicking nav links
    navLinks.forEach(function(link) {
      link.addEventListener('click', function() {
        navMenu.classList.remove('active');
        navToggle.setAttribute('aria-expanded', 'false');
      });
    });
    
    // Close mobile menu when pressing Escape
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && navMenu.classList.contains('active')) {
        navMenu.classList.remove('active');
        navToggle.setAttribute('aria-expanded', 'false');
        navToggle.focus();
      }
    });
    
    // Close mobile menu when clicking outside
    document.addEventListener('click', function(e) {
      if (!navToggle.contains(e.target) && !navMenu.contains(e.target)) {
        navMenu.classList.remove('active');
        navToggle.setAttribute('aria-expanded', 'false');
      }
    });
    
    // Update active navigation link based on scroll position
    updateActiveNavigation();
    window.addEventListener('scroll', throttle(updateActiveNavigation, 100));
  }

  /* ========================================
     Smooth Scrolling
     ======================================== */

  function initializeSmoothScrolling() {
    // Handle anchor link clicks
    document.addEventListener('click', function(e) {
      const target = e.target.closest('a[href^="#"]');
      if (!target) return;
      
      const href = target.getAttribute('href');
      if (href === '#') return;
      
      const targetElement = document.querySelector(href);
      if (!targetElement) return;
      
      e.preventDefault();
      
      // Calculate offset for fixed header
      const headerHeight = document.querySelector('.header').offsetHeight;
      const targetPosition = targetElement.offsetTop - headerHeight - 20;
      
      // Smooth scroll to target
      window.scrollTo({
        top: targetPosition,
        behavior: 'smooth'
      });
      
      // Update browser history
      history.replaceState(null, null, href);
      
      // Focus management for accessibility
      targetElement.setAttribute('tabindex', '-1');
      targetElement.focus();
      targetElement.addEventListener('blur', function() {
        this.removeAttribute('tabindex');
      }, { once: true });
    });
  }

  /* ========================================
     Accessibility Enhancements
     ======================================== */

  function initializeAccessibility() {
    // Skip link functionality
    const skipLink = document.querySelector('.skip-link');
    if (skipLink) {
      skipLink.addEventListener('click', function(e) {
        e.preventDefault();
        const target = document.querySelector('#main-content');
        if (target) {
          target.setAttribute('tabindex', '-1');
          target.focus();
          target.addEventListener('blur', function() {
            this.removeAttribute('tabindex');
          }, { once: true });
        }
      });
    }
    
    // Enhanced keyboard navigation for cards
    const cards = document.querySelectorAll('.subject-card');
    cards.forEach(function(card) {
      card.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          const link = this.querySelector('.subject-link');
          if (link) {
            link.click();
          }
        }
      });
    });
    
    // Announce dynamic content changes to screen readers
    announceToScreenReader('Trang web EduLab đã tải xong');
  }

  /* ========================================
     Loading States
     ======================================== */

  function initializeLoadingStates() {
    // Show loading for slow connections
    const connectionSpeed = getConnectionSpeed();
    if (connectionSpeed === 'slow') {
      showLoadingScreen();
      setTimeout(hideLoadingScreen, 2000);
    }
  }

  function showLoadingScreen() {
    const loading = document.getElementById('loading');
    if (loading) {
      loading.classList.add('show');
      loading.setAttribute('aria-hidden', 'false');
    }
  }

  function hideLoadingScreen() {
    const loading = document.getElementById('loading');
    if (loading) {
      loading.classList.remove('show');
      loading.setAttribute('aria-hidden', 'true');
    }
  }

  /* ========================================
     Animations and Interactions
     ======================================== */

  function initializeAnimations() {
    // Respect user's motion preferences
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;
    
    // Intersection Observer for scroll animations
    const observerOptions = {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    };
    
    const observer = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          entry.target.style.opacity = '1';
          entry.target.style.transform = 'translateY(0)';
        }
      });
    }, observerOptions);
    
    // Observe elements for animation
    const animatedElements = document.querySelectorAll('.subject-card, .feature');
    animatedElements.forEach(function(el) {
      el.style.opacity = '0';
      el.style.transform = 'translateY(20px)';
      el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
      observer.observe(el);
    });
  }

  /* ========================================
     Error Handling
     ======================================== */

  function initializeErrorHandling() {
    // Global error handler
    window.addEventListener('error', function(e) {
      console.error('EduLab Error:', e.error);
      announceToScreenReader('Đã xảy ra lỗi. Vui lòng tải lại trang.');
    });
    
    // Unhandled promise rejection handler
    window.addEventListener('unhandledrejection', function(e) {
      console.error('EduLab Promise Rejection:', e.reason);
      e.preventDefault();
    });
  }

  /* ========================================
     Utility Functions
     ======================================== */

  function updateActiveNavigation() {
    const sections = document.querySelectorAll('section[id]');
    const navLinks = document.querySelectorAll('.nav-link');
    
    let current = '';
    const scrollPosition = window.scrollY + 100;
    
    sections.forEach(function(section) {
      const sectionTop = section.offsetTop;
      const sectionHeight = section.offsetHeight;
      
      if (scrollPosition >= sectionTop && scrollPosition < sectionTop + sectionHeight) {
        current = section.getAttribute('id');
      }
    });
    
    navLinks.forEach(function(link) {
      link.classList.remove('active');
      link.removeAttribute('aria-current');
      
      if (link.getAttribute('href') === '#' + current) {
        link.classList.add('active');
        link.setAttribute('aria-current', 'page');
      }
    });
  }

  function throttle(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = function() {
        clearTimeout(timeout);
        func.apply(this, args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = function() {
        clearTimeout(timeout);
        func.apply(this, args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  function getConnectionSpeed() {
    // Estimate connection speed based on browser API
    if ('connection' in navigator) {
      const connection = navigator.connection;
      if (connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g') {
        return 'slow';
      }
    }
    return 'fast';
  }

  function announceToScreenReader(message) {
    const announcement = document.createElement('div');
    announcement.setAttribute('aria-live', 'polite');
    announcement.setAttribute('aria-atomic', 'true');
    announcement.className = 'sr-only';
    announcement.textContent = message;
    
    document.body.appendChild(announcement);
    
    setTimeout(function() {
      document.body.removeChild(announcement);
    }, 1000);
  }

  /* ========================================
     Data Management
     ======================================== */

  function initializeDataManagement() {
    // Initialize content filter
    if (window.DataManager && window.ContentFilter) {
      const contentFilter = new window.ContentFilter(window.DataManager);
      
      // Initialize filter and load data
      contentFilter.initialize()
        .then(() => {
          console.log('Data management initialized');
          announceToScreenReader('Dữ liệu đã được tải thành công');
          
          // Store filter globally for other components
          window.EduLabFilter = contentFilter;
          
          // Populate homepage content if we're on the main page
          if (window.location.pathname.includes('index.html') || window.location.pathname === '/') {
            populateHomepageContent();
          }
          
          // Test data loading in development
          if (window.EduLabDataManager) {
            window.EduLabDataManager.validateConnection();
          }
        })
        .catch(error => {
          console.error('Failed to initialize data management:', error);
          announceToScreenReader('Không thể tải dữ liệu. Vui lòng tải lại trang.');
          
          // Show error message to user
          showDataLoadError(error.message);
        });
    }
  }

  async function populateHomepageContent() {
    try {
      // Get simulations data
      const physicsSimulations = await window.DataManager.getSimulationsBySubject('physics');
      
      // Update subject cards with real data
      const subjectCards = document.querySelectorAll('.subject-card');
      
      subjectCards.forEach(card => {
        const title = card.querySelector('.subject-title');
        if (title) {
          const subjectText = title.textContent.trim();
          
          // Add click handler to show simulations
          card.addEventListener('click', function(e) {
            if (e.target.tagName !== 'A') {
              e.preventDefault();
              showSubjectSimulations(getSubjectId(subjectText));
            }
          });
          
          // Update link to show simulations
          const link = card.querySelector('.subject-link');
          if (link) {
            link.href = '#';
            link.addEventListener('click', function(e) {
              e.preventDefault();
              showSubjectSimulations(getSubjectId(subjectText));
            });
          }
        }
      });
      
      // Show preview of available simulations
      if (physicsSimulations.length > 0) {
        updateSubjectCardStats();
      }
      
    } catch (error) {
      console.error('Failed to populate homepage content:', error);
    }
  }

  function getSubjectId(subjectText) {
    const subjectMap = {
      'Vật Lý': 'physics',
      'Hóa Học': 'chemistry',
      'Sinh Học': 'biology',
      'Toán Học': 'mathematics'
    };
    return subjectMap[subjectText] || 'physics';
  }

  async function showSubjectSimulations(subjectId) {
    try {
      const simulations = await window.DataManager.getSimulationsBySubject(subjectId);
      
      if (simulations.length === 0) {
        announceToScreenReader('Chưa có thí nghiệm nào cho môn học này');
        return;
      }

      // Create modal to show simulations
      const modal = createSimulationModal(subjectId, simulations);
      document.body.appendChild(modal);
      
      // Focus management
      modal.querySelector('.modal-close').focus();
      
    } catch (error) {
      console.error('Failed to load subject simulations:', error);
      announceToScreenReader('Có lỗi khi tải danh sách thí nghiệm');
    }
  }

  function createSimulationModal(subjectId, simulations) {
    const modal = document.createElement('div');
    modal.className = 'simulation-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'modal-title');
    
    const subjectNames = {
      physics: 'Vật Lý',
      chemistry: 'Hóa Học', 
      biology: 'Sinh Học',
      mathematics: 'Toán Học'
    };
    
    modal.innerHTML = `
      <div class="modal-backdrop" style="
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
      ">
        <div class="modal-content" style="
          background: white;
          border-radius: 12px;
          max-width: 800px;
          max-height: 80vh;
          overflow-y: auto;
          padding: 24px;
          position: relative;
          box-shadow: 0 20px 40px rgba(0,0,0,0.3);
        ">
          <div class="modal-header" style="
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 24px;
            padding-bottom: 16px;
            border-bottom: 1px solid #e0e0e0;
          ">
            <h2 id="modal-title" style="margin: 0; color: #1a73e8;">
              Thí nghiệm ${subjectNames[subjectId] || subjectId}
            </h2>
            <button class="modal-close" style="
              background: none;
              border: none;
              font-size: 24px;
              cursor: pointer;
              padding: 8px;
              border-radius: 4px;
              color: #666;
            " aria-label="Đóng">×</button>
          </div>
          
          <div class="simulations-grid" style="
            display: grid;
            gap: 16px;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          ">
            ${simulations.map(sim => `
              <div class="simulation-item" style="
                border: 1px solid #e0e0e0;
                border-radius: 8px;
                padding: 16px;
                transition: all 0.2s ease;
                cursor: pointer;
              " onmouseover="this.style.boxShadow='0 4px 12px rgba(0,0,0,0.1)'" 
                 onmouseout="this.style.boxShadow='none'"
                 onclick="window.open('simulation.html?id=${sim.id}', '_blank')">
                <h3 style="margin: 0 0 8px; color: #1a73e8; font-size: 16px;">${sim.title}</h3>
                <p style="margin: 0 0 12px; color: #666; font-size: 14px; line-height: 1.4;">
                  ${sim.description}
                </p>
                <div style="display: flex; gap: 8px; margin-bottom: 12px;">
                  <span style="
                    background: rgba(26,115,232,0.1);
                    color: #1a73e8;
                    padding: 2px 8px;
                    border-radius: 12px;
                    font-size: 12px;
                  ">Lớp ${sim.gradeLevel}</span>
                  <span style="
                    background: rgba(255,109,0,0.1);
                    color: #ff6d00;
                    padding: 2px 8px;
                    border-radius: 12px;
                    font-size: 12px;
                  ">${getDifficultyName(sim.difficulty)}</span>
                </div>
                <div style="
                  color: #1a73e8;
                  font-size: 14px;
                  font-weight: 500;
                ">Xem thí nghiệm →</div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
    
    // Add event listeners
    const closeBtn = modal.querySelector('.modal-close');
    const backdrop = modal.querySelector('.modal-backdrop');
    
    const closeModal = () => {
      document.body.removeChild(modal);
    };
    
    closeBtn.addEventListener('click', closeModal);
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) {
        closeModal();
      }
    });
    
    // Escape key handler
    const escapeHandler = (e) => {
      if (e.key === 'Escape') {
        closeModal();
        document.removeEventListener('keydown', escapeHandler);
      }
    };
    document.addEventListener('keydown', escapeHandler);
    
    return modal;
  }

  function getDifficultyName(difficulty) {
    const names = {
      beginner: 'Cơ bản',
      intermediate: 'Trung bình',
      advanced: 'Nâng cao'
    };
    return names[difficulty] || difficulty;
  }

  async function updateSubjectCardStats() {
    try {
      const stats = await window.DataManager.getStatistics();
      if (!stats) return;
      
      // Update cards with simulation counts
      const subjectCards = document.querySelectorAll('.subject-card');
      subjectCards.forEach(card => {
        const title = card.querySelector('.subject-title');
        if (title) {
          const subjectText = title.textContent.trim();
          const subjectId = getSubjectId(subjectText);
          const count = stats.simulationsBySubject[subjectId] || 0;
          
          if (count > 0) {
            const description = card.querySelector('.subject-description');
            if (description) {
              description.innerHTML += `<br><small style="color: var(--primary-color); font-weight: 500;">${count} thí nghiệm có sẵn</small>`;
            }
          }
        }
      });
      
    } catch (error) {
      console.error('Failed to update subject card stats:', error);
    }
  }

  function showDataLoadError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #f44336;
      color: white;
      padding: 16px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      z-index: 10000;
      max-width: 300px;
      font-size: 14px;
    `;
    errorDiv.innerHTML = `
      <strong>Lỗi tải dữ liệu</strong><br>
      ${message}
      <br><br>
      <button onclick="location.reload()" style="background: rgba(255,255,255,0.2); border: 1px solid white; color: white; padding: 8px 16px; border-radius: 4px; cursor: pointer;">
        Tải lại trang
      </button>
    `;
    
    document.body.appendChild(errorDiv);
    
    // Auto-remove after 10 seconds
    setTimeout(() => {
      if (errorDiv.parentNode) {
        errorDiv.parentNode.removeChild(errorDiv);
      }
    }, 10000);
  }

  /* ========================================
     Public API
     ======================================== */

  // Expose public methods for external use
  window.EduLab = {
    version: '1.0.0',
    showLoading: showLoadingScreen,
    hideLoading: hideLoadingScreen,
    announce: announceToScreenReader,
    showError: showDataLoadError
  };

  /* ========================================
     Performance Monitoring
     ======================================== */

  // Basic performance logging (development only)
  if (window.performance && window.performance.mark) {
    window.performance.mark('edulab-script-start');
    
    window.addEventListener('load', function() {
      window.performance.mark('edulab-script-end');
      window.performance.measure('edulab-script', 'edulab-script-start', 'edulab-script-end');
      
      const measure = window.performance.getEntriesByName('edulab-script')[0];
      console.log('EduLab script execution time:', measure.duration.toFixed(2), 'ms');
    });
  }

  /* ========================================
     Progressive Web App Features (Future)
     ======================================== */

  // Service Worker registration would go here
  // Currently not implemented to keep the solution simple

})();
