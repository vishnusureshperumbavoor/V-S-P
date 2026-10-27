/**
 * ============================================================================
 * VSP Common Topbar & Footer Component System
 * Single Source of Truth for Navigation & Footer across the entire portfolio
 * ============================================================================
 */

(function () {
  "use strict";

  function getRootPrefix() {
    const currentScript =
      document.currentScript ||
      document.querySelector('script[src*="nav-footer.js"]');
    if (currentScript) {
      const src = currentScript.getAttribute("src");
      if (src && src.startsWith("../")) {
        return "../";
      }
    }
    const path = window.location.pathname;
    if (
      path.includes("/blogs/") ||
      path.includes("/bot/") ||
      path.endsWith("/bot") ||
      path.includes("/bot/index.html")
    ) {
      return "../";
    }
    return "./";
  }

  function getActiveTab() {
    const path = window.location.pathname.toLowerCase();
    if (path.includes("songs") || path.includes("/songs")) {
      return "songs";
    }
    if (path.includes("blogs") || path.includes("/blogs/")) {
      return "blogs";
    }
    if (path.includes("bot")) {
      return "bot";
    }
    if (
      path.includes("3d-lab") ||
      path.includes("lab") ||
      path.includes("vsp")
    ) {
      return "3d-lab";
    }
    return "home";
  }

  function renderHeader() {
    const headerContainer =
      document.getElementById("vsp-header") || document.querySelector("header");
    if (!headerContainer) return;

    const root = getRootPrefix();
    const active = getActiveTab();

    const homeActive = active === "home" ? "active" : "";
    const botActive = active === "bot" ? "active" : "";
    const blogActive = active === "blogs" ? "active" : "";
    const labActive =
      active === "3d-lab" || active === "lab" || active === "vsp"
        ? "active"
        : "";
    const songsActive = active === "songs" ? "active" : "";

    const path = window.location.pathname.toLowerCase();
    const matchBlog = path.match(/blogs\/([^/?#]+)/);
    const blogFileName = matchBlog ? matchBlog[1].replace(/\.html$/, "") : "";
    const isReadingIndividualBlog = Boolean(
      blogFileName && blogFileName !== "index" && blogFileName !== "blogs",
    );

    const backButtonHtml = isReadingIndividualBlog
      ? `
      <a href="${root}blogs.html" class="vsp-nav-back-btn mr-2" title="Back to Blogs" aria-label="Back to Blogs">
        <i class="fa-solid fa-arrow-left"></i>
      </a>
    `
      : "";

    headerContainer.innerHTML = `
      <div class="w3l-header fixed-top" id="home">
        <div class="container">
          <nav class="navbar navbar-expand-lg navbar-dark pl-0 pr-0">
            <div class="d-flex align-items-center">
              ${backButtonHtml}
              <a class="navbar-brand m-0" href="${root}index.html">
                <span class="fa fa-gamepad brand-logo-icon" style="color: #00d679;"></span>
                <span class="brand-text" style="color: #00d679;">VSP</span>
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
                  <a class="nav-link pl-0 pr-0 ${labActive}" href="${root}3d-lab.html" title="3D Lab" aria-label="3D Lab">
                    <span class="fa-solid fa-cube nav-icon"></span>
                    <span class="nav-text">3D Lab</span>
                  </a>
                </li>
                <li class="nav-item mr-lg-4">
                  <a class="nav-link pl-0 pr-0 ${songsActive}" href="${root}songs.html" title="Songs" aria-label="Songs">
                    <span class="fa-solid fa-music nav-icon"></span>
                    <span class="nav-text">Songs</span>
                  </a>
                </li>
              </ul>
            </div>
          </nav>
        </div>
      </div>
    `;

    // Resilient vanilla mobile toggle - immune to Bootstrap data-api interference
    const toggler = headerContainer.querySelector(".navbar-toggler");
    const collapseNav = headerContainer.querySelector("#navbarNav");
    if (toggler && collapseNav) {
      toggler.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const isOpen = collapseNav.classList.toggle("show");
        toggler.setAttribute("aria-expanded", isOpen ? "true" : "false");
        document.body.classList.toggle("noscroll", isOpen);
      });

      // Close menu when tapping outside header
      document.addEventListener("click", (e) => {
        if (
          collapseNav.classList.contains("show") &&
          !headerContainer.contains(e.target)
        ) {
          collapseNav.classList.remove("show");
          toggler.setAttribute("aria-expanded", "false");
          document.body.classList.remove("noscroll");
        }
      });

      // Close menu when tapping any navigation link
      collapseNav.querySelectorAll(".nav-link").forEach((link) => {
        link.addEventListener("click", () => {
          collapseNav.classList.remove("show");
          toggler.setAttribute("aria-expanded", "false");
          document.body.classList.remove("noscroll");
        });
      });
    }
  }

  function renderFooter() {
    const footerContainer =
      document.getElementById("vsp-footer") || document.querySelector("footer");
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
                        <i class="fa-brands fa-hugging-face"></i>
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
                        <i class="fa-brands fa-square-x-twitter"></i>
                      </a>
                    </li>
                    <li>
                      <a href="https://www.youtube.com/@vishnusureshperumbavoor/videos" aria-label="YouTube Channel">
                        <span class="fa fa-youtube-square p-2"></span>
                      </a>
                    </li>
                    <li>
                      <a href="https://www.reddit.com/user/vishnuperumbavoor/" target="_blank" aria-label="Reddit Profile" title="Reddit Profile">
                        <i class="fa-brands fa-reddit-alien"></i>
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
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      renderHeader();
      renderFooter();
    });
  } else {
    renderHeader();
    renderFooter();
  }
})();
