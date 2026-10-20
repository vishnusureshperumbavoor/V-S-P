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
    if (path.includes('/blogs/') || path.includes('/bot/') || path.endsWith('/bot') || path.includes('/bot/index.html')) {
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
    if (path.includes('vsp') || path.includes('lab')) {
      return 'vsp';
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
    const vspActive = active === 'vsp' ? 'active' : '';

    const backButtonHtml = active !== 'home' ? `
      <a href="${root}index.html" class="vsp-nav-back-btn mr-2" title="Back to Home" aria-label="Back to Home">
        <i class="fa-solid fa-arrow-left"></i>
      </a>
    ` : '';

    headerContainer.innerHTML = `
      <div class="w3l-header fixed-top" id="home">
        <div class="container">
          <nav class="navbar navbar-expand-lg navbar-dark pl-0 pr-0">
            <div class="d-flex align-items-center">
              ${backButtonHtml}
              <a class="navbar-brand m-0" href="${root}index.html">
                <span class="fa fa-gamepad"></span> VSP
              </a>
            </div>
            <button
              class="navbar-toggler"
              type="button"
              aria-controls="navbarNav"
              aria-expanded="false"
              aria-label="Toggle navigation menu"
            >
              <i class="fa-solid fa-bars"></i>
            </button>
            <div class="collapse navbar-collapse" id="navbarNav">
              <ul class="navbar-nav ml-auto">
                <li class="nav-item mr-lg-4">
                  <a class="nav-link pl-0 pr-0 ${homeActive}" href="${root}index.html" title="Home" aria-label="Home">
                    <span class="fa-solid fa-house nav-icon"></span>
                    <span class="nav-text">Home</span>
                  </a>
                </li>
                <li class="nav-item mr-lg-4">
                  <a class="nav-link pl-0 pr-0 ${botActive}" href="${root}bot/" title="Bot" aria-label="Bot">
                    <span class="fa-solid fa-robot nav-icon"></span>
                    <span class="nav-text">Bot</span>
                  </a>
                </li>
                <li class="nav-item mr-lg-4">
                  <a class="nav-link pl-0 pr-0 ${blogActive}" href="${root}blogs.html" title="Blogs" aria-label="Blogs">
                    <span class="fa-solid fa-newspaper nav-icon"></span>
                    <span class="nav-text">Blogs</span>
                  </a>
                </li>
                <li class="nav-item mr-lg-4">
                  <a class="nav-link pl-0 pr-0 ${vspActive}" href="${root}vsp.html" title="VSP 3D Lab" aria-label="VSP 3D Lab">
                    <span class="fa-solid fa-cube nav-icon"></span>
                    <span class="nav-text">3D Lab</span>
                  </a>
                </li>
              </ul>
            </div>
          </nav>
        </div>
      </div>
    `;

    // Resilient vanilla mobile toggle - immune to Bootstrap data-api interference
    const toggler = headerContainer.querySelector('.navbar-toggler');
    const collapseNav = headerContainer.querySelector('#navbarNav');
    if (toggler && collapseNav) {
      toggler.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const isOpen = collapseNav.classList.toggle('show');
        toggler.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        document.body.classList.toggle('noscroll', isOpen);
      });

      // Close menu when tapping outside header
      document.addEventListener('click', (e) => {
        if (collapseNav.classList.contains('show') && !headerContainer.contains(e.target)) {
          collapseNav.classList.remove('show');
          toggler.setAttribute('aria-expanded', 'false');
          document.body.classList.remove('noscroll');
        }
      });

      // Close menu when tapping any navigation link
      collapseNav.querySelectorAll('.nav-link').forEach((link) => {
        link.addEventListener('click', () => {
          collapseNav.classList.remove('show');
          toggler.setAttribute('aria-expanded', 'false');
          document.body.classList.remove('noscroll');
        });
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
                      <a href="https://huggingface.co/vishnusureshperumbavoor" target="_blank" aria-label="HuggingFace Profile" title="HuggingFace Profile">
                        <svg class="vsp-hf-icon" viewBox="0 0 24 24" width="16" height="16" fill="currentColor" style="vertical-align: -2px;" aria-hidden="true"><path d="M12.025 1.13c-5.77 0-10.449 4.647-10.449 10.378 0 1.112.178 2.181.503 3.185.064-.222.203-.444.416-.577a.96.96 0 0 1 .524-.15c.293 0 .584.124.84.284.278.173.48.408.71.694.226.282.458.611.684.951v-.014c.017-.324.106-.622.264-.874s.403-.487.762-.543c.3-.047.596.06.787.203s.31.313.4.467c.15.257.212.468.233.542.01.026.653 1.552 1.657 2.54.616.605 1.01 1.223 1.082 1.912.055.537-.096 1.059-.38 1.572.637.121 1.294.187 1.967.187.657 0 1.298-.063 1.921-.178-.287-.517-.44-1.041-.384-1.581.07-.69.465-1.307 1.081-1.913 1.004-.987 1.647-2.513 1.657-2.539.021-.074.083-.285.233-.542.09-.154.208-.323.4-.467a1.08 1.08 0 0 1 .787-.203c.359.056.604.29.762.543s.247.55.265.874v.015c.225-.34.457-.67.683-.952.23-.286.432-.52.71-.694.257-.16.547-.284.84-.285a.97.97 0 0 1 .524.151c.228.143.373.388.43.625l.006.04a10.3 10.3 0 0 0 .534-3.273c0-5.731-4.678-10.378-10.449-10.378M8.327 6.583a1.5 1.5 0 0 1 .713.174 1.487 1.487 0 0 1 .617 2.013c-.183.343-.762-.214-1.102-.094-.38.134-.532.914-.917.71a1.487 1.487 0 0 1 .69-2.803m7.486 0a1.487 1.487 0 0 1 .689 2.803c-.385.204-.536-.576-.916-.71-.34-.12-.92.437-1.103.094a1.487 1.487 0 0 1 .617-2.013 1.5 1.5 0 0 1 .713-.174m-10.68 1.55a.96.96 0 1 1 0 1.921.96.96 0 0 1 0-1.92m13.838 0a.96.96 0 1 1 0 1.92.96.96 0 0 1 0-1.92M8.489 11.458c.588.01 1.965 1.157 3.572 1.164 1.607-.007 2.984-1.155 3.572-1.164.196-.003.305.12.305.454 0 .886-.424 2.328-1.563 3.202-.22-.756-1.396-1.366-1.63-1.32q-.011.001-.02.006l-.044.026-.01.008-.03.024q-.018.017-.035.036l-.032.04a1 1 0 0 0-.058.09l-.014.025q-.049.088-.11.19a1 1 0 0 1-.083.116 1.2 1.2 0 0 1-.173.18q-.035.029-.075.058a1.3 1.3 0 0 1-.251-.243 1 1 0 0 1-.076-.107c-.124-.193-.177-.363-.337-.444-.034-.016-.104-.008-.2.022q-.094.03-.216.087-.06.028-.125.063l-.13.074q-.067.04-.136.086a3 3 0 0 0-.135.096 3 3 0 0 0-.26.219 2 2 0 0 0-.12.121 2 2 0 0 0-.106.128l-.002.002a2 2 0 0 0-.09.132l-.001.001a1.2 1.2 0 0 0-.105.212q-.013.036-.024.073c-1.139-.875-1.563-2.317-1.563-3.203 0-.334.109-.457.305-.454m.836 10.354c.824-1.19.766-2.082-.365-3.194-1.13-1.112-1.789-2.738-1.789-2.738s-.246-.945-.806-.858-.97 1.499.202 2.362c1.173.864-.233 1.45-.685.64-.45-.812-1.683-2.896-2.322-3.295s-1.089-.175-.938.647 2.822 2.813 2.562 3.244-1.176-.506-1.176-.506-2.866-2.567-3.49-1.898.473 1.23 2.037 2.16c1.564.932 1.686 1.178 1.464 1.53s-3.675-2.511-4-1.297c-.323 1.214 3.524 1.567 3.287 2.405-.238.839-2.71-1.587-3.216-.642-.506.946 3.49 2.056 3.522 2.064 1.29.33 4.568 1.028 5.713-.624m5.349 0c-.824-1.19-.766-2.082.365-3.194 1.13-1.112 1.789-2.738 1.789-2.738s.246-.945.806-.858.97 1.499-.202 2.362c-1.173.864.233 1.45.685.64.451-.812 1.683-2.896 2.322-3.295s1.089-.175.938.647-2.822 2.813-2.562 3.244 1.176-.506 1.176-.506 2.866-2.567 3.49-1.898-.473 1.23-2.037 2.16c-1.564.932-1.686 1.178-1.464 1.53s3.675-2.511 4-1.297c.323 1.214-3.524 1.567-3.287 2.405.238.839 2.71-1.587 3.216-.642.506.946 3.49 2.056 3.522 2.064 1.29.33 4.568 1.028 5.713-.624"/></svg>
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
