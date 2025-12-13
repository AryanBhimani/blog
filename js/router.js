// Simple Router for Client-Side Page Routing and 404 Handling

class Router {
  constructor() {
    this.validPages = [
      'index',
      'about',
      'post',
      'profile',
      'auth',
      'settings',
      'editprofile',
      'search',
      'followers',
      'following',
      'comment',
      'forgot',
      '404'
    ];

    this.setupRouting();
  }

  /**
   * Setup routing based on URL path and handle 404s
   */
  setupRouting() {
    // Get the current page from URL hash or pathname
    const currentPage = this.getCurrentPage();

    // Check if the page is valid
    if (!this.isValidPage(currentPage)) {
      this.redirectTo404();
    }
  }

  /**
   * Get the current page name from URL
   * @returns {string} The page name
   */
  getCurrentPage() {
    // Get pathname and remove leading/trailing slashes
    let path = window.location.pathname.toLowerCase().trim();
    
    // Remove leading slash
    if (path.startsWith('/')) {
      path = path.substring(1);
    }

    // Remove trailing slash
    if (path.endsWith('/')) {
      path = path.substring(0, path.length - 1);
    }

    // Extract just the page name (last part of path)
    const parts = path.split('/');
    let pageName = parts[parts.length - 1];

    // If path is empty or just domain, it's the index page
    if (!pageName) {
      return 'index';
    }

    // Remove .html extension if present
    if (pageName.endsWith('.html')) {
      pageName = pageName.replace('.html', '');
    }

    return pageName;
  }

  /**
   * Check if a page is valid
   * @param {string} pageName - The page name to check
   * @returns {boolean} True if valid, false otherwise
   */
  isValidPage(pageName) {
    return this.validPages.includes(pageName);
  }

  /**
   * Redirect to 404 page
   */
  redirectTo404() {
    window.location.href = './404.html';
  }

  /**
   * Navigate to a specific page
   * @param {string} pageName - The page to navigate to
   */
  navigate(pageName) {
    if (this.isValidPage(pageName)) {
      window.location.href = `./${pageName}.html`;
    } else {
      this.redirectTo404();
    }
  }
}

// Initialize router when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new Router();
  });
} else {
  new Router();
}
