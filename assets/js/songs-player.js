/**
 * Music Web Player Engine for VSP Portfolio
 * Handles real-time HTML5 audio playback, canvas visualizer, playlist management,
 * scrubbing, volume control, like state, and keyboard shortcuts.
 */

(function () {
  'use strict';

  // Master Playlist Definition
  const TRACKS = [
    {
      id: 0,
      title: 'No Crown Given',
      artist: 'Vishnu Suresh Perumbavoor (VSP)',
      genre: 'Self Mass',
      album: 'Self Mass',
      dateAdded: 'Oct 2026',
      duration: 179,
      durationStr: '2:59',
      src: 'assets/songs/no_crown_given - 05 AI cover song.mp3',
      cover: 'assets/images/cover_no_crown_given.jpg',
      badge: 'Banger'
    },
    {
      id: 1,
      title: "I'm Running This Shit",
      artist: 'Vishnu Suresh Perumbavoor (VSP)',
      genre: 'Self Mass',
      album: 'Self Mass',
      dateAdded: 'Oct 2026',
      duration: 121,
      durationStr: '2:01',
      src: 'assets/songs/im_running_this_shit - 05 AI cover song.mp3',
      cover: 'assets/images/cover_running_this.jpg',
      badge: 'Hype'
    }
  ];

  // State
  let currentTrackIdx = 0;
  let isPlaying = false;
  let isShuffle = false;
  let repeatMode = 0; // 0: off, 1: all, 2: one
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
  audio.preload = 'metadata';
  audio.volume = currentVolume;

  // DOM Elements Cache
  let dom = {};

  function initDOMElements() {
    dom = {
      // Table rows
      tableBody: document.getElementById('sp-table-body'),
      // Hero elements
      heroPlayBtn: document.getElementById('sp-hero-play-btn'),
      heroPlayIcon: document.getElementById('sp-hero-play-icon'),
      heroCover: document.getElementById('sp-hero-cover'),
      heroTitle: document.getElementById('sp-hero-title'),
      // Player Bar elements
      barThumb: document.getElementById('sp-bar-thumb'),
      barTitle: document.getElementById('sp-bar-title'),
      barArtist: document.getElementById('sp-bar-artist'),
      // Controls
      btnPlayPause: document.getElementById('sp-btn-playpause'),
      playPauseIcon: document.getElementById('sp-playpause-icon'),
      btnPrev: document.getElementById('sp-btn-prev'),
      btnNext: document.getElementById('sp-btn-next'),
      btnShuffle: document.getElementById('sp-btn-shuffle'),
      btnRepeat: document.getElementById('sp-btn-repeat'),
      // Mobile controls
      btnMobPlayPause: document.getElementById('sp-btn-mob-playpause'),
      mobPlayIcon: document.getElementById('sp-mob-play-icon'),
      btnMobNext: document.getElementById('sp-btn-mob-next'),
      // Progress Slider
      sliderWrap: document.getElementById('sp-slider-wrap'),
      sliderFill: document.getElementById('sp-slider-fill'),
      sliderThumb: document.getElementById('sp-slider-thumb'),
      currentTimeLabel: document.getElementById('sp-time-current'),
      totalTimeLabel: document.getElementById('sp-time-total'),
      // Volume Slider
      btnMute: document.getElementById('sp-btn-mute'),
      muteIcon: document.getElementById('sp-mute-icon'),
      volWrap: document.getElementById('sp-vol-wrap'),
      volFill: document.getElementById('sp-vol-fill'),
      volThumb: document.getElementById('sp-vol-thumb'),
      // Canvas Visualizer
      canvas: document.getElementById('sp-audio-canvas'),
      btnToggleViz: document.getElementById('sp-btn-toggleviz'),
      // Fullscreen Modal
      fsModal: document.getElementById('sp-fullscreen-modal'),
      btnOpenFs: document.getElementById('sp-btn-openfs'),
      btnCloseFs: document.getElementById('sp-btn-closefs'),
      fsCover: document.getElementById('sp-fs-cover'),
      fsTitle: document.getElementById('sp-fs-title'),
      fsArtist: document.getElementById('sp-fs-artist'),
      // Toast
      toast: document.getElementById('sp-toast')
    };
  }

  // Format seconds to mm:ss
  function formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }

  // Show Toast Notification
  function showToast(msg) {
    if (!dom.toast) return;
    dom.toast.textContent = msg;
    dom.toast.classList.add('show');
    clearTimeout(dom.toast._timer);
    dom.toast._timer = setTimeout(() => {
      dom.toast.classList.remove('show');
    }, 2400);
  }
  window.vspShowToast = showToast;

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
    if (dom.currentTimeLabel) dom.currentTimeLabel.textContent = '0:00';

    // Update Fullscreen view
    if (dom.fsCover) dom.fsCover.src = track.cover;
    if (dom.fsTitle) dom.fsTitle.textContent = track.title;
    if (dom.fsArtist) dom.fsArtist.textContent = track.artist;

    // Reset Progress Bar
    if (dom.sliderFill) dom.sliderFill.style.width = '0%';
    if (dom.sliderThumb) dom.sliderThumb.style.left = '0%';

    // Update Active Row in Table
    updateTableActiveRow();

    if (autoplay) {
      playAudio();
    }
  }

  // Play audio
  function playAudio() {
    initAudioContext();
    audio.play().then(() => {
      isPlaying = true;
      updatePlayPauseUI(true);
      startVisualizer();
    }).catch((err) => {
      console.warn('Audio playback prevented or waiting for user gesture:', err);
      isPlaying = false;
      updatePlayPauseUI(false);
    });
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

  // Update Play/Pause UI across table, action bar, and bottom bar
  function updatePlayPauseUI(playing) {
    const playIconClass = playing ? 'fa-solid fa-pause' : 'fa-solid fa-play';
    
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

    // Update visual table rows
    updateTableActiveRow();
  }

  // Update Table active row styling & equalizer bars
  function updateTableActiveRow() {
    const rows = document.querySelectorAll('.sp-row');
    rows.forEach((row) => {
      const rowId = parseInt(row.getAttribute('data-track-id'), 10);
      if (rowId === currentTrackIdx) {
        if (isPlaying) {
          row.classList.add('playing');
        } else {
          row.classList.remove('playing');
        }
        row.style.background = isPlaying ? 'rgba(30, 215, 96, 0.14)' : 'rgba(255, 255, 255, 0.05)';
      } else {
        row.classList.remove('playing');
        row.style.background = '';
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
      dom.btnShuffle.classList.toggle('active', isShuffle);
    }
    showToast(isShuffle ? 'Shuffle is ON' : 'Shuffle is OFF');
  }

  // Repeat toggle
  function toggleRepeat() {
    repeatMode = (repeatMode + 1) % 3;
    if (dom.btnRepeat) {
      dom.btnRepeat.classList.toggle('active', repeatMode > 0);
      const icon = dom.btnRepeat.querySelector('i');
      if (icon) {
        if (repeatMode === 2) {
          icon.className = 'fa-solid fa-repeat';
          dom.btnRepeat.setAttribute('title', 'Repeat Track');
        } else if (repeatMode === 1) {
          icon.className = 'fa-solid fa-repeat';
          dom.btnRepeat.setAttribute('title', 'Repeat Playlist');
        } else {
          icon.className = 'fa-solid fa-repeat';
          dom.btnRepeat.setAttribute('title', 'Repeat Off');
        }
      }
    }
    const msgs = ['Repeat is OFF', 'Repeat Playlist', 'Repeat Current Track'];
    showToast(msgs[repeatMode]);
  }

  // Track ended event
  audio.addEventListener('ended', () => {
    if (repeatMode === 2) {
      audio.currentTime = 0;
      playAudio();
    } else if (repeatMode === 1 || currentTrackIdx < TRACKS.length - 1 || isShuffle) {
      nextTrack();
    } else {
      pauseAudio();
      audio.currentTime = 0;
    }
  });

  // Time update event
  audio.addEventListener('timeupdate', () => {
    if (!isDraggingProgress && audio.duration) {
      const current = audio.currentTime;
      const total = audio.duration;
      const pct = (current / total) * 100;

      if (dom.sliderFill) dom.sliderFill.style.width = `${pct}%`;
      if (dom.sliderThumb) dom.sliderThumb.style.left = `${pct}%`;
      if (dom.currentTimeLabel) dom.currentTimeLabel.textContent = formatTime(current);
    }
  });

  // Duration change / metadata loaded
  audio.addEventListener('loadedmetadata', () => {
    if (dom.totalTimeLabel && audio.duration) {
      dom.totalTimeLabel.textContent = formatTime(audio.duration);
    }
  });

  // Progress Bar Seek Controls
  function setupProgressBar() {
    if (!dom.sliderWrap) return;

    function seekAt(e) {
      const rect = dom.sliderWrap.getBoundingClientRect();
      const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      if (audio.duration) {
        audio.currentTime = pos * audio.duration;
        if (dom.sliderFill) dom.sliderFill.style.width = `${pos * 100}%`;
        if (dom.sliderThumb) dom.sliderThumb.style.left = `${pos * 100}%`;
        if (dom.currentTimeLabel) dom.currentTimeLabel.textContent = formatTime(audio.currentTime);
      }
    }

    dom.sliderWrap.addEventListener('mousedown', (e) => {
      isDraggingProgress = true;
      seekAt(e);
      const onMouseMove = (ev) => seekAt(ev);
      const onMouseUp = () => {
        isDraggingProgress = false;
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      };
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });

    // Touch support for mobile
    dom.sliderWrap.addEventListener('touchstart', (e) => {
      isDraggingProgress = true;
      const touch = e.touches[0];
      seekAt(touch);
      const onTouchMove = (ev) => seekAt(ev.touches[0]);
      const onTouchEnd = () => {
        isDraggingProgress = false;
        document.removeEventListener('touchmove', onTouchMove);
        document.removeEventListener('touchend', onTouchEnd);
      };
      document.addEventListener('touchmove', onTouchMove, { passive: true });
      document.addEventListener('touchend', onTouchEnd);
    });
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
        dom.muteIcon.className = 'fa-solid fa-volume-xmark';
      } else if (currentVolume < 0.5) {
        dom.muteIcon.className = 'fa-solid fa-volume-low';
      } else {
        dom.muteIcon.className = 'fa-solid fa-volume-high';
      }
    }
  }

  function setupVolumeBar() {
    if (!dom.volWrap) return;

    function volAt(e) {
      const rect = dom.volWrap.getBoundingClientRect();
      const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      setVolume(pos);
    }

    dom.volWrap.addEventListener('mousedown', (e) => {
      isDraggingVolume = true;
      volAt(e);
      const onMouseMove = (ev) => volAt(ev);
      const onMouseUp = () => {
        isDraggingVolume = false;
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      };
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });

    // Mute button toggle
    if (dom.btnMute) {
      let prevVol = 0.85;
      dom.btnMute.addEventListener('click', () => {
        if (!isMuted && currentVolume > 0) {
          prevVol = currentVolume;
          setVolume(0);
          showToast('Muted');
        } else {
          setVolume(prevVol || 0.85);
          showToast(`Volume: ${Math.round(currentVolume * 100)}%`);
        }
      });
    }

    // Initialize volume
    setVolume(currentVolume);
  }

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
      console.warn('Web Audio API unavailable:', e);
    }
  }

  function startVisualizer() {
    if (!dom.canvas) return;
    const ctx = dom.canvas.getContext('2d');
    const width = dom.canvas.width;
    const height = dom.canvas.height;
    const bufferLength = analyser ? analyser.frequencyBinCount : 32;
    const dataArray = new Uint8Array(bufferLength);

    function renderFrame() {
      animFrameId = requestAnimationFrame(renderFrame);

      ctx.clearRect(0, 0, width, height);

      if (analyser && isPlaying) {
        analyser.getByteFrequencyData(dataArray);
      } else if (isPlaying) {
        // Procedural rhythmic fallback wave
        const time = Date.now() * 0.005;
        for (let i = 0; i < bufferLength; i++) {
          dataArray[i] = Math.floor(60 + 50 * Math.sin(time + i * 0.4) + 40 * Math.cos(time * 0.7 + i * 0.2));
        }
      } else {
        // Idle standby baseline
        for (let i = 0; i < bufferLength; i++) {
          dataArray[i] = 12;
        }
      }

      const barWidth = (width / bufferLength) * 0.75;
      const barGap = (width / bufferLength) * 0.25;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * (height * 0.9) + 4;

        // Gradient from vibrant green to emerald neon
        const grad = ctx.createLinearGradient(0, height - barHeight, 0, height);
        grad.addColorStop(0, '#1ed760');
        grad.addColorStop(0.7, '#1db954');
        grad.addColorStop(1, '#0e5c2b');

        ctx.fillStyle = grad;
        // Rounded bar top
        ctx.beginPath();
        ctx.roundRect(x, height - barHeight, barWidth, barHeight, [3, 3, 0, 0]);
        ctx.fill();

        x += barWidth + barGap;
      }
    }

    if (!animFrameId) {
      renderFrame();
    }
  }

  // Keyboard Shortcuts
  function setupKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
      // Ignore if user is focused on an input or textarea
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          togglePlayPause();
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (audio.duration) {
            audio.currentTime = Math.min(audio.duration, audio.currentTime + 5);
            showToast(`+5s (${formatTime(audio.currentTime)})`);
          }
          break;
        case 'ArrowLeft':
          e.preventDefault();
          audio.currentTime = Math.max(0, audio.currentTime - 5);
          showToast(`-5s (${formatTime(audio.currentTime)})`);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setVolume(Math.min(1, currentVolume + 0.1));
          showToast(`Volume: ${Math.round(currentVolume * 100)}%`);
          break;
        case 'ArrowDown':
          e.preventDefault();
          setVolume(Math.max(0, currentVolume - 0.1));
          showToast(`Volume: ${Math.round(currentVolume * 100)}%`);
          break;
        case 'KeyM':
          if (dom.btnMute) dom.btnMute.click();
          break;
        case 'KeyN':
          nextTrack();
          break;
        case 'KeyP':
          prevTrack();
          break;
      }
    });
  }

  // URL Parameter auto-selection
  function checkUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const trackParam = params.get('track');
    const autoParam = params.get('autoplay');

    if (trackParam !== null) {
      const idx = parseInt(trackParam, 10);
      if (!isNaN(idx) && idx >= 0 && idx < TRACKS.length) {
        currentTrackIdx = idx;
      }
    }

    loadTrack(currentTrackIdx, autoParam === 'true');
  }

  // Fullscreen Modal setup
  function setupFullscreenModal() {
    if (dom.btnOpenFs && dom.fsModal) {
      dom.btnOpenFs.addEventListener('click', () => {
        dom.fsModal.classList.add('active');
      });
    }
    if (dom.btnCloseFs && dom.fsModal) {
      dom.btnCloseFs.addEventListener('click', () => {
        dom.fsModal.classList.remove('active');
      });
    }
  }

  // Bind all event listeners
  function bindEvents() {
    // Hero big play button
    if (dom.heroPlayBtn) {
      dom.heroPlayBtn.addEventListener('click', togglePlayPause);
    }

    // Bottom bar play/pause
    if (dom.btnPlayPause) {
      dom.btnPlayPause.addEventListener('click', togglePlayPause);
    }
    // Mobile play/pause
    if (dom.btnMobPlayPause) {
      dom.btnMobPlayPause.addEventListener('click', togglePlayPause);
    }

    // Prev / Next
    if (dom.btnPrev) dom.btnPrev.addEventListener('click', prevTrack);
    if (dom.btnNext) dom.btnNext.addEventListener('click', nextTrack);
    if (dom.btnMobNext) dom.btnMobNext.addEventListener('click', nextTrack);

    // Shuffle & Repeat
    if (dom.btnShuffle) dom.btnShuffle.addEventListener('click', toggleShuffle);
    if (dom.btnRepeat) dom.btnRepeat.addEventListener('click', toggleRepeat);

    // Table rows click to play
    const rows = document.querySelectorAll('.sp-row');
    rows.forEach((row) => {
      row.addEventListener('click', (e) => {
        const trackId = parseInt(row.getAttribute('data-track-id'), 10);
        if (trackId === currentTrackIdx) {
          togglePlayPause();
        } else {
          loadTrack(trackId, true);
        }
      });
    });

    // Recommended cards play button
    const cardPlayBtns = document.querySelectorAll('.sp-card-play-btn, .sp-card');
    cardPlayBtns.forEach((item) => {
      item.addEventListener('click', (e) => {
        const trackId = item.getAttribute('data-track-id');
        if (trackId !== null) {
          e.stopPropagation();
          const id = parseInt(trackId, 10);
          loadTrack(id, true);
        }
      });
    });

    // Visualizer toggle button
    if (dom.btnToggleViz) {
      dom.btnToggleViz.addEventListener('click', () => {
        const vizSec = document.getElementById('sp-visualizer-section');
        if (vizSec) {
          const isHidden = vizSec.style.display === 'none';
          vizSec.style.display = isHidden ? 'block' : 'none';
          dom.btnToggleViz.classList.toggle('active', isHidden);
          showToast(isHidden ? 'Visualizer Shown' : 'Visualizer Hidden');
        }
      });
    }

    setupProgressBar();
    setupVolumeBar();
    setupFullscreenModal();
    setupKeyboardShortcuts();
  }

  // Initialize on DOM Ready
  function init() {
    initDOMElements();
    bindEvents();
    checkUrlParams();
    startVisualizer();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
