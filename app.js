/* ==========================================================================
   TV DIGITAL LIBRE - App Engine (GoldenPlay Style IPTV)
   Reproductor IPTV, Sincronización M3U Automática en Tiempo Real, PWA,
   Layout 2 Columnas Estilo IPTV Referencia (Modo Horizontal)
   ========================================================================== */

// Configuración Global y Estado
const ADMIN_PASSWORD = "4206371Luis*";
const STORAGE_KEY = "tv_digital_libre_channels_v5";
const M3U_URL_KEY = "tv_digital_libre_m3u_url_v5";

let channelsList = [];
let activeChannel = null;
let currentCategory = "LOCALES";
let availableCategories = ["LOCALES"];
let hlsPlayer = null;

let currentM3uUrl = localStorage.getItem(M3U_URL_KEY) || DEFAULT_M3U_URL;
let autoSyncTimer = null;

// Control de Reconexión Automática
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
let reconnectTimer = null;
let isReconnecting = false;

// Captura global inmediata del evento de instalación PWA (antes de DOMContentLoaded)
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  console.log('[PWA] Evento beforeinstallprompt capturado inmediatamente.');
});

// DOM Elements
let videoElement, iframeElement, reconnectOverlay, reconnectCountText;
let channelsGrid, catTitleElement, searchInput, sideChannelTitle, epgDescElement;
let authModal, adminModal, channelModal, passwordInput, authErrorMsg;

document.addEventListener('DOMContentLoaded', () => {
  initDOMReferences();
  initPWA();
  initClock();
  initOrientation();
  initTVMode();
  loadChannels();
  setupEventListeners();
  setupTVNavigation();
});

/* ==========================================================================
   MÓDULO DE DETECCIÓN Y CONFIGURACIÓN MODO TV (ANDROID TV / GOOGLE TV)
   ========================================================================== */

function detectTVDevice() {
  const ua = (navigator.userAgent || navigator.vendor || window.opera || '').toLowerCase();
  
  // 1. Detección por User Agent de Televisores y Smart TV
  const tvKeywords = [
    'android tv', 'googletv', 'smarttv', 'smart-tv', 'leanback', 'appletv',
    'hbbtv', 'netcast', 'viera', 'tizen', 'webos', 'bravia', 'aftb', 'aftt', 'mibox',
    'shield', 'nexus player', 'chromecast', 'tv', 'crkey'
  ];
  
  const isTvUA = tvKeywords.some(keyword => ua.includes(keyword));

  // 2. Override manual por parámetro URL (?mode=tv o ?tv=1) o localStorage
  const urlParams = new URLSearchParams(window.location.search);
  const forceTV = urlParams.get('mode') === 'tv' || urlParams.get('tv') === '1' || localStorage.getItem('force_tv_mode') === 'true';
  const forceMobile = urlParams.get('mode') === 'mobile' || localStorage.getItem('force_mobile_mode') === 'true';

  if (forceMobile) return false;
  if (forceTV || isTvUA) return true;

  // 3. Verificación de pantalla grande sin puntero fino (Smart TV browser)
  const isLargeScreen = window.innerWidth >= 960 && window.innerHeight >= 540;
  const isNoFinePointer = window.matchMedia && window.matchMedia('(pointer: fine)').matches === false;

  return (isTvUA || (isLargeScreen && isNoFinePointer));
}

function initTVMode() {
  const isTV = detectTVDevice();
  window.isTVMode = isTV;

  if (isTV) {
    document.body.classList.add('is-tv-mode');
    console.log('[TV Engine] Modo Android TV / Smart TV activado automáticamente.');

    // Mostrar distintivo discreto de Modo TV
    if (!document.getElementById('tv-mode-badge')) {
      const badge = document.createElement('div');
      badge.id = 'tv-mode-badge';
      badge.className = 'tv-mode-badge';
      badge.innerHTML = '📺 MODO TV ACTIVO';
      document.body.appendChild(badge);
    }

    // Foco Inicial automático al cargar
    setTimeout(() => {
      setInitialTVFocus();
    }, 500);
  } else {
    document.body.classList.remove('is-tv-mode');
    const badge = document.getElementById('tv-mode-badge');
    if (badge) badge.remove();
  }
}

function setInitialTVFocus() {
  const activeCard = document.querySelector('.channel-card.active');
  const firstCard = document.querySelector('.channel-card');
  const catBtn = document.getElementById('cat-prev-btn');

  if (activeCard) {
    activeCard.focus();
    activeCard.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  } else if (firstCard) {
    firstCard.focus();
    firstCard.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  } else if (catBtn) {
    catBtn.focus();
  }
}

/* ==========================================================================
   INICIALIZACIÓN DE RELOJ EN TIEMPO REAL Y ORIENTACIÓN HORIZONTAL
   ========================================================================== */

function initClock() {
  const clockEl = document.getElementById('header-clock');
  
  function updateClock() {
    if (!clockEl) return;
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    
    // Meses en español corto
    const months = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
    const monthName = months[now.getMonth()];
    const day = String(now.getDate()).padStart(2, '0');
    const year = now.getFullYear();

    clockEl.textContent = `${timeStr}  ${monthName} ${day},${year}`;
  }

  updateClock();
  setInterval(updateClock, 1000);
}

function initOrientation() {
  // Intentar bloquear en modo horizontal en dispositivos móviles
  if (screen.orientation && screen.orientation.lock) {
    screen.orientation.lock('landscape').catch(() => {
      // Ignorar si el navegador bloquea la orientación sin gesto de usuario
    });
  }
}

/* ==========================================================================
   REFERENCIAS DOM Y PWA INSTANTÁNEA
   ========================================================================== */

function initDOMReferences() {
  videoElement = document.getElementById('video-player');
  iframeElement = document.getElementById('iframe-player');

  reconnectOverlay = document.getElementById('reconnect-overlay');
  reconnectCountText = document.getElementById('reconnect-count-text');

  channelsGrid = document.getElementById('channels-grid');
  catTitleElement = document.getElementById('cat-current-title');
  searchInput = document.getElementById('search-input');
  sideChannelTitle = document.getElementById('side-channel-title');
  epgDescElement = document.getElementById('player-epg-desc');

  authModal = document.getElementById('auth-modal');
  adminModal = document.getElementById('admin-modal');
  channelModal = document.getElementById('channel-modal');
  passwordInput = document.getElementById('admin-password-input');
  authErrorMsg = document.getElementById('auth-error-msg');
}

function initPWA() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('[PWA] Service Worker registrado:', reg.scope))
      .catch(err => console.warn('[PWA] Error Service Worker:', err));
  }

  const pwaModal = document.getElementById('pwa-install-modal');
  const btnInstallModal = document.getElementById('btn-pwa-install-modal');
  const btnDismissModal = document.getElementById('btn-pwa-dismiss');
  const btnHeaderInstall = document.getElementById('btn-pwa-header');
  const browserInstructions = document.getElementById('pwa-browser-instructions');

  // Si la app ya está instalada y ejecutándose en modo Standalone, no mostrar modal ni botón de cabecera
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  if (isStandalone) {
    console.log('[PWA] Ejecutando en modo App Standalone instalada.');
    if (btnHeaderInstall) btnHeaderInstall.style.display = 'none';
    return;
  }

  const triggerDirectInstall = async () => {
    if (deferredPrompt) {
      try {
        console.log('[PWA] Disparando diálogo nativo de instalación directa...');
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`[PWA] Resultado de usuario: ${outcome}`);
        if (outcome === 'accepted') {
          showNotificationToast('🎉 ¡Gracias por instalar TV DIGITAL LIBRE!');
          if (btnHeaderInstall) btnHeaderInstall.style.display = 'none';
        }
      } catch (err) {
        console.error('[PWA] Error durante prompt:', err);
      } finally {
        deferredPrompt = null;
        if (pwaModal) pwaModal.classList.remove('active');
      }
    } else {
      if (pwaModal) pwaModal.classList.add('active');
      if (browserInstructions) {
        browserInstructions.classList.remove('hidden');
      }
      showNotificationToast('📲 Sigue las instrucciones en pantalla o usa el menú de tu navegador.');
    }
  };

  // Botón directo en la Cabecera Principal (📲 INSTALAR APP)
  if (btnHeaderInstall) {
    btnHeaderInstall.addEventListener('click', triggerDirectInstall);
  }

  const isDismissed = sessionStorage.getItem('pwa_prompt_dismissed') === 'true';

  // Desplegar modal al ingresar si no está instalada y no fue descartada en esta sesión
  if (!isStandalone && !isDismissed && pwaModal) {
    setTimeout(() => {
      pwaModal.classList.add('active');
    }, 400);
  }

  // Acción al hacer clic en '📲 Instalar Aplicación' del Modal
  if (btnInstallModal) {
    btnInstallModal.addEventListener('click', triggerDirectInstall);
  }

  if (btnDismissModal) {
    btnDismissModal.addEventListener('click', () => {
      sessionStorage.setItem('pwa_prompt_dismissed', 'true');
      if (pwaModal) pwaModal.classList.remove('active');
    });
  }
}

/* ==========================================================================
   GESTIÓN DE CANALES Y SINCRONIZACIÓN M3U EN TIEMPO REAL
   ========================================================================== */

function loadChannels() {
  const savedData = localStorage.getItem(STORAGE_KEY);
  if (savedData) {
    try {
      channelsList = JSON.parse(savedData);
    } catch (e) {
      console.error('Error leyendo canales guardados:', e);
      channelsList = [...DEFAULT_CHANNELS];
    }
  } else {
    channelsList = [...DEFAULT_CHANNELS];
    saveChannels();
  }
  
  updateCategoryState();
  renderChannels();

  // Seleccionar primer canal automáticamente
  if (channelsList.length > 0 && !activeChannel) {
    playChannel(channelsList[0]);
  }

  // Sincronización automática de canales al iniciar
  syncM3UChannels(false);

  // Temporizador de sincronización en tiempo real (cada 30s)
  if (autoSyncTimer) clearInterval(autoSyncTimer);
  autoSyncTimer = setInterval(() => {
    console.log('[Auto-Sync] Comprobando lista M3U en tiempo real...');
    syncM3UChannels(false);
  }, 30000);
}

function saveChannels() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(channelsList));
}

function fixDropboxUrl(url) {
  if (!url) return '';
  url = url.trim();
  if (url.includes('dropbox.com')) {
    return url.replace(/dl=0/g, 'dl=1').replace(/raw=0/g, 'raw=1');
  }
  return url;
}

async function fetchM3UData(url) {
  const targetUrl = fixDropboxUrl(url);
  
  // 1. Intento Directo
  try {
    const res = await fetch(targetUrl, { cache: 'no-cache' });
    if (res.ok) {
      const text = await res.text();
      if (text.includes('#EXTINF') || text.includes('#EXTM3U')) return text;
    }
  } catch (e) {
    console.warn('[M3U Sync] Direct fetch failed, trying proxy...', e);
  }

  // 2. Intento vía Proxy CORS (AllOrigins)
  try {
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`;
    const res = await fetch(proxyUrl, { cache: 'no-cache' });
    if (res.ok) {
      const text = await res.text();
      if (text.includes('#EXTINF') || text.includes('#EXTM3U')) return text;
    }
  } catch (e) {
    console.warn('[M3U Sync] AllOrigins proxy failed, trying CorsProxy...', e);
  }

  // 3. Intento vía Proxy CORS Alternativo (CorsProxy.io)
  try {
    const proxyUrl2 = `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`;
    const res = await fetch(proxyUrl2, { cache: 'no-cache' });
    if (res.ok) {
      const text = await res.text();
      if (text.includes('#EXTINF') || text.includes('#EXTM3U')) return text;
    }
  } catch (e) {
    console.error('[M3U Sync] Fallaron todos los intentos de descarga M3U:', e);
  }

  return null;
}

async function syncM3UChannels(showToast = false) {
  const syncBtn = document.getElementById('btn-sync-app');
  if (syncBtn) {
    syncBtn.classList.add('spinning');
    syncBtn.disabled = true;
  }

  try {
    const m3uText = await fetchM3UData(currentM3uUrl);
    if (m3uText) {
      const parsed = parseM3U(m3uText);
      if (parsed && parsed.length > 0) {
        channelsList = parsed;
        saveChannels();
        updateCategoryState();
        renderChannels();

        if (!activeChannel || !channelsList.some(c => c.id === activeChannel.id)) {
          if (channelsList.length > 0) playChannel(channelsList[0]);
        }

        if (showToast) {
          showNotificationToast(`✅ Sincronizados ${parsed.length} canales en tiempo real desde M3U`);
        }
        return true;
      }
    }

    if (showToast) {
      showNotificationToast('⚠️ No se pudo actualizar la lista M3U. Usando canales locales.');
    }
  } catch (err) {
    console.error('[M3U Sync] Error:', err);
    if (showToast) {
      showNotificationToast('⚠️ Error al conectar con la lista M3U remota.');
    }
  } finally {
    if (syncBtn) {
      syncBtn.classList.remove('spinning');
      syncBtn.disabled = false;
    }
  }
  return false;
}

/* ==========================================================================
   NAVEGACIÓN POR CATEGORÍAS (< CATEGORÍA >)
   ========================================================================== */

function updateCategoryState() {
  const categoriesSet = new Set();
  channelsList.forEach(ch => {
    if (ch.category && ch.category.trim()) {
      categoriesSet.add(ch.category.trim().toUpperCase());
    }
  });

  if (categoriesSet.size === 0) categoriesSet.add("LOCALES");

  availableCategories = Array.from(categoriesSet);
  
  if (!availableCategories.includes(currentCategory)) {
    currentCategory = availableCategories[0];
  }

  if (catTitleElement) {
    catTitleElement.textContent = currentCategory;
  }
}

function prevCategory() {
  if (availableCategories.length === 0) return;
  const idx = availableCategories.indexOf(currentCategory);
  const prevIdx = (idx - 1 + availableCategories.length) % availableCategories.length;
  currentCategory = availableCategories[prevIdx];
  if (catTitleElement) catTitleElement.textContent = currentCategory;
  renderChannels(searchInput ? searchInput.value : '');
}

function nextCategory() {
  if (availableCategories.length === 0) return;
  const idx = availableCategories.indexOf(currentCategory);
  const nextIdx = (idx + 1) % availableCategories.length;
  currentCategory = availableCategories[nextIdx];
  if (catTitleElement) catTitleElement.textContent = currentCategory;
  renderChannels(searchInput ? searchInput.value : '');
}

/* ==========================================================================
   RENDERIZADO DE CANALES ESTILO GOLDENPLAY (REFERENCIA)
   ========================================================================== */

function renderChannels(filterText = '') {
  const filtered = channelsList.filter(ch => {
    const matchesCat = ch.category.toUpperCase() === currentCategory.toUpperCase();
    const matchesSearch = filterText === '' || ch.name.toLowerCase().includes(filterText.toLowerCase());
    return matchesCat && matchesSearch;
  });

  if (filtered.length === 0) {
    channelsGrid.innerHTML = `
      <div style="text-align: center; padding: 2rem; color: var(--text-muted);">
        <p style="font-size: 0.95rem; font-weight: 700;">No hay canales en "${currentCategory}"</p>
        <p style="font-size: 0.8rem; margin-top: 4px;">Usa las flechas &lt; &gt; para cambiar de categoría.</p>
      </div>
    `;
    return;
  }

  // Generar número de índice tipo IPTV (725, 726... o 1, 2, 3...)
  channelsGrid.innerHTML = filtered.map((ch, index) => {
    const channelNum = index + 1;
    const isActive = activeChannel && activeChannel.id === ch.id;

    return `
      <div class="channel-card focusable ${isActive ? 'active' : ''}" data-id="${ch.id}" tabindex="0">
        <span class="channel-num">${channelNum}</span>
        <div class="channel-logo-wrapper">
          <img class="channel-logo-img" src="${ch.logo}" alt="${ch.name}" onerror="this.src='logo.jpg'">
        </div>
        <div class="channel-info-wrapper">
          <div class="channel-name">${ch.name}</div>
          <div class="channel-epg-text">Señal en vivo • ${ch.category || 'LOCALES'}</div>
        </div>
      </div>
    `;
  }).join('');

  channelsGrid.querySelectorAll('.channel-card').forEach(card => {
    card.addEventListener('click', () => {
      const channel = channelsList.find(c => c.id === card.dataset.id);
      if (channel) {
        playChannel(channel);
        document.querySelectorAll('.channel-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
      }
    });
  });
}

/* ==========================================================================
   PARSER DE EMBEDS Y REPRODUCTOR
   ========================================================================== */

function parseEmbedOrStreamUrl(input) {
  if (!input) return { type: 'video', url: '' };
  input = input.trim();

  const iframeSrcMatch = input.match(/src=["']([^"']+)["']/i);
  if (iframeSrcMatch) {
    let srcUrl = iframeSrcMatch[1];
    if (srcUrl.includes('youtube.com') || srcUrl.includes('youtu.be')) {
      if (!srcUrl.includes('autoplay=')) srcUrl += (srcUrl.includes('?') ? '&' : '?') + 'autoplay=1';
    }
    return { type: 'embed', url: srcUrl };
  }

  const ytMatch = input.match(/(?:youtube\.com\/(?:watch\?.*v=|embed\/|live\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i);
  if (ytMatch) {
    return {
      type: 'embed',
      url: `https://www.youtube.com/embed/${ytMatch[1]}?autoplay=1&mute=0&rel=0&enablejsapi=1`
    };
  }

  const dmMatch = input.match(/(?:dailymotion\.com\/video\/|dai\.ly\/)([a-zA-Z0-9]+)/i);
  if (dmMatch) {
    return {
      type: 'embed',
      url: `https://www.dailymotion.com/embed/video/${dmMatch[1]}?autoplay=1`
    };
  }

  if (input.includes('/embed/') || input.includes('player.')) {
    return { type: 'embed', url: input };
  }

  return { type: 'video', url: input };
}

function showChannelLoadingOverlay(channelName = '') {
  const overlay = document.getElementById('channel-loading-overlay');
  const nameEl = document.getElementById('loading-channel-name');
  if (nameEl && channelName) {
    nameEl.textContent = channelName;
  }
  if (overlay) {
    overlay.classList.remove('hidden');
    overlay.style.display = 'flex';
  }
}

function hideChannelLoadingOverlay() {
  const overlay = document.getElementById('channel-loading-overlay');
  if (overlay) {
    overlay.classList.add('hidden');
    overlay.style.display = 'none';
  }
}

function playChannel(channel) {
  activeChannel = channel;
  reconnectAttempts = 0;
  hideReconnectOverlay();
  showChannelLoadingOverlay(channel.name);

  if (sideChannelTitle) sideChannelTitle.textContent = channel.name;
  if (epgDescElement) epgDescElement.textContent = `Transmisión en vivo en alta definición de ${channel.name} • Proari Systems`;

  const rawUrl = channel.url;
  const parsed = parseEmbedOrStreamUrl(rawUrl);

  if (hlsPlayer) {
    hlsPlayer.destroy();
    hlsPlayer = null;
  }

  if (parsed.type === 'embed') {
    if (videoElement) {
      videoElement.pause();
      videoElement.style.display = 'none';
    }
    if (iframeElement) {
      iframeElement.style.display = 'block';
      iframeElement.src = parsed.url;
      iframeElement.onload = () => {
        setTimeout(hideChannelLoadingOverlay, 500);
      };
    }
  } else {
    if (iframeElement) {
      iframeElement.style.display = 'none';
      iframeElement.src = '';
    }
    if (videoElement) {
      videoElement.style.display = 'block';
    }

    const url = parsed.url;
    
    // Forzar siempre audio activo
    videoElement.muted = false;
    videoElement.volume = 1.0;

    if (url.includes('.m3u8') && Hls.isSupported()) {
      hlsPlayer = new Hls({
        manifestLoadingMaxRetry: 8,
        levelLoadingMaxRetry: 8,
        fragLoadingMaxRetry: 10,
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 90
      });

      hlsPlayer.loadSource(url);
      hlsPlayer.attachMedia(videoElement);

      hlsPlayer.on(Hls.Events.MANIFEST_PARSED, () => {
        ensureAudioUnlocked(videoElement);
      });

      hlsPlayer.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              triggerAutoReconnect();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hlsPlayer.recoverMediaError();
              break;
            default:
              triggerAutoReconnect();
              break;
          }
        }
      });

    } else {
      videoElement.src = url;
      ensureAudioUnlocked(videoElement);
    }
  }

  renderChannels(searchInput ? searchInput.value : '');
}

function ensureAudioUnlocked(video) {
  if (!video) return;
  video.muted = false;
  video.volume = 1.0;

  const playPromise = video.play();
  if (playPromise !== undefined) {
    playPromise.then(() => {
      console.log('[Audio Engine] Reproduciendo señal con sonido activado.');
    }).catch(err => {
      console.warn('[Audio Engine] Autoplay con audio requiere interacción:', err);
      video.muted = true;
      video.play().then(() => {
        const unlock = () => {
          if (videoElement) {
            videoElement.muted = false;
            videoElement.volume = 1.0;
          }
          ['click', 'keydown', 'touchstart'].forEach(evt => document.removeEventListener(evt, unlock));
        };
        ['click', 'keydown', 'touchstart'].forEach(evt => document.addEventListener(evt, unlock, { once: true }));
      });
    });
  }
}

function setupVideoEvents() {
  if (videoElement) {
    videoElement.addEventListener('playing', hideChannelLoadingOverlay);
    videoElement.addEventListener('loadeddata', hideChannelLoadingOverlay);
    videoElement.addEventListener('canplay', hideChannelLoadingOverlay);
    videoElement.addEventListener('waiting', () => {
      showChannelLoadingOverlay(activeChannel ? activeChannel.name : '');
    });

    videoElement.addEventListener('error', () => triggerAutoReconnect());
    videoElement.addEventListener('stalled', () => {
      if (!isReconnecting) triggerAutoReconnect();
    });
    videoElement.addEventListener('dblclick', toggleFullscreen);
  }

  const playerCard = document.getElementById('player-container');
  if (playerCard) {
    playerCard.addEventListener('dblclick', toggleFullscreen);
  }

  const handleFullscreenChange = () => {
    const isFS = !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement);
    if (playerCard) {
      if (isFS) {
        playerCard.classList.add('is-fullscreen');
        document.body.classList.add('is-fullscreen');
      } else {
        playerCard.classList.remove('is-fullscreen');
        document.body.classList.remove('is-fullscreen');
      }
    }
  };

  document.addEventListener('fullscreenchange', handleFullscreenChange);
  document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
  document.addEventListener('mozfullscreenchange', handleFullscreenChange);
  document.addEventListener('MSFullscreenChange', handleFullscreenChange);
}

function triggerAutoReconnect() {
  if (isReconnecting) return;
  isReconnecting = true;
  showReconnectOverlay();

  reconnectAttempts++;
  if (reconnectCountText) {
    reconnectCountText.textContent = `Intento ${reconnectAttempts} de ${MAX_RECONNECT_ATTEMPTS}`;
  }

  if (reconnectAttempts <= MAX_RECONNECT_ATTEMPTS) {
    const delay = Math.min(1000 * reconnectAttempts, 4000);
    clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(() => {
      isReconnecting = false;
      if (activeChannel) playChannel(activeChannel);
    }, delay);
  } else {
    if (reconnectCountText) {
      reconnectCountText.textContent = `No se pudo conectar. Intenta de nuevo más tarde.`;
    }
    setTimeout(() => { isReconnecting = false; }, 5000);
  }
}

function showReconnectOverlay() {
  if (reconnectOverlay) reconnectOverlay.classList.remove('hidden');
}

function hideReconnectOverlay() {
  if (reconnectOverlay) reconnectOverlay.classList.add('hidden');
}

function toggleFullscreen() {
  const container = document.getElementById('player-container') || videoElement;
  if (!document.fullscreenElement && !document.webkitFullscreenElement) {
    if (container.requestFullscreen) {
      container.requestFullscreen();
    } else if (container.webkitRequestFullscreen) {
      container.webkitRequestFullscreen();
    }
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    }
  }
}

/* ==========================================================================
   LISTENERS Y EVENTOS DE INTERFAZ
   ========================================================================== */

function setupEventListeners() {
  setupVideoEvents();

  // Botón Volver (Header)
  const btnBack = document.getElementById('btn-back');
  if (btnBack) {
    btnBack.addEventListener('click', toggleFullscreen);
  }

  // Navegación con Flechas de Categoría (< CATEGORIA >)
  const catPrevBtn = document.getElementById('cat-prev-btn');
  const catNextBtn = document.getElementById('cat-next-btn');

  if (catPrevBtn) catPrevBtn.addEventListener('click', prevCategory);
  if (catNextBtn) catNextBtn.addEventListener('click', nextCategory);

  // Toggle Buscador
  const btnSearchToggle = document.getElementById('btn-search-toggle');
  const searchContainer = document.getElementById('search-box-container');
  if (btnSearchToggle && searchContainer) {
    btnSearchToggle.addEventListener('click', () => {
      searchContainer.classList.toggle('hidden');
      if (!searchContainer.classList.contains('hidden') && searchInput) {
        searchInput.focus();
      }
    });
  }

  // Botón Compartir Sistema IPTV
  const btnShare = document.getElementById('btn-share-app');
  if (btnShare) {
    btnShare.addEventListener('click', async () => {
      const shareUrl = window.location.href;
      const shareData = {
        title: 'TV DIGITAL LIBRE | IPTV Live',
        text: 'Mira televisión digital libre IPTV en vivo por Proari Systems.',
        url: shareUrl
      };

      if (navigator.share) {
        try {
          await navigator.share(shareData);
          console.log('[Share] Contenido compartido exitosamente');
        } catch (err) {
          if (err.name !== 'AbortError') {
            copyToClipboard(shareUrl);
          }
        }
      } else {
        copyToClipboard(shareUrl);
      }
    });
  }

  // Acceso de administración por doble clic en el Logo
  const brandContainer = document.querySelector('.brand-container');
  if (brandContainer) {
    brandContainer.style.cursor = 'pointer';
    brandContainer.addEventListener('dblclick', openAuthModal);
  }

  const btnSync = document.getElementById('btn-sync-app');
  if (btnSync) {
    btnSync.addEventListener('click', () => syncM3UChannels(true));
  }

  const authForm = document.getElementById('auth-form');
  if (authForm) {
    authForm.addEventListener('submit', (e) => {
      e.preventDefault();
      verifyPassword();
    });
  }

  document.querySelectorAll('.close-modal-btn').forEach(btn => {
    btn.addEventListener('click', closeAllModals);
  });

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      renderChannels(e.target.value);
    });
  }

  const btnFullscreen = document.getElementById('btn-fullscreen');
  if (btnFullscreen) {
    btnFullscreen.addEventListener('click', toggleFullscreen);
  }
}

function openAuthModal() {
  passwordInput.value = '';
  authErrorMsg.style.display = 'none';
  passwordInput.classList.remove('shake-error');
  authModal.classList.add('active');
  setTimeout(() => passwordInput.focus(), 100);
}

function verifyPassword() {
  const enteredPass = passwordInput.value.trim();
  if (enteredPass === ADMIN_PASSWORD) {
    authModal.classList.remove('active');
    openAdminModal();
  } else {
    authErrorMsg.style.display = 'block';
    authErrorMsg.textContent = 'Contraseña incorrecta. Acceso denegado.';
    passwordInput.classList.add('shake-error');
    setTimeout(() => passwordInput.classList.remove('shake-error'), 500);
  }
}

function openAdminModal() {
  renderAdminChannelList();
  adminModal.classList.add('active');
  const btnAdd = document.getElementById('btn-add-channel');
  if (btnAdd) setTimeout(() => btnAdd.focus(), 100);
}

function closeAllModals() {
  authModal.classList.remove('active');
  adminModal.classList.remove('active');
  channelModal.classList.remove('active');
}

/* ==========================================================================
   PANEL DE ADMINISTRACIÓN Y GESTIÓN DE CANALES
   ========================================================================== */

function renderAdminChannelList() {
  const listContainer = document.getElementById('admin-channel-list');
  if (!listContainer) return;

  listContainer.innerHTML = channelsList.map((ch, index) => `
    <div class="admin-channel-item">
      <div style="display: flex; align-items: center; gap: 10px;">
        <span style="font-size: 0.8rem; font-weight: 800; color: var(--red-bright); min-width: 28px;">#${index + 1}</span>
        <img src="${ch.logo}" style="width: 32px; height: 32px; object-fit: contain;" onerror="this.src='logo.jpg'">
        <div>
          <div style="font-weight: 700;">${ch.name}</div>
          <div style="font-size: 0.75rem; color: var(--red-bright);">${ch.category}</div>
        </div>
      </div>
      <div class="admin-item-actions">
        <button class="btn-secondary focusable" onclick="moveChannelUp(${index})" ${index === 0 ? 'disabled style="opacity:0.3;"' : ''}>▲</button>
        <button class="btn-secondary focusable" onclick="moveChannelDown(${index})" ${index === channelsList.length - 1 ? 'disabled style="opacity:0.3;"' : ''}>▼</button>
        <button class="btn-secondary focusable" onclick="editChannel('${ch.id}')">✏️</button>
        <button class="btn-danger focusable" onclick="deleteChannel('${ch.id}')">🗑️</button>
      </div>
    </div>
  `).join('');

  const btnAdd = document.getElementById('btn-add-channel');
  if (btnAdd) btnAdd.onclick = () => openChannelModal();

  const btnImport = document.getElementById('btn-import-m3u');
  if (btnImport) btnImport.onclick = () => syncM3UChannels(true);

  const btnReset = document.getElementById('btn-reset-default');
  if (btnReset) {
    btnReset.onclick = () => {
      if (confirm('¿Restablecer canales a la lista M3U por defecto?')) {
        currentM3uUrl = DEFAULT_M3U_URL;
        localStorage.setItem(M3U_URL_KEY, DEFAULT_M3U_URL);
        channelsList = [...DEFAULT_CHANNELS];
        saveChannels();
        syncM3UChannels(true);
        renderAdminChannelList();
      }
    };
  }
}

window.moveChannelUp = function(index) {
  if (index <= 0) return;
  const temp = channelsList[index];
  channelsList[index] = channelsList[index - 1];
  channelsList[index - 1] = temp;
  saveChannels();
  renderAdminChannelList();
  updateCategoryState();
  renderChannels();
};

window.moveChannelDown = function(index) {
  if (index >= channelsList.length - 1) return;
  const temp = channelsList[index];
  channelsList[index] = channelsList[index + 1];
  channelsList[index + 1] = temp;
  saveChannels();
  renderAdminChannelList();
  updateCategoryState();
  renderChannels();
};

function openChannelModal(channelToEdit = null) {
  const modalTitle = document.getElementById('channel-modal-title');
  const nameInput = document.getElementById('ch-name-input');
  const catInput = document.getElementById('ch-cat-input');
  const urlInput = document.getElementById('ch-url-input');
  const logoInput = document.getElementById('ch-logo-input');
  const editIdInput = document.getElementById('ch-edit-id');

  if (channelToEdit) {
    modalTitle.textContent = "Modificar Canal IPTV";
    nameInput.value = channelToEdit.name;
    catInput.value = channelToEdit.category;
    urlInput.value = channelToEdit.url;
    logoInput.value = channelToEdit.logo;
    editIdInput.value = channelToEdit.id;
  } else {
    modalTitle.textContent = "Agregar Nuevo Canal IPTV";
    nameInput.value = '';
    catInput.value = 'LOCALES';
    urlInput.value = '';
    logoInput.value = '';
    editIdInput.value = '';
  }

  channelModal.classList.add('active');
  setTimeout(() => nameInput.focus(), 100);

  document.getElementById('channel-form').onsubmit = (e) => {
    e.preventDefault();
    const id = editIdInput.value;
    const name = nameInput.value.trim();
    const category = catInput.value.trim().toUpperCase();
    const url = urlInput.value.trim();
    const logo = logoInput.value.trim() || 'logo.jpg';

    if (id) {
      const index = channelsList.findIndex(c => c.id === id);
      if (index !== -1) {
        channelsList[index] = { ...channelsList[index], name, category, url, logo };
      }
    } else {
      const newCh = {
        id: 'ch-custom-' + Date.now(),
        name,
        category,
        url,
        logo
      };
      channelsList.unshift(newCh);
    }

    saveChannels();
    channelModal.classList.remove('active');
    renderAdminChannelList();
    updateCategoryState();
    renderChannels();
  };
}

window.editChannel = function(id) {
  const ch = channelsList.find(c => c.id === id);
  if (ch) openChannelModal(ch);
};

window.deleteChannel = function(id) {
  if (confirm('¿Seguro que deseas eliminar este canal?')) {
    channelsList = channelsList.filter(c => c.id !== id);
    saveChannels();
    renderAdminChannelList();
    updateCategoryState();
    renderChannels();
  }
};

/* ==========================================================================
   NAVEGACIÓN POR TECLADO / CONTROL REMOTO (ANDROID TV D-PAD)
   ========================================================================== */

/* ==========================================================================
   MOTOR DE NAVEGACIÓN ESPACIAL D-PAD PARA CONTROL REMOTO (ANDROID TV)
   ========================================================================== */

function setupTVNavigation() {
  document.addEventListener('keydown', (e) => {
    // Código de teclas de Control Remoto de Televisores (Android TV / WebOS / Tizen)
    const key = e.key;
    const keyCode = e.keyCode;

    const isUp = key === 'ArrowUp' || key === 'w' || key === 'W' || keyCode === 38 || keyCode === 33 || keyCode === 427;
    const isDown = key === 'ArrowDown' || key === 's' || key === 'S' || keyCode === 40 || keyCode === 34 || keyCode === 428;
    const isLeft = key === 'ArrowLeft' || key === 'a' || key === 'A' || keyCode === 37;
    const isRight = key === 'ArrowRight' || key === 'd' || key === 'D' || keyCode === 39;
    const isEnter = key === 'Enter' || key === ' ' || keyCode === 13 || keyCode === 32 || keyCode === 29443 || keyCode === 65385;
    const isBack = key === 'Escape' || key === 'Backspace' || key === 'BrowserBack' || key === 'x' || key === 'X' || keyCode === 27 || keyCode === 8 || keyCode === 461 || keyCode === 10009 || keyCode === 88;

    if (!isUp && !isDown && !isLeft && !isRight && !isEnter && !isBack) return;

    const activeModal = document.querySelector('.modal-backdrop.active');
    
    // -------------------------------------------------------------
    // MANEJO DE TECLA ATRÁS (JERARQUÍA Y CIERRES DE PANTALLA EN TV)
    // -------------------------------------------------------------
    if (isBack) {
      e.preventDefault();
      
      // 1. Si hay un Modal activo, cerrarlo
      if (activeModal) {
        closeAllModals();
        setInitialTVFocus();
        return;
      }

      // 2. Si el cuadro de búsqueda está abierto, cerrarlo
      const searchBox = document.getElementById('search-box-container');
      if (searchBox && !searchBox.classList.contains('hidden')) {
        searchBox.classList.add('hidden');
        setInitialTVFocus();
        return;
      }

      // 3. Si el reproductor está en Pantalla Completa, salir
      if (document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement) {
        toggleFullscreen();
        return;
      }

      // 4. Si el foco está en los controles del reproductor, regresar a la tarjeta activa de canal
      const muteBtn = document.getElementById('btn-mute');
      const fullscreenBtn = document.getElementById('btn-fullscreen');
      if (document.activeElement === muteBtn || document.activeElement === fullscreenBtn) {
        setInitialTVFocus();
        return;
      }

      // 5. Si está en la lista de canales, mover foco a las flechas de categoría
      const catBtn = document.getElementById('cat-prev-btn');
      if (catBtn && document.activeElement && document.activeElement.classList.contains('channel-card')) {
        catBtn.focus();
        return;
      }
      return;
    }

    // -------------------------------------------------------------
    // MANEJO DE TECLA ENTER / OK EN CONTROL REMOTO
    // -------------------------------------------------------------
    if (isEnter) {
      const activeEl = document.activeElement;

      // Permitir la ejecución estándar de click para botones y campos nativos
      if (activeEl && (activeEl.tagName === 'BUTTON' || activeEl.tagName === 'INPUT' || activeEl.tagName === 'SELECT' || activeEl.tagName === 'TEXTAREA')) {
        return; 
      }

      if (activeEl && activeEl.classList.contains('channel-card')) {
        e.preventDefault();
        activeEl.click();
        return;
      }

      if (activeEl === videoElement || activeEl === iframeElement) {
        e.preventDefault();
        toggleFullscreen();
        return;
      }
    }

    // -------------------------------------------------------------
    // NAVEGACIÓN ESPACIAL 2D D-PAD (UP / DOWN / LEFT / RIGHT)
    // -------------------------------------------------------------
    e.preventDefault();

    // Obtener la lista de elementos enfocables disponibles según el contexto
    let focusableScope = [];
    if (activeModal) {
      focusableScope = Array.from(activeModal.querySelectorAll('.focusable, button, input, select, textarea'));
    } else {
      focusableScope = Array.from(document.querySelectorAll('.app-header .focusable, .channels-column .focusable, .player-column .focusable, .channel-card'));
    }

    // Filtrar únicamente los elementos visibles en pantalla
    focusableScope = focusableScope.filter(el => {
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden';
    });

    if (focusableScope.length === 0) return;

    let current = document.activeElement;

    // Si nada está enfocado o el foco se perdió, asignar foco inicial
    if (!current || !focusableScope.includes(current)) {
      setInitialTVFocus();
      return;
    }

    // Navegación rápida entre categorías con flechas izquierda/derecha desde las flechas
    if (current.id === 'cat-prev-btn' && isLeft) {
      prevCategory();
      return;
    }
    if (current.id === 'cat-next-btn' && isRight) {
      nextCategory();
      return;
    }

    // NAVEGACIÓN ESPACIAL 2D (Algoritmo de vecino más cercano por geometría)
    const currentRect = current.getBoundingClientRect();
    let bestCandidate = null;
    let minDistance = Infinity;

    focusableScope.forEach(cand => {
      if (cand === current) return;
      const candRect = cand.getBoundingClientRect();

      let isCandidateInDirection = false;
      let primaryDiff = 0;
      let secondaryDiff = 0;

      if (isUp) {
        isCandidateInDirection = candRect.bottom <= currentRect.top + 8;
        primaryDiff = currentRect.top - candRect.bottom;
        secondaryDiff = Math.abs((currentRect.left + currentRect.width / 2) - (candRect.left + candRect.width / 2));
      } else if (isDown) {
        isCandidateInDirection = candRect.top >= currentRect.bottom - 8;
        primaryDiff = candRect.top - currentRect.bottom;
        secondaryDiff = Math.abs((currentRect.left + currentRect.width / 2) - (candRect.left + candRect.width / 2));
      } else if (isLeft) {
        isCandidateInDirection = candRect.right <= currentRect.left + 8;
        primaryDiff = currentRect.left - candRect.right;
        secondaryDiff = Math.abs((currentRect.top + currentRect.height / 2) - (candRect.top + candRect.height / 2));
      } else if (isRight) {
        isCandidateInDirection = candRect.left >= currentRect.right - 8;
        primaryDiff = candRect.left - currentRect.right;
        secondaryDiff = Math.abs((currentRect.top + currentRect.height / 2) - (candRect.top + candRect.height / 2));
      }

      if (isCandidateInDirection) {
        const distance = primaryDiff + secondaryDiff * 2.5;
        if (distance < minDistance) {
          minDistance = distance;
          bestCandidate = cand;
        }
      }
    });

    if (bestCandidate) {
      bestCandidate.focus();
      bestCandidate.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
    }
  });
}

function copyToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      showNotificationToast('🔗 ¡Enlace del sistema copiado al portapapeles!');
    }).catch(() => {
      showNotificationToast('🔗 Enlace: ' + text);
    });
  } else {
    showNotificationToast('🔗 Enlace: ' + text);
  }
}

function showNotificationToast(message) {
  const toast = document.getElementById('toast-notification');
  if (!toast) return;

  toast.innerHTML = message;
  toast.classList.add('show');

  setTimeout(() => {
    toast.classList.remove('show');
  }, 4000);
}
