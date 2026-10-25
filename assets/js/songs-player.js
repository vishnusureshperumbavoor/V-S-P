/**
 * Music Web Player Engine for VSP Portfolio
 * Handles real-time HTML5 audio playback, canvas visualizer, playlist management,
 * scrubbing, volume control, like state, and keyboard shortcuts.
 */

(function () {
  "use strict";

  // Master Playlist Definition
  const TRACKS = [
    {
      id: 0,
      title: "No Crown Given",
      artist: "Vishnu Suresh Perumbavoor (VSP)",
      genre: "Self Mass",
      album: "Self Mass",
      dateAdded: "Oct 2026",
      duration: 179,
      durationStr: "2:59",
      src: "assets/songs/no_crown_given - 05 AI cover song.mp3",
      cover: "assets/images/cover_no_crown_given.jpg",
      badge: "Banger",
    },
    {
      id: 1,
      title: "I'm Running This Shit",
      artist: "Vishnu Suresh Perumbavoor (VSP)",
      genre: "Self Mass",
      album: "Self Mass",
      dateAdded: "Oct 2026",
      duration: 121,
      durationStr: "2:01",
      src: "assets/songs/im_running_this_shit - 05 AI cover song.mp3",
      cover: "assets/images/cover_running_this.jpg",
      badge: "Hype",
    },
  ];

  // State
  let currentTrackIdx = 0;
  let isPlaying = false;
  let isShuffle = false;
  let repeatMode = 1; // 0: off, 1: all, 2: one (default: loop all songs)
  let currentVolume = 0.85;
  let isMuted = false;
  let isDraggingProgress = false;
  let isDraggingVolume = false;
  let audioCtx = null;
  let analyser = null;
  let audioSource = null;
  let animFrameId = null;

  // Core Audio Element
  const audio = new Audio();
  audio.preload = "metadata";
  audio.volume = currentVolume;

  // DOM Elements Cache
  let dom = {};

  function initDOMElements() {
    dom = {
      // Views & Navigation
      albumView: document.getElementById("sp-album-view"),
      singleView: document.getElementById("sp-single-view"),
      sidebarAlbumItem: document.getElementById("sp-sidebar-album-item"),
      singleBackBtn: document.getElementById("sp-single-back-btn"),
      btnViewAllSongs: document.getElementById("sp-btn-view-all-songs"),
      // Single Track View elements
      singleHero: document.getElementById("sp-single-hero"),
      singleCoverWrap: document.getElementById("sp-single-cover-wrap"),
      singleCover: document.getElementById("sp-single-cover"),
      singleCoverPlay: document.getElementById("sp-single-cover-play"),
      singleCoverIcon: document.getElementById("sp-single-cover-icon"),
      singleBadge: document.getElementById("sp-single-badge"),
      singleTitle: document.getElementById("sp-single-title"),
      singleSubtitle: document.getElementById("sp-single-subtitle"),
      singleAlbum: document.getElementById("sp-single-album"),
      singleYear: document.getElementById("sp-single-year"),
      singleDuration: document.getElementById("sp-single-duration"),
      singleGenre: document.getElementById("sp-single-genre"),
      singlePlayBtn: document.getElementById("sp-single-play-btn"),
      singlePlayIcon: document.getElementById("sp-single-play-icon"),
      singleLikeBtn: document.getElementById("sp-single-like-btn"),
      singleLikeIcon: document.getElementById("sp-single-like-icon"),
      singleShareBtn: document.getElementById("sp-single-share-btn"),
      singleRepeatBtn: document.getElementById("sp-single-repeat-btn"),
      singleCardTrack: document.getElementById("sp-single-card-track"),
      singleCanvas: document.getElementById("sp-single-canvas"),
      singleScrubberBar: document.getElementById("sp-single-scrubber-bar"),
      singleScrubberFill: document.getElementById("sp-single-scrubber-fill"),
      singleScrubberThumb: document.getElementById("sp-single-scrubber-thumb"),
      singleTimeCur: document.getElementById("sp-single-time-cur"),
      singleTimeTotal: document.getElementById("sp-single-time-total"),
      singleOtherTracks: document.getElementById("sp-single-other-tracks"),
      // Table rows
      tableBody: document.getElementById("sp-table-body"),
      // Hero elements
      heroPlayBtn: document.getElementById("sp-hero-play-btn"),
      heroPlayIcon: document.getElementById("sp-hero-play-icon"),
      heroCover: document.getElementById("sp-hero-cover"),
      heroTitle: document.getElementById("sp-hero-title"),
      // Player Bar elements
      barThumb: document.getElementById("sp-bar-thumb"),
      barTitle: document.getElementById("sp-bar-title"),
      barArtist: document.getElementById("sp-bar-artist"),
      barShareBtn: document.getElementById("sp-bar-share-btn"),
      // Controls
      btnPlayPause: document.getElementById("sp-btn-playpause"),
      playPauseIcon: document.getElementById("sp-playpause-icon"),
      btnPrev: document.getElementById("sp-btn-prev"),
      btnNext: document.getElementById("sp-btn-next"),
      btnShuffle: document.getElementById("sp-btn-shuffle"),
      btnRepeat: document.getElementById("sp-btn-repeat"),
      heroRepeatBtn: document.getElementById("sp-hero-repeat-btn"),
      heroShareArtistBtn: document.getElementById("sp-hero-share-artist-btn"),
      // Mobile controls
      btnMobPlayPause: document.getElementById("sp-btn-mob-playpause"),
      mobPlayIcon: document.getElementById("sp-mob-play-icon"),
      btnMobNext: document.getElementById("sp-btn-mob-next"),
      // Progress Slider
      sliderWrap: document.getElementById("sp-slider-wrap"),
      sliderFill: document.getElementById("sp-slider-fill"),
      sliderThumb: document.getElementById("sp-slider-thumb"),
      currentTimeLabel: document.getElementById("sp-time-current"),
      totalTimeLabel: document.getElementById("sp-time-total"),
      // Volume Slider
      btnMute: document.getElementById("sp-btn-mute"),
      muteIcon: document.getElementById("sp-mute-icon"),
      volWrap: document.getElementById("sp-vol-wrap"),
      volFill: document.getElementById("sp-vol-fill"),
      volThumb: document.getElementById("sp-vol-thumb"),
      // Canvas Visualizer
      canvas: document.getElementById("sp-audio-canvas"),
      btnToggleViz: document.getElementById("sp-btn-toggleviz"),
      // Fullscreen Modal
      fsModal: document.getElementById("sp-fullscreen-modal"),
      btnOpenFs: document.getElementById("sp-btn-openfs"),
      btnCloseFs: document.getElementById("sp-btn-closefs"),
      fsCover: document.getElementById("sp-fs-cover"),
      fsTitle: document.getElementById("sp-fs-title"),
      fsArtist: document.getElementById("sp-fs-artist"),
      // Toast
      toast: document.getElementById("sp-toast"),
    };
  }

  // Format seconds to mm:ss
  function formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  }

  // Show Toast Notification
  function showToast(msg) {
    if (!dom.toast) return;
    dom.toast.textContent = msg;
    dom.toast.classList.add("show");
    clearTimeout(dom.toast._timer);
    dom.toast._timer = setTimeout(() => {
      dom.toast.classList.remove("show");
    }, 2400);
  }
  window.vspShowToast = showToast;

  let autoplayPending = false;

  function unlockAudio() {
    autoplayPending = false;
    initAudioContext();
    if (audioCtx && audioCtx.state === "suspended") {
      audioCtx.resume().catch(() => {});
    }
    playAudio();
    window.removeEventListener("click", unlockAudio, true);
    window.removeEventListener("touchstart", unlockAudio, true);
    window.removeEventListener("keydown", unlockAudio, true);
  }

  // Update Single Track View with track data
  function updateSingleView(index) {
    if (index < 0 || index >= TRACKS.length) return;
    const track = TRACKS[index];

    if (dom.singleCover) dom.singleCover.src = track.cover;
    if (dom.singleTitle) dom.singleTitle.textContent = track.title;
    if (dom.singleDuration) dom.singleDuration.textContent = track.durationStr;
    if (dom.singleGenre) dom.singleGenre.textContent = track.genre;
    if (dom.singleBadge) dom.singleBadge.textContent = track.badge || "Single";
    if (dom.singleCardTrack) dom.singleCardTrack.textContent = track.title;
    if (dom.singleTimeTotal) dom.singleTimeTotal.textContent = track.durationStr;
    if (dom.singleTimeCur) dom.singleTimeCur.textContent = "0:00";
    if (dom.singleScrubberFill) dom.singleScrubberFill.style.width = "0%";
    if (dom.singleScrubberThumb) dom.singleScrubberThumb.style.left = "0%";

    // Dynamic ambient background for single hero
    if (dom.singleHero) {
      const isAlt = index % 2 === 1;
      const glowColor = isAlt ? "rgba(236, 72, 153, 0.28)" : "rgba(30, 215, 96, 0.28)";
      dom.singleHero.style.background = `linear-gradient(180deg, ${glowColor} 0%, rgba(18, 18, 18, 0.9) 75%, var(--sp-dark-base) 100%)`;
    }

    renderSingleOtherTracks(index);
  }

  // Render "More by Artist" tracklist in single view
  function renderSingleOtherTracks(currentIdx) {
    if (!dom.singleOtherTracks) return;
    dom.singleOtherTracks.innerHTML = "";

    TRACKS.forEach((track, i) => {
      const isCurrent = i === currentIdx;
      const item = document.createElement("div");
      item.className = `sp-single-track-item ${isCurrent ? "active" : ""}`;
      item.setAttribute("data-track-idx", i);

      const playIconOrNum = isCurrent && isPlaying
        ? '<i class="fa-solid fa-volume-high" style="color: var(--sp-green);"></i>'
        : (i + 1);

      item.innerHTML = `
        <span class="sp-sti-index">${playIconOrNum}</span>
        <img src="${track.cover}" alt="${track.title}" class="sp-sti-cover" />
        <div class="sp-sti-info">
          <p class="sp-sti-title">${track.title}</p>
          <p class="sp-sti-artist">VSP &bull; ${track.genre}</p>
        </div>
        <span class="sp-sti-duration">${track.durationStr}</span>
        <button class="sp-sti-action-btn" title="Share" data-share-idx="${i}">
          <i class="fa-solid fa-share-nodes"></i>
        </button>
      `;

      item.addEventListener("click", (e) => {
        if (e.target.closest(".sp-sti-action-btn")) return;
        loadTrack(i, true);
        showSingleView(i, true);
      });

      const shareBtn = item.querySelector(".sp-sti-action-btn");
      if (shareBtn) {
        shareBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          shareTrack(i);
        });
      }

      dom.singleOtherTracks.appendChild(item);
    });
  }

  function updateSingleOtherTracksPlaying() {
    if (!dom.singleOtherTracks) return;
    const items = dom.singleOtherTracks.querySelectorAll(".sp-single-track-item");
    items.forEach((item) => {
      const idx = parseInt(item.getAttribute("data-track-idx"), 10);
      const isCurrent = idx === currentTrackIdx;
      item.classList.toggle("active", isCurrent);
      const indexSpan = item.querySelector(".sp-sti-index");
      if (indexSpan) {
        if (isCurrent && isPlaying) {
          indexSpan.innerHTML = '<i class="fa-solid fa-volume-high" style="color: var(--sp-green);"></i>';
        } else {
          indexSpan.textContent = idx + 1;
        }
      }
    });
  }

  // Switch to Individual Track View
  function showSingleView(trackId, pushHistory = true) {
    if (trackId !== undefined && trackId !== null && trackId >= 0 && trackId < TRACKS.length) {
      if (trackId !== currentTrackIdx) {
        loadTrack(trackId, isPlaying);
      } else {
        updateSingleView(trackId);
      }
    }
    if (dom.albumView) dom.albumView.style.display = "none";
    if (dom.singleView) dom.singleView.style.display = "block";

    const mainView = document.querySelector(".sp-main-view");
    if (mainView) mainView.scrollTop = 0;

    if (pushHistory) {
      const url = `songs.html?track=${currentTrackIdx}`;
      window.history.pushState({ view: "single", track: currentTrackIdx }, "", url);
    }

    if (dom.sidebarAlbumItem) {
      dom.sidebarAlbumItem.classList.remove("active");
    }
    document.querySelectorAll(".sp-sidebar-track-item").forEach((item) => {
      const id = parseInt(item.getAttribute("data-track-id"), 10);
      item.classList.toggle("active", id === currentTrackIdx);
    });
  }
  window.vspShowSingleTrack = showSingleView;

  // Switch to Collection / Album View
  function showAlbumView(pushHistory = true) {
    if (dom.singleView) dom.singleView.style.display = "none";
    if (dom.albumView) dom.albumView.style.display = "block";

    const mainView = document.querySelector(".sp-main-view");
    if (mainView) mainView.scrollTop = 0;

    if (pushHistory) {
      window.history.pushState({ view: "album" }, "", "songs.html");
    }

    if (dom.sidebarAlbumItem) {
      dom.sidebarAlbumItem.classList.add("active");
    }
    document.querySelectorAll(".sp-sidebar-track-item").forEach((item) => {
      item.classList.remove("active");
    });
  }
  window.vspShowAlbumView = showAlbumView;

  // Load a track into the player
  function loadTrack(index, autoplay = false) {
    if (index < 0 || index >= TRACKS.length) return;
    currentTrackIdx = index;
    const track = TRACKS[currentTrackIdx];

    // Encode URI for safe loading with spaces
    const safeSrc = encodeURI(track.src);
    audio.src = safeSrc;
    audio.load();

    // Update Bottom Bar
    if (dom.barThumb) dom.barThumb.src = track.cover;
    if (dom.barTitle) dom.barTitle.textContent = track.title;
    if (dom.barArtist) dom.barArtist.textContent = track.artist;
    if (dom.totalTimeLabel) dom.totalTimeLabel.textContent = track.durationStr;
    if (dom.currentTimeLabel) dom.currentTimeLabel.textContent = "0:00";

    // Update Fullscreen view
    if (dom.fsCover) dom.fsCover.src = track.cover;
    if (dom.fsTitle) dom.fsTitle.textContent = track.title;
    if (dom.fsArtist) dom.fsArtist.textContent = track.artist;

    // Reset Progress Bar
    if (dom.sliderFill) dom.sliderFill.style.width = "0%";
    if (dom.sliderThumb) dom.sliderThumb.style.left = "0%";

    // Update Single Track View
    updateSingleView(currentTrackIdx);

    // Update Active Row in Table
    updateTableActiveRow();

    if (autoplay) {
      autoplayPending = true;
      window.addEventListener("click", unlockAudio, true);
      window.addEventListener("touchstart", unlockAudio, true);
      window.addEventListener("keydown", unlockAudio, true);
      playAudio();
    }
  }

  // Play audio
  function playAudio() {
    initAudioContext();
    if (audioCtx && audioCtx.state === "suspended") {
      audioCtx.resume().catch(() => {});
    }
    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          isPlaying = true;
          autoplayPending = false;
          updatePlayPauseUI(true);
          startVisualizer();
        })
        .catch((err) => {
          console.warn(
            "Audio playback prevented or waiting for user gesture:",
            err,
          );
          isPlaying = false;
          updatePlayPauseUI(false);
        });
    }
  }

  // Pause audio
  function pauseAudio() {
    audio.pause();
    isPlaying = false;
    updatePlayPauseUI(false);
  }

  // Toggle Play / Pause
  function togglePlayPause() {
    if (isPlaying) {
      pauseAudio();
    } else {
      playAudio();
    }
  }

  // Update Play/Pause UI across table, action bar, bottom bar, and single track view
  function updatePlayPauseUI(playing) {
    const playIconClass = playing ? "fa-solid fa-pause" : "fa-solid fa-play";

    // Bottom bar main button
    if (dom.playPauseIcon) {
      dom.playPauseIcon.className = playIconClass;
    }
    // Mobile bottom bar button
    if (dom.mobPlayIcon) {
      dom.mobPlayIcon.className = playIconClass;
    }
    // Hero big button
    if (dom.heroPlayIcon) {
      dom.heroPlayIcon.className = playIconClass;
    }
    // Single track view play button
    if (dom.singlePlayIcon) {
      dom.singlePlayIcon.className = playIconClass;
    }
    // Single track cover overlay icon
    if (dom.singleCoverIcon) {
      dom.singleCoverIcon.className = playIconClass;
    }
    if (dom.singleCoverWrap) {
      dom.singleCoverWrap.classList.toggle("is-playing", playing);
    }

    // Update visual table rows
    updateTableActiveRow();
    // Update tracklist in single view
    updateSingleOtherTracksPlaying();
  }

  // Update Table active row styling & equalizer bars
  function updateTableActiveRow() {
    const rows = document.querySelectorAll(".sp-row");
    rows.forEach((row) => {
      const rowId = parseInt(row.getAttribute("data-track-id"), 10);
      if (rowId === currentTrackIdx) {
        if (isPlaying) {
          row.classList.add("playing");
        } else {
          row.classList.remove("playing");
        }
        row.style.background = isPlaying
          ? "rgba(30, 215, 96, 0.14)"
          : "rgba(255, 255, 255, 0.05)";
      } else {
        row.classList.remove("playing");
        row.style.background = "";
      }
    });
  }

  // Next Track
  function nextTrack() {
    if (isShuffle) {
      let nextIdx;
      do {
        nextIdx = Math.floor(Math.random() * TRACKS.length);
      } while (nextIdx === currentTrackIdx && TRACKS.length > 1);
      loadTrack(nextIdx, true);
    } else {
      let nextIdx = currentTrackIdx + 1;
      if (nextIdx >= TRACKS.length) {
        nextIdx = 0;
      }
      loadTrack(nextIdx, true);
    }
  }

  // Previous Track
  function prevTrack() {
    // If more than 3 seconds in, seek to beginning
    if (audio.currentTime > 3) {
      audio.currentTime = 0;
      return;
    }
    let prevIdx = currentTrackIdx - 1;
    if (prevIdx < 0) {
      prevIdx = TRACKS.length - 1;
    }
    loadTrack(prevIdx, true);
  }

  // Shuffle toggle
  function toggleShuffle() {
    isShuffle = !isShuffle;
    if (dom.btnShuffle) {
      dom.btnShuffle.classList.toggle("active", isShuffle);
    }
    showToast(isShuffle ? "Shuffle is ON" : "Shuffle is OFF");
  }

  // Repeat toggle
  function toggleRepeat(showNotification = true) {
    repeatMode = (repeatMode + 1) % 3;
    updateRepeatUI();
    if (showNotification) {
      const msgs = [
        "Repeat is OFF",
        "Repeat All Songs",
        "Repeat Current Track",
      ];
      showToast(msgs[repeatMode]);
    }
  }

  function updateRepeatUI() {
    const isRepeatActive = repeatMode > 0;
    const titles = [
      "Repeat Off",
      "Repeat All Songs (Active)",
      "Repeat Current Track (Active)",
    ];
    const title = titles[repeatMode] || "Repeat";

    if (dom.btnRepeat) {
      dom.btnRepeat.classList.toggle("active", isRepeatActive);
      dom.btnRepeat.setAttribute("title", title);
      dom.btnRepeat.setAttribute("aria-label", title);
      const icon = dom.btnRepeat.querySelector("i");
      if (icon) {
        icon.className = "fa-solid fa-repeat";
      }
    }

    if (dom.heroRepeatBtn) {
      dom.heroRepeatBtn.classList.toggle("active", isRepeatActive);
      dom.heroRepeatBtn.setAttribute("title", title);
      dom.heroRepeatBtn.setAttribute("aria-label", title);
    }
  }

  // Track ended event
  audio.addEventListener("ended", () => {
    if (repeatMode === 2) {
      audio.currentTime = 0;
      playAudio();
    } else if (
      repeatMode === 1 ||
      currentTrackIdx < TRACKS.length - 1 ||
      isShuffle
    ) {
      nextTrack();
    } else {
      pauseAudio();
      audio.currentTime = 0;
    }
  });

  // Time update event
  audio.addEventListener("timeupdate", () => {
    if (!isDraggingProgress && audio.duration) {
      const current = audio.currentTime;
      const total = audio.duration;
      const pct = (current / total) * 100;

      if (dom.sliderFill) dom.sliderFill.style.width = `${pct}%`;
      if (dom.sliderThumb) dom.sliderThumb.style.left = `${pct}%`;
      if (dom.currentTimeLabel)
        dom.currentTimeLabel.textContent = formatTime(current);

      // Single View Scrubber
      if (dom.singleScrubberFill) dom.singleScrubberFill.style.width = `${pct}%`;
      if (dom.singleScrubberThumb) dom.singleScrubberThumb.style.left = `${pct}%`;
      if (dom.singleTimeCur)
        dom.singleTimeCur.textContent = formatTime(current);
    }
  });

  // Duration change / metadata loaded
  audio.addEventListener("loadedmetadata", () => {
    if (dom.totalTimeLabel && audio.duration) {
      dom.totalTimeLabel.textContent = formatTime(audio.duration);
    }
    if (dom.singleTimeTotal && audio.duration) {
      dom.singleTimeTotal.textContent = formatTime(audio.duration);
    }
  });

  // Progress Bar Seek Controls
  function setupProgressBar() {
    if (!dom.sliderWrap) return;

    function seekAt(e) {
      const rect = dom.sliderWrap.getBoundingClientRect();
      const pos = Math.max(
        0,
        Math.min(1, (e.clientX - rect.left) / rect.width),
      );
      if (audio.duration) {
        audio.currentTime = pos * audio.duration;
        const pct = pos * 100;
        if (dom.sliderFill) dom.sliderFill.style.width = `${pct}%`;
        if (dom.sliderThumb) dom.sliderThumb.style.left = `${pct}%`;
        if (dom.currentTimeLabel)
          dom.currentTimeLabel.textContent = formatTime(audio.currentTime);

        if (dom.singleScrubberFill) dom.singleScrubberFill.style.width = `${pct}%`;
        if (dom.singleScrubberThumb) dom.singleScrubberThumb.style.left = `${pct}%`;
        if (dom.singleTimeCur)
          dom.singleTimeCur.textContent = formatTime(audio.currentTime);
      }
    }

    dom.sliderWrap.addEventListener("mousedown", (e) => {
      isDraggingProgress = true;
      seekAt(e);
      const onMouseMove = (ev) => seekAt(ev);
      const onMouseUp = () => {
        isDraggingProgress = false;
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
      };
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    });

    // Touch support for mobile
    dom.sliderWrap.addEventListener("touchstart", (e) => {
      isDraggingProgress = true;
      const touch = e.touches[0];
      seekAt(touch);
      const onTouchMove = (ev) => seekAt(ev.touches[0]);
      const onTouchEnd = () => {
        isDraggingProgress = false;
        document.removeEventListener("touchmove", onTouchMove);
        document.removeEventListener("touchend", onTouchEnd);
      };
      document.addEventListener("touchmove", onTouchMove, { passive: true });
      document.addEventListener("touchend", onTouchEnd);
    });
  }

  // Setup Scrubber for In-View Single Track Player Card
  function setupSingleScrubber() {
    if (!dom.singleScrubberBar) return;

    function seekAt(e) {
      const rect = dom.singleScrubberBar.getBoundingClientRect();
      const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      if (audio.duration) {
        audio.currentTime = pos * audio.duration;
        const pct = pos * 100;
        if (dom.singleScrubberFill) dom.singleScrubberFill.style.width = `${pct}%`;
        if (dom.singleScrubberThumb) dom.singleScrubberThumb.style.left = `${pct}%`;
        if (dom.singleTimeCur) dom.singleTimeCur.textContent = formatTime(audio.currentTime);
        if (dom.sliderFill) dom.sliderFill.style.width = `${pct}%`;
        if (dom.sliderThumb) dom.sliderThumb.style.left = `${pct}%`;
        if (dom.currentTimeLabel) dom.currentTimeLabel.textContent = formatTime(audio.currentTime);
      }
    }

    dom.singleScrubberBar.addEventListener("mousedown", (e) => {
      isDraggingProgress = true;
      seekAt(e);
      const onMouseMove = (ev) => seekAt(ev);
      const onMouseUp = () => {
        isDraggingProgress = false;
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
      };
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    });

    dom.singleScrubberBar.addEventListener("touchstart", (e) => {
      isDraggingProgress = true;
      seekAt(e.touches[0]);
      const onTouchMove = (ev) => seekAt(ev.touches[0]);
      const onTouchEnd = () => {
        isDraggingProgress = false;
        document.removeEventListener("touchmove", onTouchMove);
        document.removeEventListener("touchend", onTouchEnd);
      };
      document.addEventListener("touchmove", onTouchMove, { passive: true });
      document.addEventListener("touchend", onTouchEnd);
    }, { passive: true });
  }

  // Volume Controls
  function setVolume(val) {
    currentVolume = Math.max(0, Math.min(1, val));
    audio.volume = currentVolume;
    isMuted = currentVolume === 0;

    if (dom.volFill) dom.volFill.style.width = `${currentVolume * 100}%`;
    if (dom.volThumb) dom.volThumb.style.left = `${currentVolume * 100}%`;

    // Update volume icon
    if (dom.muteIcon) {
      if (isMuted || currentVolume === 0) {
        dom.muteIcon.className = "fa-solid fa-volume-xmark";
      } else if (currentVolume < 0.5) {
        dom.muteIcon.className = "fa-solid fa-volume-low";
      } else {
        dom.muteIcon.className = "fa-solid fa-volume-high";
      }
    }
  }

  function setupVolumeBar() {
    if (!dom.volWrap) return;

    function volAt(e) {
      const rect = dom.volWrap.getBoundingClientRect();
      const pos = Math.max(
        0,
        Math.min(1, (e.clientX - rect.left) / rect.width),
      );
      setVolume(pos);
    }

    dom.volWrap.addEventListener("mousedown", (e) => {
      isDraggingVolume = true;
      volAt(e);
      const onMouseMove = (ev) => volAt(ev);
      const onMouseUp = () => {
        isDraggingVolume = false;
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
      };
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    });

    // Mute button toggle
    if (dom.btnMute) {
      let prevVol = 0.85;
      dom.btnMute.addEventListener("click", () => {
        if (!isMuted && currentVolume > 0) {
          prevVol = currentVolume;
          setVolume(0);
          showToast("Muted");
        } else {
          setVolume(prevVol || 0.85);
          showToast(`Volume: ${Math.round(currentVolume * 100)}%`);
        }
      });
    }

    // Initialize volume
    setVolume(currentVolume);
  }

  // Share Track Function
  function shareTrack(trackId) {
    if (trackId < 0 || trackId >= TRACKS.length) return;
    const track = TRACKS[trackId];
    const origin = window.location.origin;
    const path = window.location.pathname.substring(
      0,
      window.location.pathname.lastIndexOf("/") + 1,
    );
    const shareUrl = `${origin}${path}songs.html?track=${trackId}`;

    const shareData = {
      title: `${track.title} - VSP`,
      text: `Listen to "${track.title}" (${track.genre}) by VSP`,
      url: shareUrl,
    };

    if (
      navigator.share &&
      navigator.canShare &&
      navigator.canShare(shareData)
    ) {
      navigator.share(shareData).catch((err) => {
        if (err.name !== "AbortError") {
          copyToClipboard(shareUrl);
        }
      });
    } else {
      copyToClipboard(shareUrl);
    }
  }

  // Share Artist Function
  function shareArtist() {
    const origin = window.location.origin;
    const path = window.location.pathname.substring(
      0,
      window.location.pathname.lastIndexOf("/") + 1,
    );
    const shareUrl = `${origin}${path}songs.html`;

    const shareData = {
      title: "VSP - Songs & Covers",
      text: "Listen to cover songs and beats by VSP",
      url: shareUrl,
    };

    if (
      navigator.share &&
      navigator.canShare &&
      navigator.canShare(shareData)
    ) {
      navigator.share(shareData).catch((err) => {
        if (err.name !== "AbortError") {
          copyToClipboard(shareUrl);
        }
      });
    } else {
      copyToClipboard(shareUrl);
    }
  }

  function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard
        .writeText(text)
        .then(() => {
          showToast("Link copied to clipboard!");
        })
        .catch(() => {
          fallbackCopy(text);
        });
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    const input = document.createElement("input");
    input.value = text;
    document.body.appendChild(input);
    input.select();
    try {
      document.execCommand("copy");
      showToast("Link copied to clipboard!");
    } catch (e) {
      showToast("Could not copy link");
    }
    document.body.removeChild(input);
  }

  window.vspShareTrack = shareTrack;

  // Web Audio API Visualizer
  function initAudioContext() {
    if (audioCtx) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      audioCtx = new AudioContext();
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      analyser.smoothingTimeConstant = 0.8;

      // Attempt to connect audio source
      try {
        audioSource = audioCtx.createMediaElementSource(audio);
        audioSource.connect(analyser);
        analyser.connect(audioCtx.destination);
      } catch (e) {
        // Source already connected or cross-origin
      }
    } catch (e) {
      console.warn("Web Audio API unavailable:", e);
    }
  }

  function startVisualizer() {
    const bufferLength = analyser ? analyser.frequencyBinCount : 32;
    const dataArray = new Uint8Array(bufferLength);

    function drawOnCanvas(canvasEl) {
      if (!canvasEl || canvasEl.offsetParent === null) return;
      const ctx = canvasEl.getContext("2d");
      const width = canvasEl.width;
      const height = canvasEl.height;
      ctx.clearRect(0, 0, width, height);

      const barWidth = (width / bufferLength) * 0.75;
      const barGap = (width / bufferLength) * 0.25;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * (height * 0.9) + 4;
        const grad = ctx.createLinearGradient(0, height - barHeight, 0, height);
        grad.addColorStop(0, "#1ed760");
        grad.addColorStop(0.7, "#1db954");
        grad.addColorStop(1, "#0e5c2b");

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.roundRect(x, height - barHeight, barWidth, barHeight, [3, 3, 0, 0]);
        ctx.fill();

        x += barWidth + barGap;
      }
    }

    function renderFrame() {
      animFrameId = requestAnimationFrame(renderFrame);

      if (analyser && isPlaying) {
        analyser.getByteFrequencyData(dataArray);
      } else if (isPlaying) {
        // Procedural rhythmic fallback wave
        const time = Date.now() * 0.005;
        for (let i = 0; i < bufferLength; i++) {
          dataArray[i] = Math.floor(
            60 +
              50 * Math.sin(time + i * 0.4) +
              40 * Math.cos(time * 0.7 + i * 0.2),
          );
        }
      } else {
        // Idle standby baseline
        for (let i = 0; i < bufferLength; i++) {
          dataArray[i] = 12;
        }
      }

      drawOnCanvas(dom.canvas);
      drawOnCanvas(dom.singleCanvas);
    }

    if (!animFrameId) {
      renderFrame();
    }
  }

  // Keyboard Shortcuts
  function setupKeyboardShortcuts() {
    window.addEventListener("keydown", (e) => {
      // Ignore if user is focused on an input or textarea
      if (["INPUT", "TEXTAREA"].includes(document.activeElement.tagName))
        return;

      switch (e.code) {
        case "Space":
          e.preventDefault();
          togglePlayPause();
          break;
        case "ArrowRight":
          e.preventDefault();
          if (audio.duration) {
            audio.currentTime = Math.min(audio.duration, audio.currentTime + 5);
            showToast(`+5s (${formatTime(audio.currentTime)})`);
          }
          break;
        case "ArrowLeft":
          e.preventDefault();
          audio.currentTime = Math.max(0, audio.currentTime - 5);
          showToast(`-5s (${formatTime(audio.currentTime)})`);
          break;
        case "ArrowUp":
          e.preventDefault();
          setVolume(Math.min(1, currentVolume + 0.1));
          showToast(`Volume: ${Math.round(currentVolume * 100)}%`);
          break;
        case "ArrowDown":
          e.preventDefault();
          setVolume(Math.max(0, currentVolume - 0.1));
          showToast(`Volume: ${Math.round(currentVolume * 100)}%`);
          break;
        case "KeyM":
          if (dom.btnMute) dom.btnMute.click();
          break;
        case "KeyN":
          nextTrack();
          break;
        case "KeyP":
          prevTrack();
          break;
      }
    });
  }

  // URL Parameter auto-selection
  function checkUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const trackParam = params.get("track");

    if (trackParam !== null) {
      const idx = parseInt(trackParam, 10);
      if (!isNaN(idx) && idx >= 0 && idx < TRACKS.length) {
        currentTrackIdx = idx;
        loadTrack(currentTrackIdx, false);
        showSingleView(currentTrackIdx, false);
        return;
      }
    }

    loadTrack(0, false);
    showAlbumView(false);
  }

  // Fullscreen Modal setup
  function setupFullscreenModal() {
    if (dom.btnOpenFs && dom.fsModal) {
      dom.btnOpenFs.addEventListener("click", () => {
        dom.fsModal.classList.add("active");
      });
    }
    if (dom.btnCloseFs && dom.fsModal) {
      dom.btnCloseFs.addEventListener("click", () => {
        dom.fsModal.classList.remove("active");
      });
    }
  }

  // Bind all event listeners
  function bindEvents() {
    // Single View Navigation Buttons
    if (dom.singleBackBtn) {
      dom.singleBackBtn.addEventListener("click", () => showAlbumView(true));
    }
    if (dom.btnViewAllSongs) {
      dom.btnViewAllSongs.addEventListener("click", () => showAlbumView(true));
    }

    // Single View Play Controls
    if (dom.singlePlayBtn) {
      dom.singlePlayBtn.addEventListener("click", togglePlayPause);
    }
    if (dom.singleCoverPlay) {
      dom.singleCoverPlay.addEventListener("click", togglePlayPause);
    }

    // Single View Like Button
    if (dom.singleLikeBtn) {
      dom.singleLikeBtn.addEventListener("click", () => {
        dom.singleLikeBtn.classList.toggle("liked");
        const isLiked = dom.singleLikeBtn.classList.contains("liked");
        if (dom.singleLikeIcon) {
          dom.singleLikeIcon.className = isLiked ? "fa-solid fa-heart" : "fa-regular fa-heart";
        }
        showToast(isLiked ? "Saved to your Liked Songs" : "Removed from Liked Songs");
      });
    }

    // Single View Share Button
    if (dom.singleShareBtn) {
      dom.singleShareBtn.addEventListener("click", () => {
        shareTrack(currentTrackIdx);
      });
    }

    // Single View Repeat Button
    if (dom.singleRepeatBtn) {
      dom.singleRepeatBtn.addEventListener("click", () => {
        toggleRepeat();
      });
    }

    // Sidebar items
    if (dom.sidebarAlbumItem) {
      dom.sidebarAlbumItem.addEventListener("click", () => {
        showAlbumView(true);
      });
    }
    const sidebarTracks = document.querySelectorAll(".sp-sidebar-track-item");
    sidebarTracks.forEach((item) => {
      item.addEventListener("click", () => {
        const id = parseInt(item.getAttribute("data-track-id"), 10);
        if (!isNaN(id)) {
          loadTrack(id, true);
          showSingleView(id, true);
        }
      });
    });

    // Hero big play button
    if (dom.heroPlayBtn) {
      dom.heroPlayBtn.addEventListener("click", togglePlayPause);
    }

    // Bottom bar play/pause
    if (dom.btnPlayPause) {
      dom.btnPlayPause.addEventListener("click", togglePlayPause);
    }
    // Mobile play/pause
    if (dom.btnMobPlayPause) {
      dom.btnMobPlayPause.addEventListener("click", togglePlayPause);
    }

    // Prev / Next
    if (dom.btnPrev) dom.btnPrev.addEventListener("click", prevTrack);
    if (dom.btnNext) dom.btnNext.addEventListener("click", nextTrack);
    if (dom.btnMobNext) dom.btnMobNext.addEventListener("click", nextTrack);

    // Shuffle & Repeat
    if (dom.btnShuffle) dom.btnShuffle.addEventListener("click", toggleShuffle);
    if (dom.btnRepeat) dom.btnRepeat.addEventListener("click", toggleRepeat);

    // Hero share artist
    if (dom.heroShareArtistBtn) {
      dom.heroShareArtistBtn.addEventListener("click", shareArtist);
    }

    // Bottom bar share
    if (dom.barShareBtn) {
      dom.barShareBtn.addEventListener("click", () => {
        shareTrack(currentTrackIdx);
      });
    }

    // Bottom bar thumbnail & title click to open single view
    if (dom.barThumb) {
      dom.barThumb.style.cursor = "pointer";
      dom.barThumb.addEventListener("click", () => {
        showSingleView(currentTrackIdx, true);
      });
    }
    if (dom.barTitle) {
      dom.barTitle.style.cursor = "pointer";
      dom.barTitle.addEventListener("click", () => {
        showSingleView(currentTrackIdx, true);
      });
    }

    // Table rows click to play and open single view
    const rows = document.querySelectorAll(".sp-row");
    rows.forEach((row) => {
      row.addEventListener("click", (e) => {
        if (e.target.closest(".sp-row-share-btn")) return;
        const trackId = parseInt(row.getAttribute("data-track-id"), 10);
        loadTrack(trackId, true);
        showSingleView(trackId, true);
      });
    });

    // Row share buttons
    const rowShareBtns = document.querySelectorAll(".sp-row-share-btn");
    rowShareBtns.forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const trackId = parseInt(btn.getAttribute("data-share-id"), 10);
        shareTrack(trackId);
      });
    });

    // Recommended cards play button & card click to open single view
    const cardPlayBtns = document.querySelectorAll(
      ".sp-card-play-btn, .sp-card",
    );
    cardPlayBtns.forEach((item) => {
      item.addEventListener("click", (e) => {
        const trackId = item.getAttribute("data-track-id");
        if (trackId !== null) {
          e.stopPropagation();
          const id = parseInt(trackId, 10);
          loadTrack(id, true);
          showSingleView(id, true);
        }
      });
    });

    // Visualizer toggle button
    if (dom.btnToggleViz) {
      dom.btnToggleViz.addEventListener("click", () => {
        const vizSec = document.getElementById("sp-visualizer-section");
        if (vizSec) {
          const isHidden = vizSec.style.display === "none";
          vizSec.style.display = isHidden ? "block" : "none";
          dom.btnToggleViz.classList.toggle("active", isHidden);
          showToast(isHidden ? "Visualizer Shown" : "Visualizer Hidden");
        }
      });
    }

    setupProgressBar();
    setupSingleScrubber();
    setupVolumeBar();
    setupFullscreenModal();
    setupKeyboardShortcuts();
    setupShellNavigation();
  }

  // Site Base Path Helper (Handles both Local Dev '/' and GitHub Pages '/V-S-P/')
  function getSiteBasePath() {
    const path = window.location.pathname.toLowerCase();
    if (path.startsWith("/v-s-p")) {
      return "/V-S-P/";
    }
    return "/";
  }

  function getCleanDisplayPath(targetTab, rawUrl) {
    const base = getSiteBasePath();
    const p = (rawUrl || "").toLowerCase();

    if (targetTab === "bot" || p.includes("bot")) {
      return base + "bot/";
    }
    if (targetTab === "songs" || p.includes("songs")) {
      return base + "songs";
    }
    if (
      targetTab === "3d-lab" ||
      targetTab === "vsp" ||
      p.includes("3d-lab") ||
      p.includes("vsp") ||
      p.includes("lab")
    ) {
      return base + "3d-lab";
    }
    if (
      p.includes("blogs/") &&
      !p.endsWith("blogs.html") &&
      !p.endsWith("blogs")
    ) {
      const match = rawUrl.match(/blogs\/([^.]+)/);
      if (match) return base + "blogs/" + match[1];
    }
    if (targetTab === "blogs" || p.includes("blogs")) {
      return base + "blogs";
    }
    // Home tab
    return base;
  }

  function getIframeTargetUrl(targetTab, rawUrl) {
    const base = getSiteBasePath();
    const p = (rawUrl || "").toLowerCase();

    if (targetTab === "bot" || p.includes("bot")) {
      return base + "bot/index.html";
    }
    if (
      targetTab === "3d-lab" ||
      targetTab === "vsp" ||
      p.includes("3d-lab") ||
      p.includes("vsp") ||
      p.includes("lab")
    ) {
      return base + "3d-lab.html";
    }
    if (
      p.includes("blogs/") &&
      !p.endsWith("blogs.html") &&
      !p.endsWith("blogs")
    ) {
      const match = rawUrl.match(/blogs\/([^?#]+)/);
      if (match) return base + "blogs/" + match[1];
    }
    if (targetTab === "blogs" || p.includes("blogs")) {
      return base + "blogs.html";
    }
    return base + "index.html";
  }

  // Seamless Multi-Page Shell Router (Continuous Audio Across Pages)
  window.vspPlayerActive = true;
  let currentActiveShellTab = "songs";

  window.vspShowSongs = function (trackId, autoplay) {
    navigateTo("songs.html", "songs");
    if (
      typeof trackId === "number" &&
      trackId >= 0 &&
      trackId < TRACKS.length
    ) {
      loadTrack(trackId, !!autoplay);
      showSingleView(trackId, true);
    } else {
      showAlbumView(true);
    }
  };

  window.vspNavigateFromChild = function (url) {
    let cleanUrl = url;
    if (cleanUrl.startsWith("../")) cleanUrl = cleanUrl.substring(3);
    else if (cleanUrl.startsWith("./")) cleanUrl = cleanUrl.substring(2);

    let targetTab = "home";
    if (cleanUrl.includes("songs")) targetTab = "songs";
    else if (cleanUrl.includes("bot")) targetTab = "bot";
    else if (cleanUrl.includes("blogs")) targetTab = "blogs";
    else if (
      cleanUrl.includes("3d-lab") ||
      cleanUrl.includes("vsp") ||
      cleanUrl.includes("lab")
    )
      targetTab = "3d-lab";

    navigateTo(cleanUrl, targetTab);
  };

  function updateShellBackButton(url) {
    const brandContainer = document.querySelector(
      "#vsp-header .d-flex.align-items-center",
    );
    if (!brandContainer) return;
    const existingBtn = brandContainer.querySelector(".vsp-nav-back-btn");
    const u = (url || "").toLowerCase();
    const matchBlog = u.match(/blogs\/([^/?#]+)/);
    const blogFile = matchBlog ? matchBlog[1].replace(/\.html$/, "") : "";
    const isIndividualBlog = Boolean(
      blogFile && blogFile !== "index" && blogFile !== "blogs",
    );

    if (isIndividualBlog) {
      if (!existingBtn) {
        const btn = document.createElement("a");
        btn.href = "blogs.html";
        btn.className = "vsp-nav-back-btn mr-2";
        btn.title = "Back to Blogs";
        btn.setAttribute("aria-label", "Back to Blogs");
        btn.innerHTML = '<i class="fa-solid fa-arrow-left"></i>';
        brandContainer.insertBefore(btn, brandContainer.firstChild);
      }
    } else if (existingBtn) {
      existingBtn.remove();
    }
  }

  window.vspSyncChildMeta = function (path, title) {
    if (currentActiveShellTab === "songs") return;
    try {
      if (title) document.title = title;
      if (path) {
        const cleanPath = getCleanDisplayPath(currentActiveShellTab, path);
        window.history.replaceState(
          { page: currentActiveShellTab, url: cleanPath },
          title || "",
          cleanPath,
        );
        updateShellBackButton(path);
      }
    } catch (e) {}
  };

  window.vspPauseAudio = pauseAudio;
  window.vspPlayAudio = playAudio;

  function updateNavActiveTab(tab) {
    const navLinks = document.querySelectorAll(
      "#vsp-header .nav-link, .sp-sidebar-link",
    );
    navLinks.forEach((link) => {
      const href = (link.getAttribute("href") || "").toLowerCase();
      link.classList.remove("active");
      if (
        tab === "home" &&
        (href.endsWith("index.html") ||
          href === "./" ||
          href === "index.html" ||
          href === "")
      ) {
        link.classList.add("active");
      } else if (tab === "bot" && href.includes("bot")) {
        link.classList.add("active");
      } else if (tab === "blogs" && href.includes("blogs")) {
        link.classList.add("active");
      } else if (
        (tab === "3d-lab" || tab === "vsp") &&
        (href.includes("3d-lab") ||
          href.includes("vsp") ||
          href.includes("lab"))
      ) {
        link.classList.add("active");
      } else if (tab === "songs" && href.includes("songs")) {
        link.classList.add("active");
      }
    });
  }

  function navigateTo(url, targetTab, pushToHistory = true) {
    const appContainer = document.getElementById("sp-app-container");
    const viewportContainer = document.getElementById("sp-viewport-container");
    const iframe = document.getElementById("sp-viewport-iframe");
    const footer = document.getElementById("vsp-footer");

    // Close mobile nav menu if open
    const collapseNav = document.querySelector("#vsp-header #navbarNav");
    const toggler = document.querySelector("#vsp-header .navbar-toggler");
    if (collapseNav && collapseNav.classList.contains("show")) {
      collapseNav.classList.remove("show");
      if (toggler) toggler.setAttribute("aria-expanded", "false");
      document.body.classList.remove("noscroll");
    }

    const displayUrl = getCleanDisplayPath(targetTab, url);
    currentActiveShellTab = targetTab;
    updateShellBackButton(url);

    if (targetTab === "songs" || (url && url.includes("songs"))) {
      if (viewportContainer) viewportContainer.style.display = "none";
      if (appContainer) appContainer.style.display = "";
      if (footer) footer.style.display = "";
      document.body.classList.remove("sp-in-viewport");
      document.title = "Songs & Music | Vishnu Suresh Perumbavoor (VSP)";
      if (pushToHistory) {
        window.history.pushState(
          { page: "songs", url: displayUrl },
          "",
          displayUrl,
        );
      }
      updateNavActiveTab("songs");
      return;
    }

    // Switch view to iframe viewport
    if (appContainer) appContainer.style.display = "none";
    if (footer) footer.style.display = "none";
    if (viewportContainer) viewportContainer.style.display = "block";
    document.body.classList.add("sp-in-viewport");

    const iframeTarget = getIframeTargetUrl(targetTab, url);
    if (iframe) {
      const currentSrc = iframe.getAttribute("data-loaded-src");
      if (currentSrc !== iframeTarget) {
        iframe.src = iframeTarget;
        iframe.setAttribute("data-loaded-src", iframeTarget);
      }
    }

    const titles = {
      home: "Vishnu Suresh Perumbavoor | Software Engineer & Researcher",
      bot: "VSP Bot | Intelligent In-Browser Assistant",
      blogs: "Blogs | Vishnu Suresh Perumbavoor (VSP)",
      "3d-lab": "3D Lab | Interactive 3D Typography & Visuals",
    };

    const newTitle = titles[targetTab] || document.title;
    document.title = newTitle;

    if (pushToHistory) {
      window.history.pushState(
        { page: targetTab, url: displayUrl },
        "",
        displayUrl,
      );
    }
    updateNavActiveTab(targetTab);
  }

  function setupShellNavigation() {
    // Event delegation on document to catch all topbar & sidebar navigation clicks
    document.addEventListener("click", (e) => {
      const headerLink = e.target.closest(
        "#vsp-header .nav-link, #vsp-header .navbar-brand, #vsp-header .vsp-nav-back-btn",
      );
      if (headerLink) {
        const href = headerLink.getAttribute("href");
        if (
          !href ||
          href.startsWith("#") ||
          href.startsWith("http") ||
          href.startsWith("mailto:")
        )
          return;

        e.preventDefault();
        let targetTab = "home";
        if (href.includes("songs")) targetTab = "songs";
        else if (href.includes("bot")) targetTab = "bot";
        else if (href.includes("blogs")) targetTab = "blogs";
        else if (
          href.includes("3d-lab") ||
          href.includes("vsp") ||
          href.includes("lab")
        )
          targetTab = "3d-lab";

        navigateTo(href, targetTab);
        return;
      }

      const sidebarLink = e.target.closest(".sp-sidebar-link, .sp-hero-meta a");
      if (sidebarLink) {
        const href = sidebarLink.getAttribute("href");
        if (
          !href ||
          href.startsWith("#") ||
          href.startsWith("http") ||
          href.startsWith("mailto:")
        )
          return;

        e.preventDefault();
        let targetTab = "home";
        if (href.includes("songs")) targetTab = "songs";
        else if (href.includes("bot")) targetTab = "bot";
        else if (href.includes("blogs")) targetTab = "blogs";
        else if (
          href.includes("3d-lab") ||
          href.includes("vsp") ||
          href.includes("lab")
        )
          targetTab = "3d-lab";

        navigateTo(href, targetTab);
        return;
      }
    });

    // Browser History Back/Forward support
    window.addEventListener("popstate", (e) => {
      const state = e.state;
      const path = window.location.pathname.toLowerCase();
      const isSongsPage = !state || state.page === "songs" || path.endsWith("songs.html") || path.endsWith("songs");

      if (isSongsPage) {
        navigateTo("songs.html", "songs", false);
        const params = new URLSearchParams(window.location.search);
        const trackParam = params.get("track");
        if (trackParam !== null) {
          const idx = parseInt(trackParam, 10);
          if (!isNaN(idx) && idx >= 0 && idx < TRACKS.length) {
            currentTrackIdx = idx;
            loadTrack(idx, false);
            showSingleView(idx, false);
            return;
          }
        }
        if (state && state.view === "single" && typeof state.track === "number") {
          currentTrackIdx = state.track;
          loadTrack(state.track, false);
          showSingleView(state.track, false);
          return;
        }
        showAlbumView(false);
      } else if (state && state.url) {
        navigateTo(state.url, state.page, false);
      } else {
        let tab = "home";
        if (path.includes("bot")) tab = "bot";
        else if (path.includes("blogs")) tab = "blogs";
        else if (
          path.includes("3d-lab") ||
          path.includes("vsp") ||
          path.includes("lab")
        )
          tab = "3d-lab";
        else if (path.includes("songs")) tab = "songs";
        navigateTo(window.location.pathname, tab, false);
      }
    });
  }

  // Initialize on DOM Ready
  function init() {
    initDOMElements();
    updateRepeatUI();
    bindEvents();
    checkUrlParams();
    startVisualizer();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
