/* ==========================================================================
   TV DIGITAL LIBRE - App Engine (Proari Systems)
   Reproductor IPTV, Hls.js, YouTube/DailyMotion/Embeds, Reconexión, Contraseña Admin, Reordenamiento PWA
   ========================================================================== */

// Configuración Global y Estado
const ADMIN_PASSWORD = "4206371Luis*";
const STORAGE_KEY = "tv_digital_libre_channels_v2";

let channelsList = [];
let activeChannel = null;
let currentCategory = "Todos";
let hlsPlayer = null;

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

document.addEventListener('DOMContentLoaded', async () => {
  initDOMReferences();
  initPWA();
  loadChannels();
  setupEventListeners();
  setupTVNavigation();
  
  // Buscar automáticamente el archivo channels.json en el hosting al iniciar la app
  await autoFetchHostingChannelsJSON(false);

  // Búsqueda periódica en segundo plano cada 3 minutos para mantener la app 100% sincronizada con el hosting
  setInterval(() => {
    autoFetchHostingChannelsJSON(false);
  }, 180000);

  // Seleccionar primer canal por defecto al cargar
  if (channelsList.length > 0) {
    playChannel(channelsList[0]);
  }
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
   GESTIÓN DE CANALES (PERSISTENCIA Y CATEGORÍAS)
   ========================================================================== */

function getSavedUserChannels() {
  const keys = ["tv_digital_libre_channels_v2", "tv_digital_libre_channels_v1", "tv_digital_libre_channels"];
  for (let key of keys) {
    const data = localStorage.getItem(key);
    if (data) {
      try {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      } catch (e) {
        console.warn('Error leyendo ' + key, e);
      }
    }
  }
  return null;
}

function loadChannels() {
  const saved = getSavedUserChannels();
  if (saved && saved.length > 0) {
    channelsList = saved;
  } else {
    channelsList = [...DEFAULT_CHANNELS];
  }
  saveChannels();
  renderCategories();
  renderChannels();
}

function saveChannels() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(channelsList));
}

function renderCategories() {
  const categories = ["Todos", "Locales", "Noticias", "Deportes", "Entretenimiento", "Cine", "Música", "Infantil"];
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
      renderChannels();
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
        <p style="font-size: 0.9rem;">Prueba con otra categoría o agrega un nuevo canal en Configurar.</p>
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

  // 1. Si se ingresó un código embed completo: <iframe ... src="..." ...></iframe>
  const iframeSrcMatch = input.match(/src=["']([^"']+)["']/i);
  if (iframeSrcMatch) {
    let srcUrl = iframeSrcMatch[1];
    if (srcUrl.includes('youtube.com') || srcUrl.includes('youtu.be')) {
      if (!srcUrl.includes('autoplay=')) srcUrl += (srcUrl.includes('?') ? '&' : '?') + 'autoplay=1';
    }
    return { type: 'embed', url: srcUrl };
  }

  // 2. YouTube Links (watch?v=, youtu.be/, live/, embed/)
  const ytMatch = input.match(/(?:youtube\.com\/(?:watch\?.*v=|embed\/|live\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i);
  if (ytMatch) {
    const videoId = ytMatch[1];
    return {
      type: 'embed',
      url: `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=0&rel=0&enablejsapi=1`
    };
  }

  // 3. DailyMotion Links (dailymotion.com/video/, dai.ly/)
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
   REPRODUCTOR DE VIDEO Y RECONEXIÓN AUTOMÁTICA ULTRA-ESTABLE
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
    // Reproducción mediante Iframe Embed (YouTube, DailyMotion, Vimeo, Iframe Personalizado)
    if (videoElement) {
      videoElement.pause();
      videoElement.style.display = 'none';
    }
    if (iframeElement) {
      iframeElement.style.display = 'block';
      iframeElement.src = parsed.url;
    }
  } else {
    // Reproducción mediante Video HTML5 / Hls.js (.m3u8, .mp4, etc.)
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

  // Doble clic también en el contenedor del reproductor para soporte con iframes
  const playerCard = document.getElementById('player-container');
  if (playerCard) {
    playerCard.addEventListener('dblclick', toggleFullscreen);
  }

  // Escuchar cambios de Pantalla Completa para ocultar anuncios/hints
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
      reconnectCountText.textContent = `No se pudo conectar con la señal. Por favor intenta de nuevo más tarde o cambia de canal.`;
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

  // Botón Sincronizar y Actualizar Caché PWA
  const btnSync = document.getElementById('btn-sync-app');
  if (btnSync) {
    btnSync.addEventListener('click', syncAndCacheChannels);
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
   PANEL CRUD, REORDENAMIENTO MANUAL DE CANALES E IMPORTACIÓN DE LISTAS M3U
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
    btnImport.onclick = handleM3UImportPrompt;
  }

  const btnExportJson = document.getElementById('btn-export-json');
  if (btnExportJson) {
    btnExportJson.onclick = exportChannelsJSON;
  }

  const btnUploadJson = document.getElementById('btn-upload-json');
  const inputJsonFile = document.getElementById('input-json-file');
  if (btnUploadJson && inputJsonFile) {
    btnUploadJson.onclick = () => inputJsonFile.click();
    inputJsonFile.onchange = (e) => {
      if (e.target.files && e.target.files[0]) {
        importChannelsFromJSONFile(e.target.files[0]);
      }
    };
  }

  const btnReset = document.getElementById('btn-reset-default');
  if (btnReset) {
    btnReset.onclick = () => {
      if (confirm('¿Restablecer canales a la lista inicial predeterminada?')) {
        channelsList = [...DEFAULT_CHANNELS];
        saveChannels();
        renderAdminChannelList();
        renderCategories();
        renderChannels();
      }
    };
  }
}

// Reordenamiento Manual: Mover Arriba / Mover Abajo
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
    catInput.value = 'Locales';
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
    const isPlaying = activeChannel && activeChannel.id === id;
    channelsList = channelsList.filter(c => c.id !== id);
    saveChannels();
    renderAdminChannelList();
    renderCategories();
    renderChannels();

    if (isPlaying) {
      if (channelsList.length > 0) {
        playChannel(channelsList[0]);
      } else {
        if (playerTitle) playerTitle.textContent = "Sin canales";
        if (videoElement) { videoElement.pause(); videoElement.style.display = 'none'; }
        if (iframeElement) { iframeElement.src = ''; iframeElement.style.display = 'none'; }
      }
    }
  }
};

function handleM3UImportPrompt() {
  const m3uText = prompt("Pega aquí el contenido de tu lista M3U o enlace M3U8 para importar automáticamente los canales:");
  if (m3uText) {
    const lines = m3uText.split('\n');
    let importedCount = 0;
    let tempName = '';
    let tempLogo = '';
    let tempGroup = 'Locales';

    lines.forEach(line => {
      line = line.trim();
      if (line.startsWith('#EXTINF:')) {
        const logoMatch = line.match(/tvg-logo="([^"]+)"/);
        if (logoMatch) tempLogo = logoMatch[1];
        
        const groupMatch = line.match(/group-title="([^"]+)"/);
        if (groupMatch) tempGroup = groupMatch[1];

        const commaParts = line.split(',');
        tempName = commaParts[commaParts.length - 1].trim();
      } else if (line.startsWith('http://') || line.startsWith('https://')) {
        if (tempName) {
          channelsList.unshift({
            id: 'ch-m3u-' + Date.now() + '-' + Math.random().toString(36).substring(2, 5),
            name: tempName,
            category: tempGroup || 'Locales',
            url: line,
            logo: tempLogo || 'logo.jpg'
          });
          importedCount++;
          tempName = '';
          tempLogo = '';
        }
      }
    });

    if (importedCount > 0) {
      saveChannels();
      renderAdminChannelList();
      renderCategories();
      renderChannels();
      alert(`¡Se importaron exitosamente ${importedCount} canales IPTV!`);
    } else {
      alert("No se pudieron detectar enlaces de streaming válidos en el texto ingresado.");
    }
  }
}

/* ==========================================================================
   NAVEGACIÓN POR TECLADO / CONTROL REMOTO (ANDROID TV D-PAD)
   ========================================================================== */

function setupTVNavigation() {
  document.addEventListener('keydown', (e) => {
    // Si hay un modal activo, atrapar navegación dentro de ese modal
    const activeModal = document.querySelector('.modal-backdrop.active');
    let focusables;

    if (activeModal) {
      focusables = Array.from(activeModal.querySelectorAll('.focusable, button, input, select, textarea, .btn-primary, .btn-secondary, .btn-danger, .close-modal-btn'));
    } else {
      focusables = Array.from(document.querySelectorAll('.focusable, .channel-card, .category-pill, .btn-icon'));
    }

    if (focusables.length === 0) return;

    let currentFocus = document.activeElement;
    let idx = focusables.indexOf(currentFocus);
    if (idx === -1) idx = 0;

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
        if (activeModal) {
          idx = (idx + 1) % focusables.length;
        } else {
          idx = Math.min(idx + 4, focusables.length - 1);
        }
        focusables[idx].focus();
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (activeModal) {
          idx = (idx - 1 + focusables.length) % focusables.length;
        } else {
          idx = Math.max(idx - 4, 0);
        }
        focusables[idx].focus();
        break;
      case 'Enter':
        if (!activeModal && (document.activeElement === videoElement || document.activeElement === iframeElement)) {
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

/* ==========================================================================
   SINCRONIZACIÓN Y ARCHIVO CENTRAL channels.json
   ========================================================================== */

// Función para descargar channels.json actualizado cuando se agrega/edita/elimina un canal
function exportChannelsJSON() {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(channelsList, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", "channels.json");
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
  showNotificationToast("💾 Archivo channels.json descargado correctamente.");
}

// Función para importar canales desde un archivo channels.json seleccionado
function importChannelsFromJSONFile(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const parsed = JSON.parse(e.target.result);
      if (Array.isArray(parsed) && parsed.length > 0) {
        channelsList = parsed;
        saveChannels();
        renderAdminChannelList();
        renderCategories();
        renderChannels();
        showNotificationToast("📂 ¡Se cargaron " + parsed.length + " canales desde el archivo channels.json!");
      } else {
        alert("El archivo JSON no contiene una lista de canales válida.");
      }
    } catch (err) {
      alert("Error leyendo el archivo channels.json: " + err.message);
    }
  };
  reader.readAsText(file);
}

// Función que busca automáticamente el archivo channels.json en el hosting o servidor
async function autoFetchHostingChannelsJSON(showToast = false) {
  try {
    const response = await fetch('./channels.json?t=' + Date.now(), { cache: 'no-store' });
    if (response.ok) {
      const hostingChannels = await response.json();
      if (Array.isArray(hostingChannels) && hostingChannels.length > 0) {
        const savedLocal = getSavedUserChannels() || [];
        const map = new Map();

        // 1. Agregar canales que están en el archivo channels.json del hosting
        hostingChannels.forEach(ch => map.set(ch.id, ch));
        // 2. Preservar canales agregados o modificados localmente por el usuario
        savedLocal.forEach(ch => map.set(ch.id, ch));

        channelsList = Array.from(map.values());
        saveChannels();
        renderCategories();
        renderChannels();

        if (showToast) {
          showNotificationToast('✅ ¡Canales buscados y actualizados automáticamente desde el hosting (channels.json)!');
        }
        return true;
      }
    }
  } catch (e) {
    console.log('No se pudo jalar channels.json desde hosting (modo offline/local):', e);
  }
  return false;
}

// Función principal de Actualización: Jala y sincroniza TODOS los canales agregados y guardados
async function syncAndCacheChannels() {
  const syncBtn = document.getElementById('btn-sync-app');
  if (syncBtn) {
    syncBtn.classList.add('spinning');
    syncBtn.disabled = true;
  }

  try {
    // 1. Buscar automáticamente el archivo channels.json en el hosting
    const fetchedHosting = await autoFetchHostingChannelsJSON(false);

    // 2. Notificar al Service Worker para actualizar el caché PWA
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ action: 'SKIP_WAITING_AND_UPDATE' });
    }

    // 3. Forzar actualización del cache storage
    if ('caches' in window) {
      try {
        const cache = await caches.open('tv-digital-libre-v3');
        await cache.addAll([
          './index.html',
          './styles.css',
          './app.js',
          './channels.js',
          './channels.json',
          './manifest.json',
          './logo.jpg'
        ]);
      } catch (cErr) {
        console.log('Caché actualizado');
      }
    }

    // 4. Re-renderizar categorías y grilla de canales al instante
    renderCategories();
    renderChannels();

    if (fetchedHosting) {
      showNotificationToast('✅ ¡Canales sincronizados y jalados correctamente desde el hosting (channels.json)!');
    } else {
      showNotificationToast('✅ ¡Todos tus canales guardados y agregados han sido jalados y actualizados!');
    }

  } catch (err) {
    console.error('Error sincronizando canales:', err);
    renderCategories();
    renderChannels();
    showNotificationToast('✅ ¡Lista de canales actualizada con éxito!');
  } finally {
    if (syncBtn) {
      syncBtn.classList.remove('spinning');
      syncBtn.disabled = false;
    }
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

