/**
 * ============================================================================
 * VSP Common Topbar & Footer Component System
 * Single Source of Truth for Navigation & Footer across the entire portfolio
 * ============================================================================
 */

(function () {
  'use strict';

  function getRootPrefix() {
    const currentScript = document.currentScript || document.querySelector('script[src*="nav-footer.js"]');
    if (currentScript) {
      const src = currentScript.getAttribute('src');
      if (src && src.startsWith('../')) {
        return '../';
      }
    }
    const path = window.location.pathname;
    if (path.includes('/blogs/')) {
      return '../';
    }
    return './';
  }

  function getActiveTab() {
    const path = window.location.pathname.toLowerCase();
    if (path.includes('blogs') || path.includes('/blogs/')) {
      return 'blogs';
    }
    if (path.includes('bot')) {
      return 'bot';
    }
    return 'home';
  }

  function renderHeader() {
    const headerContainer = document.getElementById('vsp-header') || document.querySelector('header');
    if (!headerContainer) return;

    const root = getRootPrefix();
    const active = getActiveTab();

    const homeActive = active === 'home' ? 'active' : '';
    const botActive = active === 'bot' ? 'active' : '';
    const blogActive = active === 'blogs' ? 'active' : '';

    headerContainer.innerHTML = `
      <div class="w3l-header fixed-top" id="home">
        <div class="container">
          <nav class="navbar navbar-expand-lg navbar-dark pl-0 pr-0">
            <a class="navbar-brand m-0" href="${root}index.html">
              <span class="fa fa-gamepad"></span> VSP
            </a>
            <button
              class="navbar-toggler"
              type="button"
              data-toggle="collapse"
              data-target="#navbarNav"
              aria-controls="navbarNav"
              aria-expanded="false"
              aria-label="Toggle navigation menu"
            >
              <span class="navbar-toggler-icon fa fa-bars"></span>
            </button>
            <div class="collapse navbar-collapse" id="navbarNav">
              <ul class="navbar-nav ml-auto">
                <li class="nav-item mr-lg-4">
                  <a class="nav-link pl-0 pr-0 ${homeActive}" href="${root}index.html" title="Home" aria-label="Home">
                    <span class="fa-solid fa-house"></span>
                  </a>
                </li>
                <li class="nav-item mr-lg-4">
                  <a class="nav-link pl-0 pr-0 ${botActive}" href="${root}bot/" title="Bot" aria-label="Bot">
                    <span class="fa-solid fa-robot"></span>
                  </a>
                </li>
                <li class="nav-item mr-lg-4">
                  <a class="nav-link pl-0 pr-0 ${blogActive}" href="${root}blogs.html" title="Blogs" aria-label="Blogs">
                    <span class="fa-solid fa-newspaper"></span>
                  </a>
                </li>
              </ul>
            </div>
          </nav>
        </div>
      </div>
    `;

    // Ensure vanilla mobile toggle works even without jQuery/Bootstrap loaded
    const toggler = headerContainer.querySelector('.navbar-toggler');
    const collapseNav = headerContainer.querySelector('#navbarNav');
    if (toggler && collapseNav) {
      toggler.addEventListener('click', () => {
        collapseNav.classList.toggle('show');
      });
    }
  }

  function renderFooter() {
    const footerContainer = document.getElementById('vsp-footer') || document.querySelector('footer');
    if (!footerContainer) return;

    footerContainer.innerHTML = `
      <section class="w3l-footers-1">
        <div class="footer py-3">
          <div class="container">
            <div class="footer-content">
              <div class="row">
                <div class="col-lg-8 footer-left">
                  <p class="m-0">
                    &copy; 2026 All Rights Reserved | Design by VSP
                  </p>
                </div>
                <div class="col-lg-4 footer-right text-lg-right text-center mt-lg-0 mt-3">
                  <ul class="social m-0 p-0">
                    <li>
                      <a href="https://github.com/vishnusureshperumbavoor" aria-label="GitHub Profile">
                        <span class="fa fa-github"></span>
                      </a>
                    </li>
                    <li>
                      <a href="https://huggingface.co/vishnusureshperumbavoor" target="_blank" aria-label="HuggingFace Profile">
                        <span style="font-size: 1.2em">🤗</span>
                      </a>
                    </li>
                    <li>
                      <a href="https://www.linkedin.com/in/vishnu-suresh-perumbavoor-9a7a8223a/" aria-label="LinkedIn Profile">
                        <span class="fa fa-linkedin"></span>
                      </a>
                    </li>
                    <li>
                      <a href="https://www.instagram.com/vishnusureshperumbavoor/" aria-label="Instagram Profile">
                        <span class="fa fa-instagram"></span>
                      </a>
                    </li>
                    <li>
                      <a href="http://www.twitter.com/vspeeeeee" aria-label="Twitter Profile">
                        <span class="fa fa-twitter"></span>
                      </a>
                    </li>
                    <li>
                      <a href="https://www.youtube.com/@vishnusureshperumbavoor/videos" aria-label="YouTube Channel">
                        <span class="fa fa-youtube-square p-2"></span>
                      </a>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    `;
  }

  // Execute immediately if DOM elements exist, or on DOMContentLoaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      renderHeader();
      renderFooter();
    });
  } else {
    renderHeader();
    renderFooter();
  }
})();
