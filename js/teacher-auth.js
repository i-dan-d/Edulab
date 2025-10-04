/* ========================================
   EduLab Teacher Authentication System
   Simple session-based authentication
   ======================================== */

(function(global) {
  'use strict';

  /* ========================================
     Teacher Authentication Class
     ======================================== */

  class TeacherAuth {
    constructor() {
      this.sessionKey = 'edulab_teacher_session';
      this.sessionDuration = 24 * 60 * 60 * 1000; // 24 hours
    }

    /* ========================================
       Public Methods - Authentication
       ======================================== */

    /**
     * Check if user is currently logged in
     * @returns {boolean} Login status
     */
    isLoggedIn() {
      try {
        // Check sessionStorage first, then localStorage
        let sessionData = sessionStorage.getItem(this.sessionKey);
        if (!sessionData) {
          sessionData = localStorage.getItem(this.sessionKey);
          
          // If found in localStorage, restore to sessionStorage
          if (sessionData) {
            sessionStorage.setItem(this.sessionKey, sessionData);
          }
        }

        if (!sessionData) return false;

        const session = JSON.parse(sessionData);
        
        // Validate session structure
        if (!session.username || !session.loginTime || !session.expiresAt) {
          this.clearSession();
          return false;
        }

        // Check if session is expired
        if (Date.now() > session.expiresAt) {
          this.clearSession();
          return false;
        }

        return true;

      } catch (error) {
        console.warn('Failed to check login status:', error);
        this.clearSession();
        return false;
      }
    }

    /**
     * Get current session information
     * @returns {Object|null} Session data or null
     */
    getSession() {
      try {
        if (!this.isLoggedIn()) return null;

        let sessionData = sessionStorage.getItem(this.sessionKey);
        if (!sessionData) {
          sessionData = localStorage.getItem(this.sessionKey);
        }

        return sessionData ? JSON.parse(sessionData) : null;

      } catch (error) {
        console.warn('Failed to get session:', error);
        return null;
      }
    }

    /**
     * Create a new session (called after successful login)
     * @param {string} username - Username
     * @returns {boolean} Success status
     */
    createSession(username) {
      try {
        const sessionData = {
          username: username,
          loginTime: Date.now(),
          expiresAt: Date.now() + this.sessionDuration,
          sessionId: this.generateSessionId()
        };

        sessionStorage.setItem(this.sessionKey, JSON.stringify(sessionData));
        localStorage.setItem(this.sessionKey, JSON.stringify(sessionData)); // Backup

        console.log('Teacher session created for:', username);
        return true;

      } catch (error) {
        console.error('Failed to create session:', error);
        return false;
      }
    }

    /**
     * Clear current session (logout)
     */
    logout() {
      this.clearSession();
      
      // Redirect to login page
      if (typeof window !== 'undefined') {
        window.location.href = 'teacher-login.html';
      }
    }

    /**
     * Require login - redirect to login page if not authenticated
     * @returns {boolean} True if authenticated, false if redirected
     */
    requireLogin() {
      if (!this.isLoggedIn()) {
        if (typeof window !== 'undefined') {
          // Store current page for redirect after login
          const currentPage = window.location.pathname + window.location.search;
          sessionStorage.setItem('edulab_redirect_after_login', currentPage);
          
          window.location.href = 'teacher-login.html';
        }
        return false;
      }
      return true;
    }

    /**
     * Check if current page requires authentication
     * @returns {boolean} True if page requires auth
     */
    isProtectedPage() {
      if (typeof window === 'undefined') return false;
      
      const protectedPages = [
        'teacher-tools.html',
        'teacher-admin.html'
      ];

      const currentPage = window.location.pathname.split('/').pop();
      return protectedPages.includes(currentPage);
    }

    /* ========================================
       Public Methods - Utilities
       ======================================== */

    /**
     * Get time until session expires
     * @returns {number} Minutes until expiration
     */
    getTimeUntilExpiry() {
      const session = this.getSession();
      if (!session) return 0;

      const timeLeft = session.expiresAt - Date.now();
      return Math.max(0, Math.floor(timeLeft / (1000 * 60))); // Minutes
    }

    /**
     * Extend current session
     * @returns {boolean} Success status
     */
    extendSession() {
      try {
        const session = this.getSession();
        if (!session) return false;

        session.expiresAt = Date.now() + this.sessionDuration;
        
        sessionStorage.setItem(this.sessionKey, JSON.stringify(session));
        localStorage.setItem(this.sessionKey, JSON.stringify(session));

        console.log('Teacher session extended');
        return true;

      } catch (error) {
        console.error('Failed to extend session:', error);
        return false;
      }
    }

    /**
     * Show logout button in UI
     * @param {string} containerId - Container element ID
     */
    renderLogoutButton(containerId) {
      if (!this.isLoggedIn()) return;

      const container = document.getElementById(containerId);
      if (!container) return;

      const session = this.getSession();
      const username = session ? session.username : 'Giáo viên';

      const logoutSection = document.createElement('div');
      logoutSection.className = 'teacher-session-info';
      logoutSection.style.cssText = `
        background: #f0f9ff;
        border: 1px solid #bae6fd;
        border-radius: 8px;
        padding: 12px;
        margin-bottom: 16px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 8px;
      `;

      logoutSection.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 18px;">👨‍🏫</span>
          <div>
            <div style="font-weight: 600; color: #0369a1;">Xin chào, ${username}!</div>
            <div style="font-size: 12px; color: #0284c7;">Phiên đăng nhập còn ${this.getTimeUntilExpiry()} phút</div>
          </div>
        </div>
        <button onclick="window.TeacherAuth?.logout()" 
                style="background: #ef4444; color: white; border: none; padding: 6px 12px; 
                       border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 500;">
          🚪 Đăng xuất
        </button>
      `;

      container.appendChild(logoutSection);
    }

    /* ========================================
       Private Methods
       ======================================== */

    /**
     * Clear session data
     */
    clearSession() {
      try {
        sessionStorage.removeItem(this.sessionKey);
        localStorage.removeItem(this.sessionKey);
        sessionStorage.removeItem('edulab_redirect_after_login');
      } catch (error) {
        console.warn('Failed to clear session:', error);
      }
    }

    /**
     * Generate unique session ID
     * @returns {string} Session ID
     */
    generateSessionId() {
      return 'sess_' + Date.now() + '_' + Math.random().toString(36).substring(2, 15);
    }

    /* ========================================
       Auto-initialization
       ======================================== */

    /**
     * Initialize authentication system
     */
    init() {
      // Auto-protect current page if needed
      if (this.isProtectedPage()) {
        this.requireLogin();
      }

      // Auto-extend session on activity
      if (this.isLoggedIn()) {
        this.setupActivityExtension();
        this.setupExpiryWarning();
      }
    }

    /**
     * Setup automatic session extension on user activity
     */
    setupActivityExtension() {
      if (typeof window === 'undefined') return;

      let lastActivity = Date.now();
      const extendInterval = 5 * 60 * 1000; // 5 minutes

      const updateActivity = () => {
        lastActivity = Date.now();
      };

      // Track user activity
      ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'].forEach(event => {
        window.addEventListener(event, updateActivity, { passive: true });
      });

      // Check if session should be extended
      setInterval(() => {
        if (this.isLoggedIn() && Date.now() - lastActivity < extendInterval) {
          const timeUntilExpiry = this.getTimeUntilExpiry();
          
          // Extend if less than 10 minutes remaining
          if (timeUntilExpiry < 10) {
            this.extendSession();
          }
        }
      }, 60 * 1000); // Check every minute
    }

    /**
     * Setup expiry warning
     */
    setupExpiryWarning() {
      if (typeof window === 'undefined') return;

      setInterval(() => {
        if (this.isLoggedIn()) {
          const timeLeft = this.getTimeUntilExpiry();
          
          // Show warning if less than 5 minutes
          if (timeLeft <= 5 && timeLeft > 0) {
            this.showExpiryWarning(timeLeft);
          } else if (timeLeft <= 0) {
            this.logout();
          }
        }
      }, 60 * 1000); // Check every minute
    }

    /**
     * Show session expiry warning
     * @param {number} minutesLeft - Minutes until expiry
     */
    showExpiryWarning(minutesLeft) {
      if (typeof window === 'undefined' || window.EduLabSessionWarningShown) return;

      window.EduLabSessionWarningShown = true;

      const shouldExtend = confirm(
        `Phiên đăng nhập sẽ hết hạn trong ${minutesLeft} phút.\n\n` +
        'Bạn có muốn gia hạn phiên làm việc không?'
      );

      if (shouldExtend) {
        this.extendSession();
        window.EduLabSessionWarningShown = false;
      } else {
        this.logout();
      }
    }
  }

  /* ========================================
     Export and Auto-initialization
     ======================================== */

  const teacherAuth = new TeacherAuth();
  global.TeacherAuth = teacherAuth;

  // Auto-initialize when DOM is ready
  if (typeof window !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => teacherAuth.init());
    } else {
      teacherAuth.init();
    }
  }

  /* ========================================
     Development Helpers
     ======================================== */

  if (typeof window !== 'undefined' && window.console) {
    window.EduLabAuth = {
      login: (username) => teacherAuth.createSession(username),
      logout: () => teacherAuth.logout(),
      isLoggedIn: () => teacherAuth.isLoggedIn(),
      getSession: () => teacherAuth.getSession(),
      extend: () => teacherAuth.extendSession(),
      timeLeft: () => teacherAuth.getTimeUntilExpiry()
    };
  }

})(typeof window !== 'undefined' ? window : global);



