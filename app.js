/* ==========================================================================
   TV DIGITAL LIBRE - App Engine (Proari Systems)
   Reproductor IPTV, Hls.js, YouTube/DailyMotion/Embeds, Reconexión,
   Sincronización M3U Automática en Tiempo Real (Dropbox Pando), PWA
   ========================================================================== */

// Configuración Global y Estado
const ADMIN_PASSWORD = "4206371Luis*";
const STORAGE_KEY = "tv_digital_libre_channels_v3";
const M3U_URL_KEY = "tv_digital_libre_m3u_url_v3";

let channelsList = [];
let activeChannel = null;
let currentCategory = "Todos";
let hlsPlayer = null;

let currentM3uUrl = localStorage.getItem(M3U_URL_KEY) || DEFAULT_M3U_URL;
let autoSyncTimer = null;

// Control de Reconexión Automática
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
let reconnectTimer = null;
let isReconnecting = false;

// Registro PWA Install Prompt
let deferredPrompt = null;

// DOM Elements
let videoElement, iframeElement, playerTitle, playerCategory, playerLogo, liveBadge, reconnectOverlay, reconnectCountText;
let channelsGrid, categoryContainer, searchInput;
let authModal, adminModal, channelModal, passwordInput, authErrorMsg;

document.addEventListener('DOMContentLoaded', () => {
  initDOMReferences();
  initPWA();
  loadChannels();
  setupEventListeners();
  setupTVNavigation();
});

/* ==========================================================================
   INICIALIZACIÓN DE REFERENCIAS DOM Y PWA
   ========================================================================== */

function initDOMReferences() {
  videoElement = document.getElementById('video-player');
  iframeElement = document.getElementById('iframe-player');

  playerTitle = document.getElementById('player-channel-title');
  playerCategory = document.getElementById('player-channel-category');
  playerLogo = document.getElementById('player-channel-logo');
  liveBadge = document.getElementById('live-badge');
  reconnectOverlay = document.getElementById('reconnect-overlay');
  reconnectCountText = document.getElementById('reconnect-count-text');

  channelsGrid = document.getElementById('channels-grid');
  categoryContainer = document.getElementById('categories-container');
  searchInput = document.getElementById('search-input');

  authModal = document.getElementById('auth-modal');
  adminModal = document.getElementById('admin-modal');
  channelModal = document.getElementById('channel-modal');
  passwordInput = document.getElementById('admin-password-input');
  authErrorMsg = document.getElementById('auth-error-msg');
}

function initPWA() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('[PWA] Service Worker registrado exitosamente:', reg.scope))
      .catch(err => console.warn('[PWA] Error registrando Service Worker:', err));
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    const installBtn = document.getElementById('btn-pwa-install');
    if (installBtn) {
      installBtn.style.display = 'flex';
      installBtn.addEventListener('click', () => {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then((choiceResult) => {
          if (choiceResult.outcome === 'accepted') {
            console.log('[PWA] El usuario instaló la aplicación');
          }
          deferredPrompt = null;
          installBtn.style.display = 'none';
        });
      });
    }
  });
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
  
  renderCategories();
  renderChannels();

  // Seleccionar primer canal automáticamente
  if (channelsList.length > 0 && !activeChannel) {
    playChannel(channelsList[0]);
  }

  // Sincronización automática de canales al iniciar
  syncM3UChannels(false);

  // Iniciar temporizador de sincronización en tiempo real (cada 60 segundos)
  if (autoSyncTimer) clearInterval(autoSyncTimer);
  autoSyncTimer = setInterval(() => {
    console.log('[Auto-Sync] Actualizando lista M3U en tiempo real...');
    syncM3UChannels(false);
  }, 60000);
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
      if (text.includes('#EXTINF') || text.includes('#EXTM3U')) {
        return text;
      }
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
      if (text.includes('#EXTINF') || text.includes('#EXTM3U')) {
        return text;
      }
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
      if (text.includes('#EXTINF') || text.includes('#EXTM3U')) {
        return text;
      }
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
        renderCategories();
        renderChannels();

        // Si no hay canal activo o el canal activo ya no está, reproducir el primero
        if (!activeChannel || !channelsList.some(c => c.id === activeChannel.id)) {
          if (channelsList.length > 0) {
            playChannel(channelsList[0]);
          }
        }

        if (showToast) {
          showNotificationToast(`✅ Sincronizados ${parsed.length} canales en tiempo real desde M3U`);
        }
        console.log(`[M3U Sync] Éxito: ${parsed.length} canales actualizados.`);
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
   RENDERIZADO DE CATEGORÍAS Y CANALES
   ========================================================================== */

function renderCategories() {
  const categoriesSet = new Set(["Todos"]);
  channelsList.forEach(ch => {
    if (ch.category && ch.category.trim()) {
      categoriesSet.add(ch.category.trim());
    }
  });

  const categories = Array.from(categoriesSet);

  if (!categories.includes(currentCategory)) {
    currentCategory = "Todos";
  }

  categoryContainer.innerHTML = categories.map(cat => `
    <button class="category-pill focusable ${cat === currentCategory ? 'active' : ''}" data-category="${cat}">
      ${cat}
    </button>
  `).join('');

  categoryContainer.querySelectorAll('.category-pill').forEach(btn => {
    btn.addEventListener('click', (e) => {
      currentCategory = e.target.dataset.category;
      document.querySelectorAll('.category-pill').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      renderChannels(searchInput ? searchInput.value : '');
    });
  });
}

function renderChannels(filterText = '') {
  const filtered = channelsList.filter(ch => {
    const matchesCat = (currentCategory === "Todos") || (ch.category.toLowerCase() === currentCategory.toLowerCase());
    const matchesSearch = filterText === '' || ch.name.toLowerCase().includes(filterText.toLowerCase());
    return matchesCat && matchesSearch;
  });

  if (filtered.length === 0) {
    channelsGrid.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: var(--text-muted);">
        <p style="font-size: 1.2rem; font-weight: 600;">No se encontraron canales</p>
        <p style="font-size: 0.9rem;">Prueba con otra categoría o presiona "Actualizar" para refrescar la lista M3U.</p>
      </div>
    `;
    return;
  }

  channelsGrid.innerHTML = filtered.map(ch => `
    <div class="channel-card focusable ${activeChannel && activeChannel.id === ch.id ? 'active' : ''}" data-id="${ch.id}">
      <div class="channel-logo-wrapper">
        <img class="channel-logo-img" src="${ch.logo}" alt="${ch.name}" onerror="this.src='logo.jpg'">
      </div>
      <div class="channel-name">${ch.name}</div>
      <div class="channel-category-tag">${ch.category}</div>
    </div>
  `).join('');

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
   PARSER DE EMBEDS (YOUTUBE, DAILYMOTION, IFRAME CODES, DIRECT STREAMS)
   ========================================================================== */

function parseEmbedOrStreamUrl(input) {
  if (!input) return { type: 'video', url: '' };
  input = input.trim();

  // 1. Código embed completo: <iframe ... src="..." ...></iframe>
  const iframeSrcMatch = input.match(/src=["']([^"']+)["']/i);
  if (iframeSrcMatch) {
    let srcUrl = iframeSrcMatch[1];
    if (srcUrl.includes('youtube.com') || srcUrl.includes('youtu.be')) {
      if (!srcUrl.includes('autoplay=')) srcUrl += (srcUrl.includes('?') ? '&' : '?') + 'autoplay=1';
    }
    return { type: 'embed', url: srcUrl };
  }

  // 2. YouTube Links
  const ytMatch = input.match(/(?:youtube\.com\/(?:watch\?.*v=|embed\/|live\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i);
  if (ytMatch) {
    const videoId = ytMatch[1];
    return {
      type: 'embed',
      url: `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=0&rel=0&enablejsapi=1`
    };
  }

  // 3. DailyMotion Links
  const dmMatch = input.match(/(?:dailymotion\.com\/video\/|dai\.ly\/)([a-zA-Z0-9]+)/i);
  if (dmMatch) {
    const videoId = dmMatch[1];
    return {
      type: 'embed',
      url: `https://www.dailymotion.com/embed/video/${videoId}?autoplay=1`
    };
  }

  // 4. Vimeo Links
  const vimeoMatch = input.match(/vimeo\.com\/(?:video\/)?([0-9]+)/i);
  if (vimeoMatch) {
    return {
      type: 'embed',
      url: `https://player.vimeo.com/video/${vimeoMatch[1]}?autoplay=1`
    };
  }

  // 5. Embed direct iframe URLs
  if (input.includes('/embed/') || input.includes('player.')) {
    return { type: 'embed', url: input };
  }

  // 6. Transmisión directa por video HTML5 / Hls.js (.m3u8, .mp4, .ts, etc.)
  return { type: 'video', url: input };
}

/* ==========================================================================
   REPRODUCTOR DE VIDEO Y RECONEXIÓN AUTOMÁTICA
   ========================================================================== */

function playChannel(channel) {
  activeChannel = channel;
  reconnectAttempts = 0;
  hideReconnectOverlay();

  if (playerTitle) playerTitle.textContent = channel.name;
  if (playerCategory) playerCategory.textContent = channel.category;
  if (playerLogo) playerLogo.src = channel.logo;

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
        videoElement.play().catch(err => console.log('Autoplay bloqueado por el navegador:', err));
      });

      hlsPlayer.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.warn('Error de red HLS. Iniciando reconexión automática...');
              triggerAutoReconnect();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.warn('Error de medio HLS. Recuperando buffer...');
              hlsPlayer.recoverMediaError();
              break;
            default:
              console.error('Error fatal no recuperable en HLS. Reintentando señal...');
              triggerAutoReconnect();
              break;
          }
        }
      });

    } else {
      videoElement.src = url;
      videoElement.play().catch(err => console.log('Autoplay bloqueado:', err));
    }
  }

  renderChannels(searchInput ? searchInput.value : '');
}

function setupVideoEvents() {
  if (videoElement) {
    videoElement.addEventListener('error', () => {
      console.warn('Error nativo en reproductor de video. Activando reconexión...');
      triggerAutoReconnect();
    });

    videoElement.addEventListener('stalled', () => {
      console.warn('Transmisión congelada (stalled). Verificando señal...');
      if (!isReconnecting) {
        triggerAutoReconnect();
      }
    });

    videoElement.addEventListener('dblclick', toggleFullscreen);

    let lastTap = 0;
    videoElement.addEventListener('touchend', (e) => {
      const currentTime = new Date().getTime();
      const tapLength = currentTime - lastTap;
      if (tapLength < 300 && tapLength > 0) {
        toggleFullscreen();
        e.preventDefault();
      }
      lastTap = currentTime;
    });
  }

  const playerCard = document.getElementById('player-container');
  if (playerCard) {
    playerCard.addEventListener('dblclick', toggleFullscreen);
  }

  const handleFullscreenState = () => {
    const isFS = !!(document.fullscreenElement || document.webkitFullscreenElement);
    if (playerCard) {
      if (isFS) {
        playerCard.classList.add('is-fullscreen');
      } else {
        playerCard.classList.remove('is-fullscreen');
      }
    }
  };

  document.addEventListener('fullscreenchange', handleFullscreenState);
  document.addEventListener('webkitfullscreenchange', handleFullscreenState);
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
    console.log(`[Reconexión] Reintentando conectar a ${activeChannel?.name} en ${delay / 1000}s...`);

    clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(() => {
      isReconnecting = false;
      if (activeChannel) {
        playChannel(activeChannel);
      }
    }, delay);
  } else {
    if (reconnectCountText) {
      reconnectCountText.textContent = `No se pudo conectar con la señal. Intenta de nuevo o cambia de canal.`;
    }
    setTimeout(() => {
      isReconnecting = false;
    }, 5000);
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
   AUTENTICACIÓN Y ADMINISTRACIÓN CON CONTRASEÑA (4206371Luis*)
   ========================================================================== */

function setupEventListeners() {
  setupVideoEvents();

  const btnConfig = document.getElementById('btn-config');
  if (btnConfig) {
    btnConfig.addEventListener('click', openAuthModal);
  }

  // Botón Sincronizar M3U en tiempo real desde Header
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

  const btnMute = document.getElementById('btn-mute');
  if (btnMute) {
    btnMute.addEventListener('click', () => {
      if (videoElement) {
        videoElement.muted = !videoElement.muted;
        btnMute.textContent = videoElement.muted ? '🔇 Unmute' : '🔊 Silenciar';
      }
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
        <span style="font-size: 0.8rem; font-weight: 800; color: var(--accent); min-width: 28px;">#${index + 1}</span>
        <img src="${ch.logo}" style="width: 32px; height: 32px; object-fit: contain;" onerror="this.src='logo.jpg'">
        <div>
          <div style="font-weight: 700;">${ch.name}</div>
          <div style="font-size: 0.75rem; color: var(--accent);">${ch.category}</div>
        </div>
      </div>
      <div class="admin-item-actions">
        <button class="btn-secondary" onclick="moveChannelUp(${index})" ${index === 0 ? 'disabled style="opacity:0.3;"' : ''} title="Subir Posición">▲ Subir</button>
        <button class="btn-secondary" onclick="moveChannelDown(${index})" ${index === channelsList.length - 1 ? 'disabled style="opacity:0.3;"' : ''} title="Bajar Posición">▼ Bajar</button>
        <button class="btn-secondary" onclick="editChannel('${ch.id}')">✏️ Editar</button>
        <button class="btn-danger" onclick="deleteChannel('${ch.id}')">🗑️ Eliminar</button>
      </div>
    </div>
  `).join('');

  const btnAdd = document.getElementById('btn-add-channel');
  if (btnAdd) {
    btnAdd.onclick = () => openChannelModal();
  }

  const btnImport = document.getElementById('btn-import-m3u');
  if (btnImport) {
    btnImport.textContent = "📡 Sincronizar M3U en Vivo";
    btnImport.onclick = () => syncM3UChannels(true);
  }

  const btnReset = document.getElementById('btn-reset-default');
  if (btnReset) {
    btnReset.onclick = () => {
      if (confirm('¿Restablecer y volver a cargar los canales de la lista M3U por defecto?')) {
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

// Reordenamiento Manual
window.moveChannelUp = function(index) {
  if (index <= 0) return;
  const temp = channelsList[index];
  channelsList[index] = channelsList[index - 1];
  channelsList[index - 1] = temp;
  saveChannels();
  renderAdminChannelList();
  renderCategories();
  renderChannels();
};

window.moveChannelDown = function(index) {
  if (index >= channelsList.length - 1) return;
  const temp = channelsList[index];
  channelsList[index] = channelsList[index + 1];
  channelsList[index + 1] = temp;
  saveChannels();
  renderAdminChannelList();
  renderCategories();
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
    modalTitle.textContent = "Modificar Canal IPTV / Stream";
    nameInput.value = channelToEdit.name;
    catInput.value = channelToEdit.category;
    urlInput.value = channelToEdit.url;
    logoInput.value = channelToEdit.logo;
    editIdInput.value = channelToEdit.id;
  } else {
    modalTitle.textContent = "Agregar Nuevo Canal IPTV / Stream";
    nameInput.value = '';
    catInput.value = 'LOCALES';
    urlInput.value = '';
    logoInput.value = '';
    editIdInput.value = '';
  }

  channelModal.classList.add('active');

  document.getElementById('channel-form').onsubmit = (e) => {
    e.preventDefault();
    const id = editIdInput.value;
    const name = nameInput.value.trim();
    const category = catInput.value.trim();
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
    renderCategories();
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
    renderCategories();
    renderChannels();
  }
};

/* ==========================================================================
   NAVEGACIÓN POR TECLADO / CONTROL REMOTO (ANDROID TV D-PAD)
   ========================================================================== */

function setupTVNavigation() {
  document.addEventListener('keydown', (e) => {
    const focusables = Array.from(document.querySelectorAll('.focusable, .channel-card, .category-pill, .btn-icon'));
    if (focusables.length === 0) return;

    let currentFocus = document.activeElement;
    let idx = focusables.indexOf(currentFocus);

    switch (e.key) {
      case 'ArrowRight':
        e.preventDefault();
        idx = (idx + 1) % focusables.length;
        focusables[idx].focus();
        break;
      case 'ArrowLeft':
        e.preventDefault();
        idx = (idx - 1 + focusables.length) % focusables.length;
        focusables[idx].focus();
        break;
      case 'ArrowDown':
        e.preventDefault();
        idx = Math.min(idx + 4, focusables.length - 1);
        focusables[idx].focus();
        break;
      case 'ArrowUp':
        e.preventDefault();
        idx = Math.max(idx - 4, 0);
        focusables[idx].focus();
        break;
      case 'Enter':
        if (document.activeElement === videoElement || document.activeElement === iframeElement) {
          toggleFullscreen();
        }
        break;
      case 'Escape':
      case 'BackSpace':
        if (document.fullscreenElement) {
          toggleFullscreen();
        } else {
          closeAllModals();
        }
        break;
    }
  });
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
