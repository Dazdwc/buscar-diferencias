// ==========================================================================
// Juego de Buscar Diferencias - Motor de Juego
// ==========================================================================

let audioCtx = null;
let soundEnabled = true;

let isAdminMode = sessionStorage.getItem("buscar_diferencias_is_admin") === "true";
let activeLevels = [];

// Helper para calcular SHA-256 de forma asíncrona nativa
async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function updateAdminUI() {
  if (isAdminMode) {
    document.body.classList.add("admin-mode-active");
    const adminBtn = document.getElementById("btn-admin-access");
    if (adminBtn) {
      adminBtn.textContent = "🔓";
      adminBtn.title = "Cerrar sesión Admin (Modo: Administrador)";
    }
  } else {
    document.body.classList.remove("admin-mode-active");
    const adminBtn = document.getElementById("btn-admin-access");
    if (adminBtn) {
      adminBtn.textContent = "🔑";
      adminBtn.title = "Acceso Administrador (Modo: Jugador)";
    }
  }
}

function loadAllLevels() {
  let deletedBaseIds = [];
  const deletedSaved = localStorage.getItem("buscar_diferencias_deleted_base_levels");
  if (deletedSaved) {
    try {
      deletedBaseIds = JSON.parse(deletedSaved);
    } catch (e) {
      deletedBaseIds = [];
    }
  }

  activeLevels = GAME_LEVELS.filter(lvl => !deletedBaseIds.includes(lvl.id));

  const saved = localStorage.getItem("buscar_diferencias_custom_levels");
  if (saved) {
    try {
      const custom = JSON.parse(saved);
      custom.forEach(lvl => {
        lvl.isCustom = true;
      });
      activeLevels = [...activeLevels, ...custom];
    } catch (e) {
      console.error("Error loading custom levels:", e);
    }
  }
}

async function deleteLevel(levelId, isCustom) {
  if (isCustom) {
    let savedLevels = [];
    const saved = localStorage.getItem("buscar_diferencias_custom_levels");
    if (saved) {
      try {
        savedLevels = JSON.parse(saved);
      } catch (e) {
        savedLevels = [];
      }
    }
    savedLevels = savedLevels.filter(lvl => lvl.id !== levelId);
    localStorage.setItem("buscar_diferencias_custom_levels", JSON.stringify(savedLevels));
    
    try {
      await fetch('/api/custom-levels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(savedLevels)
      });
    } catch (e) {
      console.error("Error syncing deleted custom level to server:", e);
    }
  } else {
    let deletedBaseIds = [];
    const saved = localStorage.getItem("buscar_diferencias_deleted_base_levels");
    if (saved) {
      try {
        deletedBaseIds = JSON.parse(saved);
      } catch (e) {
        deletedBaseIds = [];
      }
    }
    if (!deletedBaseIds.includes(levelId)) {
      deletedBaseIds.push(levelId);
    }
    localStorage.setItem("buscar_diferencias_deleted_base_levels", JSON.stringify(deletedBaseIds));
    
    try {
      await fetch('/api/deleted-levels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(deletedBaseIds)
      });
    } catch (e) {
      console.error("Error syncing deleted base level to server:", e);
    }
  }
  
  GameState.completedLevels = GameState.completedLevels.filter(id => id !== levelId);
  GameState.saveProgress();
  
  loadAllLevels();
  renderLevelGrid();
}

async function resetEverything() {
  if (confirm("¿Quieres restablecer el juego al estado inicial? Esto restaurará todos los niveles iniciales y borrará tu progreso y niveles creados.")) {
    localStorage.removeItem("buscar_diferencias_deleted_base_levels");
    localStorage.removeItem("buscar_diferencias_custom_levels");
    
    try {
      await fetch('/api/custom-levels', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify([]) });
      await fetch('/api/deleted-levels', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify([]) });
    } catch (e) {
      console.error("Error resetting levels on server:", e);
    }

    GameState.resetProgress();
    loadAllLevels();
    renderLevelGrid();
    alert("¡Juego restablecido con éxito!");
  }
}

// Inicializa el contexto de audio solo tras interacción del usuario
function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

// Sonidos Sintetizados mediante Web Audio API
const SoundEffects = {
  playSuccess() {
    if (!soundEnabled) return;
    try {
      initAudio();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(350, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.15);
      
      gain.gain.setValueAtTime(0, audioCtx.currentTime);
      gain.gain.linearRampToValueAtTime(0.3, audioCtx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.18);
      
      osc.start();
      osc.stop(audioCtx.currentTime + 0.2);
    } catch (e) {
      console.warn("Audio error:", e);
    }
  },

  playError() {
    if (!soundEnabled) return;
    try {
      initAudio();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(140, audioCtx.currentTime);
      osc.frequency.linearRampToValueAtTime(85, audioCtx.currentTime + 0.25);
      
      gain.gain.setValueAtTime(0, audioCtx.currentTime);
      gain.gain.linearRampToValueAtTime(0.2, audioCtx.currentTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.25);
      
      osc.start();
      osc.stop(audioCtx.currentTime + 0.28);
    } catch (e) {
      console.warn("Audio error:", e);
    }
  },

  playWin() {
    if (!soundEnabled) return;
    try {
      initAudio();
      const now = audioCtx.currentTime;
      // Arpegio alegre: Do, Mi, Sol, Do (C4, E4, G4, C5)
      const arpeggio = [261.63, 329.63, 392.00, 523.25];
      
      arpeggio.forEach((freq, idx) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.08);
        
        gain.gain.setValueAtTime(0, now + idx * 0.08);
        gain.gain.linearRampToValueAtTime(0.25, now + idx * 0.08 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.01, now + idx * 0.08 + 0.2);
        
        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + 0.25);
      });
    } catch (e) {
      console.warn("Audio error:", e);
    }
  },

  playLevelComplete() {
    if (!soundEnabled) return;
    try {
      initAudio();
      const now = audioCtx.currentTime;
      // Fanfarria victoriosa larga
      const notes = [
        { freq: 261.63, time: 0, dur: 0.15 }, // C4
        { freq: 329.63, time: 0.15, dur: 0.15 }, // E4
        { freq: 392.00, time: 0.30, dur: 0.15 }, // G4
        { freq: 523.25, time: 0.45, dur: 0.35 }, // C5
        { freq: 392.00, time: 0.80, dur: 0.15 }, // G4
        { freq: 523.25, time: 0.95, dur: 0.60 }  // C5 (largo)
      ];
      
      notes.forEach(n => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(n.freq, now + n.time);
        
        gain.gain.setValueAtTime(0, now + n.time);
        gain.gain.linearRampToValueAtTime(0.2, now + n.time + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.01, now + n.time + n.dur);
        
        osc.start(now + n.time);
        osc.stop(now + n.time + n.dur);
      });
    } catch (e) {
      console.warn("Audio error:", e);
    }
  },

  playClick() {
    if (!soundEnabled) return;
    try {
      initAudio();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(600, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(200, audioCtx.currentTime + 0.05);
      
      gain.gain.setValueAtTime(0, audioCtx.currentTime);
      gain.gain.linearRampToValueAtTime(0.15, audioCtx.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.05);
      
      osc.start();
      osc.stop(audioCtx.currentTime + 0.06);
    } catch (e) {
      console.warn("Audio error:", e);
    }
  }
};

// ==========================================================================
// Estado del Juego
// ==========================================================================

const GameState = {
  currentLevel: null,
  foundDifferences: [],
  score: 0,
  lives: 3,
  timeLeft: 120, // 2 minutos por nivel
  timerInterval: null,
  isGameOver: false,
  completedLevels: [],
  
  loadProgress() {
    const saved = localStorage.getItem("buscar_diferencias_progress_completed");
    if (saved) {
      try {
        this.completedLevels = JSON.parse(saved);
      } catch (e) {
        this.completedLevels = [];
      }
    } else {
      // Migración desde progreso antiguo
      const oldSaved = localStorage.getItem("buscar_diferencias_progress");
      if (oldSaved) {
        try {
          const unlocked = JSON.parse(oldSaved);
          this.completedLevels = unlocked.filter(id => id !== Math.max(...unlocked));
        } catch (e) {
          this.completedLevels = [];
        }
      }
    }
  },

  saveProgress() {
    localStorage.setItem("buscar_diferencias_progress_completed", JSON.stringify(this.completedLevels));
  },

  markLevelCompleted(levelId) {
    if (!this.completedLevels.includes(levelId)) {
      this.completedLevels.push(levelId);
      this.saveProgress();
    }
  },

  resetProgress() {
    this.completedLevels = [];
    this.saveProgress();
  }
};

// ==========================================================================
// Mascota Reacciones ( emojis y textos )
// ==========================================================================

const Mascot = {
  element: null,
  bubbleElement: null,
  
  init() {
    this.element = document.getElementById("mascot");
    this.bubbleElement = document.getElementById("mascot-bubble-text");
  },

  say(text, emoji = "🐶") {
    if (this.bubbleElement) {
      this.bubbleElement.textContent = text;
    }
    if (this.element) {
      this.element.textContent = emoji;
      // Pequeño brinco al hablar
      this.element.style.animation = 'none';
      void this.element.offsetWidth; // trigger reflow
      this.element.style.animation = 'celebrate 0.5s ease 1 alternate';
    }
  },

  reactToSuccess(diff) {
    const emojis = ["🎉", "🌟", "🐶", "🎈", "🦊", "🐯"];
    const emoIdx = Math.floor(Math.random() * emojis.length);
    
    if (diff.message) {
      this.say(diff.message, emojis[emoIdx]);
    } else {
      const phrase = [
        `¡Súper! Encontraste: ${diff.hint}`,
        `¡Qué buena vista! Viste: ${diff.hint}`,
        `¡Excelente! Descubriste: ${diff.hint}`,
        `¡Eso es! Ahí estaba: ${diff.hint}`
      ];
      const idx = Math.floor(Math.random() * phrase.length);
      this.say(phrase[idx], emojis[emoIdx]);
    }
  },

  reactToError() {
    const emojis = ["😲", "🤔", "🧐", "🐕"];
    const phrase = [
      "¡Ay, ahí no hay nada diferente! Sigue buscando 🔍",
      "¡Casi! Pero esa parte es idéntica. ¡Mira más de cerca!",
      "¡Uy! Abre bien los ojos de detective y vuelve a intentar.",
      "¡Falsa alarma! Investiga otro rincón de la escena."
    ];
    const idx = Math.floor(Math.random() * phrase.length);
    const emoIdx = Math.floor(Math.random() * emojis.length);
    this.say(phrase[idx], emojis[emoIdx]);
  },

  reactToHint() {
    this.say("¡Shhh! Te he marcado una diferencia en la pantalla. ¡Toca el círculo rojo!", "🤫");
  },

  reactToLowTime() {
    this.say("¡Corre, corre! ¡Se acaba el tiempo de detective! ⏰", "😰");
  }
};

// ==========================================================================
// Lógica de Renderizado y Flujo
// ==========================================================================

async function syncWithServer() {
  try {
    const customRes = await fetch('/api/custom-levels');
    if (customRes.ok) {
      const customLevels = await customRes.json();
      localStorage.setItem("buscar_diferencias_custom_levels", JSON.stringify(customLevels));
    }
  } catch (e) {
    console.warn("Could not sync custom levels from server:", e);
  }

  try {
    const deletedRes = await fetch('/api/deleted-levels');
    if (deletedRes.ok) {
      const deletedLevels = await deletedRes.json();
      localStorage.setItem("buscar_diferencias_deleted_base_levels", JSON.stringify(deletedLevels));
    }
  } catch (e) {
    console.warn("Could not sync deleted levels from server:", e);
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  updateAdminUI();
  await syncWithServer();
  loadAllLevels();
  GameState.loadProgress();
  Mascot.init();
  showScreen("menu-screen");
  setupEventListeners();
  renderLevelGrid();
  
  // Inicializar Creador de Niveles
  LevelCreator.init();
  
  // Nubes de fondo móviles
  createBackgroundDecorations();
});

function showScreen(screenId) {
  if (screenId !== "game-screen") {
    clearInterval(GameState.timerInterval);
  }
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  const screen = document.getElementById(screenId);
  if (screen) {
    screen.classList.add("active");
  }
}

function createBackgroundDecorations() {
  const container = document.querySelector(".bg-decorations");
  if (!container) return;
  
  container.innerHTML = `
    <div class="cloud-decor c1">✨</div>
    <div class="cloud-decor c2">💖</div>
    <div class="cloud-decor c3">⭐</div>
  `;
}

// Genera la cuadrícula de niveles
function renderLevelGrid() {
  const grid = document.getElementById("levels-grid");
  if (!grid) return;
  grid.innerHTML = "";
  
  if (activeLevels.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 40px 20px; background: linear-gradient(135deg, rgba(35, 17, 65, 0.95), rgba(18, 9, 36, 0.95)); border: 4px solid var(--color-primary); border-radius: 30px; box-shadow: 0 0 15px rgba(255, 46, 147, 0.3), var(--bubble-shadow); margin-bottom: 20px; color: #ffffff;">
        <span style="font-size: 4rem; display: block; animation: celebrate 1s ease infinite alternate;">🔍</span>
        <h3 style="font-size: 2.2rem; margin-top: 15px; color: #ffffff; text-shadow: 0 0 10px rgba(255, 46, 147, 0.6);">¡No hay aventuras disponibles!</h3>
        <p style="font-size: 1.2rem; color: #bfaed8; margin-top: 10px;">
          ${isAdminMode ? 'Ve al menú principal y haz clic en <strong>CREAR NIVEL 🎨</strong> para añadir tu primera aventura.' : 'Pídele a un administrador (acceso en la cabecera 🔑) que configure niveles para poder jugar.'}
        </p>
      </div>
    `;
    return;
  }
  
  activeLevels.forEach(lvl => {
    // A level is unlocked if it has no requirements, or if the required level has been completed,
    // or if the required level itself has been deleted (and thus is no longer in activeLevels).
    const isUnlocked = !lvl.requiresLevelId || 
                       GameState.completedLevels.includes(lvl.requiresLevelId) ||
                       !activeLevels.some(l => l.id === lvl.requiresLevelId);
                       
    const card = document.createElement("div");
    card.className = `level-card ${isUnlocked ? '' : 'locked'}`;
    
    let difficultyClass = "diff-facil";
    if (lvl.difficulty === "Medio") difficultyClass = "diff-medio";
    if (lvl.difficulty === "Difícil") difficultyClass = "diff-dificil";

    const customBadge = lvl.isCustom ? `<span class="creator-card-badge">Creado 🎨</span>` : '';

    if (isUnlocked) {
      card.innerHTML = `
        ${customBadge}
        <span class="difficulty-badge ${difficultyClass}">${lvl.difficulty}</span>
        <h3>Nivel ${lvl.id}</h3>
        <p>${lvl.name}</p>
        <div class="stars">⭐ 5 Diferencias</div>
      `;
      card.addEventListener("click", () => {
        SoundEffects.playClick();
        startLevel(lvl.id);
      });
    } else {
      card.innerHTML = `
        ${customBadge}
        <span class="difficulty-badge ${difficultyClass}">${lvl.difficulty}</span>
        <h3>Nivel ${lvl.id}</h3>
        <div class="lock-icon">🔒</div>
        <p style="color: #78909c;">Bloqueado</p>
      `;
    }

    // Botón de eliminar para TODOS los niveles
    const delBtn = document.createElement("button");
    delBtn.className = "btn-delete-level-card";
    delBtn.innerHTML = "🗑️";
    delBtn.title = "Eliminar este nivel";
    delBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      SoundEffects.playClick();
      if (confirm(`¿Estás seguro de que quieres eliminar el nivel "${lvl.name}"?`)) {
        deleteLevel(lvl.id, lvl.isCustom);
      }
    });
    card.appendChild(delBtn);

    grid.appendChild(card);
  });
}

// Inicia un nivel específico
function startLevel(levelId) {
  const level = activeLevels.find(l => l.id === levelId);
  if (!level) return;
  
  GameState.currentLevel = level;
  GameState.foundDifferences = [];
  GameState.lives = 3;
  GameState.timeLeft = 120; // 2 minutos
  GameState.isGameOver = false;
  
  // Configurar interfaz de juego
  document.getElementById("level-name").textContent = `${level.id}. ${level.name}`;
  updateStatsUI();
  
  // Renderizar las imágenes SVG en los dos marcos
  const origFrame = document.getElementById("orig-frame");
  const modFrame = document.getElementById("mod-frame");
  
  // Limpiar marcadores antiguos
  origFrame.innerHTML = `<div class="frame-click-area"></div>`;
  modFrame.innerHTML = `<div class="frame-click-area"></div>`;
  
  // Insertar SVG o Imagen
  if (level.svgMarkup) {
    const divOrig = document.createElement("div");
    divOrig.className = "original-side";
    divOrig.style.width = "100%";
    divOrig.style.height = "100%";
    divOrig.innerHTML = level.svgMarkup;
    origFrame.appendChild(divOrig);
    
    const divMod = document.createElement("div");
    divMod.className = "modified-side";
    divMod.style.width = "100%";
    divMod.style.height = "100%";
    divMod.innerHTML = level.svgMarkup;
    modFrame.appendChild(divMod);
  } else if (level.imgOriginal && level.imgModified) {
    const imgOrig = document.createElement("img");
    imgOrig.src = level.imgOriginal;
    imgOrig.alt = "Imagen Original";
    imgOrig.style.width = "100%";
    imgOrig.style.height = "100%";
    imgOrig.style.objectFit = "fill";
    origFrame.appendChild(imgOrig);

    const imgMod = document.createElement("img");
    imgMod.src = level.imgModified;
    imgMod.alt = "Imagen Modificada";
    imgMod.style.width = "100%";
    imgMod.style.height = "100%";
    imgMod.style.objectFit = "fill";
    modFrame.appendChild(imgMod);
  }
  
  // Reiniciar barra de tiempo
  const timerBar = document.getElementById("timer-bar");
  timerBar.style.width = "100%";
  timerBar.className = "timer-bar";
  
  // Iniciar temporizador
  clearInterval(GameState.timerInterval);
  GameState.timerInterval = setInterval(updateTimer, 1000);
  
  // Mascot saludo inicial
  Mascot.say(`¡Hola! Ayúdame a buscar las 5 diferencias en esta escena. ¡Toca donde veas un cambio! 🔍`, "🐶");
  
  showScreen("game-screen");
}

function updateTimer() {
  if (GameState.isGameOver) return;
  
  GameState.timeLeft--;
  const pct = (GameState.timeLeft / 120) * 100;
  const timerBar = document.getElementById("timer-bar");
  
  if (timerBar) {
    timerBar.style.width = `${pct}%`;
    if (GameState.timeLeft <= 25) {
      timerBar.classList.add("warning");
      if (GameState.timeLeft % 10 === 0) {
        Mascot.reactToLowTime();
      }
    }
  }
  
  if (GameState.timeLeft <= 0) {
    endGame(false, "time");
  }
}

// Dibuja los corazones de vidas y estrellas de diferencias
function updateStatsUI() {
  // Diferencias
  const diffText = document.getElementById("diff-counter");
  diffText.innerHTML = `⭐ ${GameState.foundDifferences.length} / 5`;
  
  // Vidas
  const livesContainer = document.getElementById("lives-container");
  livesContainer.innerHTML = "";
  for (let i = 0; i < 3; i++) {
    const heart = document.createElement("span");
    heart.textContent = i < GameState.lives ? "❤️" : "🖤";
    heart.style.fontSize = "1.5rem";
    livesContainer.appendChild(heart);
  }
}

// Configura los oyentes de eventos
function setupEventListeners() {
  // Botones principales
  document.getElementById("btn-start-game").addEventListener("click", () => {
    SoundEffects.playClick();
    showScreen("level-screen");
  });
  
  document.getElementById("btn-back-levels").addEventListener("click", () => {
    SoundEffects.playClick();
    showScreen("level-screen");
  });
  
  document.getElementById("btn-back-menu").addEventListener("click", () => {
    SoundEffects.playClick();
    showScreen("menu-screen");
  });

  document.getElementById("btn-reset-everything").addEventListener("click", () => {
    SoundEffects.playClick();
    resetEverything();
  });

  // Botón pista
  document.getElementById("btn-hint").addEventListener("click", useHint);

  // Música toggle
  const toggleSound = document.getElementById("btn-toggle-sound");
  toggleSound.addEventListener("click", () => {
    soundEnabled = !soundEnabled;
    toggleSound.textContent = soundEnabled ? "🔊" : "🔇";
    if (soundEnabled) {
      initAudio();
      SoundEffects.playClick();
    }
  });

  // Modales
  document.getElementById("btn-win-next").addEventListener("click", () => {
    SoundEffects.playClick();
    document.getElementById("win-modal").classList.remove("active");
    
    // Siguiente nivel si existe, sino ir a niveles
    const currentIndex = activeLevels.findIndex(l => l.id === GameState.currentLevel.id);
    const nextLevel = activeLevels[currentIndex + 1];
    if (nextLevel) {
      startLevel(nextLevel.id);
    } else {
      showScreen("level-screen");
    }
  });

  document.getElementById("btn-win-menu").addEventListener("click", () => {
    SoundEffects.playClick();
    document.getElementById("win-modal").classList.remove("active");
    showScreen("level-screen");
  });

  document.getElementById("btn-retry").addEventListener("click", () => {
    SoundEffects.playClick();
    document.getElementById("gameover-modal").classList.remove("active");
    startLevel(GameState.currentLevel.id);
  });

  document.getElementById("btn-gameover-menu").addEventListener("click", () => {
    SoundEffects.playClick();
    document.getElementById("gameover-modal").classList.remove("active");
    showScreen("level-screen");
  });

  // Registro de clics en las imágenes
  document.getElementById("orig-frame").addEventListener("click", handleFrameClick);
  document.getElementById("mod-frame").addEventListener("click", handleFrameClick);

  // Lógica del botón de Acceso Admin
  document.getElementById("btn-admin-access").addEventListener("click", () => {
    SoundEffects.playClick();
    if (isAdminMode) {
      if (confirm("¿Quieres cerrar la sesión de administrador?")) {
        isAdminMode = false;
        sessionStorage.removeItem("buscar_diferencias_is_admin");
        updateAdminUI();
        renderLevelGrid();
        alert("Sesión de administrador cerrada.");
      }
    } else {
      const pinInput = document.getElementById("admin-pin-input");
      const errorMsg = document.getElementById("admin-error-msg");
      pinInput.value = "";
      errorMsg.style.display = "none";
      document.getElementById("admin-modal").classList.add("active");
      setTimeout(() => pinInput.focus(), 150); // Delay mínimo para asegurar transición CSS
    }
  });

  document.getElementById("btn-admin-cancel").addEventListener("click", () => {
    SoundEffects.playClick();
    document.getElementById("admin-modal").classList.remove("active");
  });

  document.getElementById("admin-pin-input").addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      document.getElementById("btn-admin-submit").click();
    }
  });

  document.getElementById("btn-admin-submit").addEventListener("click", async () => {
    SoundEffects.playClick();
    const pinInput = document.getElementById("admin-pin-input");
    const errorMsg = document.getElementById("admin-error-msg");
    
    // Comparación segura mediante Hash SHA-256 de "Detective2026!#"
    const inputHash = await sha256(pinInput.value);
    if (inputHash === "e2997d3ca552550cf5d0ac4b336a638c52ade8ca43eebd7be9b514b960188e9b") {
      isAdminMode = true;
      sessionStorage.setItem("buscar_diferencias_is_admin", "true");
      document.getElementById("admin-modal").classList.remove("active");
      updateAdminUI();
      renderLevelGrid();
      alert("¡Acceso de Administrador concedido!");
    } else {
      errorMsg.style.display = "block";
      pinInput.value = "";
      pinInput.focus();
      SoundEffects.playError();
    }
  });
}

// Lógica de procesamiento de Clics
function handleFrameClick(e) {
  if (GameState.isGameOver) return;
  initAudio(); // Garantizar audio tras interacción

  const frame = e.currentTarget;
  const rect = frame.getBoundingClientRect();
  
  // Calcular coordenadas porcentuales
  const clickX = ((e.clientX - rect.left) / rect.width) * 100;
  const clickY = ((e.clientY - rect.top) / rect.height) * 100;
  
  let matchFound = false;
  
  // Buscar colisión
  for (let diff of GameState.currentLevel.differences) {
    const dist = Math.sqrt(Math.pow(clickX - diff.x, 2) + Math.pow(clickY - diff.y, 2));
    
    if (dist <= diff.radius) {
      matchFound = true;
      
      // Comprobar si ya fue encontrada
      if (!GameState.foundDifferences.includes(diff.id)) {
        GameState.foundDifferences.push(diff.id);
        markDifference(diff.x, diff.y);
        SoundEffects.playSuccess();
        Mascot.reactToSuccess(diff);
        updateStatsUI();
        
        // Efecto confeti pequeño
        triggerConfettiBlast(e.clientX, e.clientY, 12);
        
        // Comprobar victoria
        if (GameState.foundDifferences.length === 5) {
          endGame(true);
        }
      }
      break;
    }
  }
  
  // Si falló el clic
  if (!matchFound) {
    // Evitar que cuente error si hace clic sobre un marcador de acierto ya puesto
    if (e.target.classList.contains("found-marker")) return;
    
    GameState.lives--;
    SoundEffects.playError();
    Mascot.reactToError();
    updateStatsUI();
    
    // Crear marcador temporal de error en el punto clicado
    showErrorMarker(frame, clickX, clickY);
    
    // Sacudir marcos
    const origFrame = document.getElementById("orig-frame");
    const modFrame = document.getElementById("mod-frame");
    origFrame.classList.add("shake");
    modFrame.classList.add("shake");
    setTimeout(() => {
      origFrame.classList.remove("shake");
      modFrame.classList.remove("shake");
    }, 400);
    
    if (GameState.lives <= 0) {
      endGame(false, "lives");
    }
  }
}

// Añade un círculo de acierto en ambos marcos
function markDifference(x, y) {
  const origFrame = document.getElementById("orig-frame");
  const modFrame = document.getElementById("mod-frame");
  
  const m1 = document.createElement("div");
  m1.className = "found-marker";
  m1.style.left = `${x}%`;
  m1.style.top = `${y}%`;
  
  const m2 = document.createElement("div");
  m2.className = "found-marker";
  m2.style.left = `${x}%`;
  m2.style.top = `${y}%`;
  
  origFrame.appendChild(m1);
  modFrame.appendChild(m2);
}

// Muestra una cruz roja en las coordenadas clicadas
function showErrorMarker(frame, x, y) {
  const marker = document.createElement("div");
  marker.className = "error-marker";
  marker.textContent = "❌";
  marker.style.left = `${x}%`;
  marker.style.top = `${y}%`;
  
  frame.appendChild(marker);
  setTimeout(() => marker.remove(), 600);
}

// Lógica de Pista
function useHint() {
  if (GameState.isGameOver) return;
  
  const level = GameState.currentLevel;
  const unfound = level.differences.filter(d => !GameState.foundDifferences.includes(d.id));
  
  if (unfound.length === 0) return;
  
  // Elegir una pista aleatoria de las no encontradas
  const chosen = unfound[Math.floor(Math.random() * unfound.length)];
  
  // Solo muestra el texto de ayuda en la burbuja de la mascota, pero no lo resuelve
  SoundEffects.playClick();
  Mascot.say(`Pista: ${chosen.hint} 🔍`, "💡");
}

// Finaliza el juego (Victoria o Derrota)
function endGame(isWin, reason = "") {
  GameState.isGameOver = true;
  clearInterval(GameState.timerInterval);
  
  if (isWin) {
    SoundEffects.playLevelComplete();
    Mascot.say("¡Fantástico! ¡Has encontrado todas las diferencias! Eres un súper detective 🏆", "🏆");
    
    // Guardar progreso: Marcar como completado
    GameState.markLevelCompleted(GameState.currentLevel.id);
    renderLevelGrid(); // refrescar cuadrícula
    
    // Lanzar confeti grande de celebración
    triggerConfettiRain();
    
    // Retrasar modal de victoria para que vean el confeti
    setTimeout(() => {
      const currentIndex = activeLevels.findIndex(l => l.id === GameState.currentLevel.id);
      const nextLevel = activeLevels[currentIndex + 1];
      const isLastLevel = !nextLevel;
      const winTitle = document.getElementById("win-title");
      const winDesc = document.getElementById("win-desc");
      const btnNext = document.getElementById("btn-win-next");
      
      if (isLastLevel) {
        winTitle.textContent = "¡Juego Completado!";
        winDesc.textContent = "¡Increíble! Has superado todos los niveles del juego. ¡Eres el mejor detective del mundo! 🌍✨";
        btnNext.textContent = "Volver a Inicio";
      } else {
        winTitle.textContent = "¡Ganaste!";
        winDesc.textContent = `¡Felicidades! Completaste el nivel "${GameState.currentLevel.name}" con éxito.`;
        btnNext.textContent = "Siguiente Nivel ➔";
      }
      
      document.getElementById("win-modal").classList.add("active");
    }, 1000);
    
  } else {
    SoundEffects.playError();
    const overDesc = document.getElementById("gameover-desc");
    
    if (reason === "time") {
      Mascot.say("¡Se acabó el tiempo! No te preocupes, ¡puedes intentarlo de nuevo! ⏰", "😢");
      overDesc.textContent = "El tiempo se ha agotado antes de que pudieras encontrar todas las diferencias.";
    } else {
      Mascot.say("¡Te has quedado sin vidas! Inténtalo de nuevo, ¡tú puedes! 💪", "😭");
      overDesc.textContent = "¡Vaya! Has cometido demasiados errores en la búsqueda.";
    }
    
    setTimeout(() => {
      document.getElementById("gameover-modal").classList.add("active");
    }, 800);
  }
}

// ==========================================================================
// Sistemas de Partículas y Confeti
// ==========================================================================

function triggerConfettiBlast(x, y, count) {
  const shapes = ["⭐", "🎈", "🌸", "✨", "🔴", "🟡", "🔵"];
  for (let i = 0; i < count; i++) {
    const p = document.createElement("div");
    p.className = "confetti-particle";
    p.textContent = shapes[Math.floor(Math.random() * shapes.length)];
    p.style.left = `${x}px`;
    p.style.top = `${y}px`;
    p.style.fontSize = `${15 + Math.random() * 20}px`;
    
    // Dirección física simple mediante variables CSS o cálculo inline
    const angle = Math.random() * Math.PI * 2;
    const distance = 50 + Math.random() * 100;
    const destX = Math.cos(angle) * distance;
    const destY = Math.sin(angle) * distance - 50; // sesgo hacia arriba
    
    p.animate([
      { transform: 'translate(0, 0) scale(1) rotate(0deg)', opacity: 1 },
      { transform: `translate(${destX}px, ${destY}px) scale(1.2) rotate(${180 + Math.random() * 360}deg)`, opacity: 0.9 },
      { transform: `translate(${destX}px, ${destY + 150}px) scale(0.8) rotate(${360 + Math.random() * 360}deg)`, opacity: 0 }
    ], {
      duration: 800 + Math.random() * 600,
      easing: 'cubic-bezier(0.1, 0.8, 0.3, 1)',
      fill: 'forwards'
    });
    
    document.body.appendChild(p);
    setTimeout(() => p.remove(), 1500);
  }
}

function triggerConfettiRain() {
  const colors = ["⭐", "🌈", "🎉", "🍬", "✨", "🌸", "🍀"];
  const count = 75;
  for (let i = 0; i < count; i++) {
    const p = document.createElement("div");
    p.className = "confetti-particle";
    p.textContent = colors[Math.floor(Math.random() * colors.length)];
    p.style.left = `${Math.random() * 100}vw`;
    p.style.top = `-30px`;
    p.style.fontSize = `${20 + Math.random() * 30}px`;
    
    const duration = 2000 + Math.random() * 2000;
    const delay = Math.random() * 1000;
    
    p.animate([
      { transform: 'translateY(0) rotate(0deg)', opacity: 1 },
      { transform: `translateY(110vh) translateX(${-100 + Math.random() * 200}px) rotate(${360 + Math.random() * 720}deg)`, opacity: 0 }
    ], {
      duration: duration,
      delay: delay,
      easing: 'ease-out',
      fill: 'forwards'
    });
    
    document.body.appendChild(p);
    setTimeout(() => p.remove(), duration + delay + 100);
  }
}

// ==========================================================================
// Creador de Niveles - Estado y Lógica
// ==========================================================================
const LevelCreator = {
  name: "",
  difficulty: "Medio",
  requiresLevelId: null,
  imgOriginalBase64: null,
  imgModifiedBase64: null,
  differences: [], // Array of { id, x, y, radius, hint, message }
  
  tempClickX: 0,
  tempClickY: 0,
  
  reset() {
    this.name = "";
    this.difficulty = "Medio";
    this.requiresLevelId = null;
    this.imgOriginalBase64 = null;
    this.imgModifiedBase64 = null;
    this.differences = [];
    this.tempClickX = 0;
    this.tempClickY = 0;
    
    document.getElementById("creator-name").value = "";
    document.getElementById("creator-difficulty").value = "Medio";
    document.getElementById("creator-requires").value = "";
    document.getElementById("creator-server-orig").value = "";
    document.getElementById("creator-server-mod").value = "";
    
    document.getElementById("creator-orig-frame").innerHTML = `<div class="creator-canvas-placeholder">Carga la imagen original</div>`;
    document.getElementById("creator-mod-frame").innerHTML = `<div class="creator-canvas-placeholder">Carga la imagen modificada</div>`;
    
    this.updateDiffList();
    this.validateForm();
  },
  
  init() {
    document.getElementById("btn-create-level").addEventListener("click", () => {
      SoundEffects.playClick();
      this.reset();
      this.populateRequiresDropdown();
      showScreen("creator-screen");
    });
    
    document.getElementById("btn-creator-back").addEventListener("click", () => {
      SoundEffects.playClick();
      showScreen("menu-screen");
    });
    
    document.getElementById("creator-file-orig").addEventListener("change", (e) => {
      if (e.target.files && e.target.files[0]) {
        this.processImageFile(e.target.files[0], "orig");
      }
    });
    
    document.getElementById("creator-file-mod").addEventListener("change", (e) => {
      if (e.target.files && e.target.files[0]) {
        this.processImageFile(e.target.files[0], "mod");
      }
    });
    
    document.getElementById("creator-mod-frame").addEventListener("click", (e) => {
      // Ignore clicks on existing markers (they handle their own delete logic)
      if (e.target.classList.contains("creator-marker")) return;

      if (!this.imgOriginalBase64 || !this.imgModifiedBase64) {
        alert("Por favor, sube primero ambas imágenes.");
        return;
      }
      
      if (this.differences.length >= 5) {
        alert("Ya has definido las 5 diferencias requeridas. Elimina alguna si deseas cambiarla.");
        return;
      }
      
      const rect = e.currentTarget.getBoundingClientRect();
      const clickX = ((e.clientX - rect.left) / rect.width) * 100;
      const clickY = ((e.clientY - rect.top) / rect.height) * 100;
      
      this.openDiffModal(clickX, clickY);
    });
    
    document.getElementById("btn-diff-cancel").addEventListener("click", () => {
      SoundEffects.playClick();
      const preview = document.getElementById("edit-preview-marker");
      if (preview) preview.style.display = "none";
      document.getElementById("diff-modal").classList.remove("active");
    });
    
    document.getElementById("btn-diff-save").addEventListener("click", () => {
      SoundEffects.playClick();
      this.saveTempDifference();
    });
    
    const radiusInput = document.getElementById("diff-radius-input");
    const radiusVal = document.getElementById("diff-radius-val");
    radiusInput.addEventListener("input", (e) => {
      radiusVal.textContent = `${e.target.value}%`;
      this.updatePreviewMarker(parseFloat(e.target.value));
    });
    
    document.getElementById("btn-save-level").addEventListener("click", () => {
      SoundEffects.playClick();
      this.saveLevel();
    });
    
    document.getElementById("btn-export-level").addEventListener("click", () => {
      SoundEffects.playClick();
      this.exportLevel();
    });
    
    document.getElementById("btn-export-copy").addEventListener("click", () => {
      SoundEffects.playClick();
      const codeArea = document.getElementById("export-code-area");
      codeArea.select();
      document.execCommand("copy");
      alert("¡Código de configuración copiado al portapapeles!");
    });
    
    document.getElementById("btn-export-close").addEventListener("click", () => {
      SoundEffects.playClick();
      document.getElementById("export-modal").classList.remove("active");
    });

    document.getElementById("creator-name").addEventListener("input", () => {
      this.validateForm();
    });

    document.getElementById("creator-difficulty").addEventListener("change", () => {
      this.validateForm();
    });

    document.getElementById("creator-requires").addEventListener("change", () => {
      this.validateForm();
    });
  },
  
  populateRequiresDropdown() {
    const select = document.getElementById("creator-requires");
    select.innerHTML = '<option value="">Ninguno (Disponible al inicio)</option>';
    
    activeLevels.forEach(lvl => {
      const option = document.createElement("option");
      option.value = lvl.id;
      option.textContent = `Nivel ${lvl.id}: ${lvl.name}`;
      select.appendChild(option);
    });
  },
  
  processImageFile(file, side) {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 800;
        canvas.height = 600;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, 800, 600);
        
        const dataUrl = canvas.toDataURL('image/jpeg', 0.75);
        
        if (side === "orig") {
          this.imgOriginalBase64 = dataUrl;
          const frame = document.getElementById("creator-orig-frame");
          // Clear placeholder but keep structure
          frame.innerHTML = '';
          const imgEl = document.createElement('img');
          imgEl.src = dataUrl;
          imgEl.alt = 'Original';
          imgEl.style.cssText = 'width:100%; height:100%; object-fit:fill; pointer-events:none; position:absolute; top:0; left:0;';
          frame.appendChild(imgEl);
        } else {
          this.imgModifiedBase64 = dataUrl;
          const frame = document.getElementById("creator-mod-frame");
          // Clear placeholder but keep structure
          frame.innerHTML = '';
          const imgEl = document.createElement('img');
          imgEl.src = dataUrl;
          imgEl.alt = 'Copia';
          imgEl.style.cssText = 'width:100%; height:100%; object-fit:fill; pointer-events:none; position:absolute; top:0; left:0;';
          frame.appendChild(imgEl);
        }
        
        // Update instructions when both images are loaded
        if (this.imgOriginalBase64 && this.imgModifiedBase64) {
          document.getElementById("creator-instructions-text").textContent =
            '¡Perfecto! Ahora haz clic en la imagen "Copia" (derecha) exactamente donde esté cada diferencia. Haz clic en un círculo para eliminarlo.';
        }
        
        this.redrawCreatorMarkers();
        this.validateForm();
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  },
  
  openDiffModal(x, y) {
    this.tempClickX = x;
    this.tempClickY = y;
    
    document.getElementById("diff-hint-input").value = "";
    document.getElementById("diff-message-input").value = "";
    
    document.getElementById("diff-radius-input").value = 6;
    document.getElementById("diff-radius-val").textContent = "6%";
    
    this.updatePreviewMarker(6);
    
    document.getElementById("diff-modal").classList.add("active");
    document.getElementById("diff-hint-input").focus();
  },
  
  updatePreviewMarker(radius) {
    const modFrame = document.getElementById("creator-mod-frame");
    let preview = document.getElementById("edit-preview-marker");
    if (!preview) {
      preview = document.createElement("div");
      preview.id = "edit-preview-marker";
      preview.className = "edit-preview-marker";
      modFrame.appendChild(preview);
    }
    
    preview.style.left = `${this.tempClickX}%`;
    preview.style.top = `${this.tempClickY}%`;
    preview.style.width = `${radius * 2}%`;
    preview.style.height = `${radius * 2 * 1.333}%`;
    preview.style.display = "block";
  },
  
  saveTempDifference() {
    const hint = document.getElementById("diff-hint-input").value.trim();
    const message = document.getElementById("diff-message-input").value.trim();
    const radius = parseFloat(document.getElementById("diff-radius-input").value);
    
    if (!hint) {
      alert("Por favor, escribe una pista para ayudar al detective.");
      return;
    }
    
    const diffId = this.differences.length + 1;
    this.differences.push({
      id: diffId,
      x: parseFloat(this.tempClickX.toFixed(2)),
      y: parseFloat(this.tempClickY.toFixed(2)),
      radius: radius,
      hint: hint,
      message: message || undefined
    });
    
    const preview = document.getElementById("edit-preview-marker");
    if (preview) preview.style.display = "none";
    document.getElementById("diff-modal").classList.remove("active");
    
    this.redrawCreatorMarkers();
    this.updateDiffList();
    this.validateForm();
  },
  
  deleteDifference(id) {
    this.differences = this.differences.filter(d => d.id !== id);
    this.differences.forEach((d, index) => {
      d.id = index + 1;
    });
    this.redrawCreatorMarkers();
    this.updateDiffList();
    this.validateForm();
  },
  
  redrawCreatorMarkers() {
    document.querySelectorAll(".creator-marker").forEach(m => m.remove());
    
    const origFrame = document.getElementById("creator-orig-frame");
    const modFrame = document.getElementById("creator-mod-frame");
    
    this.differences.forEach(diff => {
      const mOrig = document.createElement("div");
      mOrig.className = "creator-marker";
      mOrig.style.left = `${diff.x}%`;
      mOrig.style.top = `${diff.y}%`;
      mOrig.style.width = `${diff.radius * 2}%`;
      mOrig.style.height = `${diff.radius * 2 * 1.333}%`;
      mOrig.textContent = diff.id;
      mOrig.title = `Diferencia ${diff.id}: ${diff.hint}`;
      mOrig.addEventListener("click", (e) => {
        e.stopPropagation();
        this.deleteDifference(diff.id);
      });
      origFrame.appendChild(mOrig);
      
      const mMod = document.createElement("div");
      mMod.className = "creator-marker";
      mMod.style.left = `${diff.x}%`;
      mMod.style.top = `${diff.y}%`;
      mMod.style.width = `${diff.radius * 2}%`;
      mMod.style.height = `${diff.radius * 2 * 1.333}%`;
      mMod.textContent = diff.id;
      mMod.title = `Diferencia ${diff.id}: ${diff.hint}`;
      mMod.addEventListener("click", (e) => {
        e.stopPropagation();
        this.deleteDifference(diff.id);
      });
      modFrame.appendChild(mMod);
    });
  },
  
  updateDiffList() {
    const list = document.getElementById("creator-diff-list");
    const count = document.getElementById("creator-diff-count");
    
    list.innerHTML = "";
    count.textContent = this.differences.length;
    
    if (this.differences.length === 0) {
      list.innerHTML = `<p class="empty-list-text">Sube ambas imágenes y haz clic sobre la "Copia" para marcar diferencias.</p>`;
      return;
    }
    
    this.differences.forEach(diff => {
      const item = document.createElement("div");
      item.className = "creator-diff-item";
      item.innerHTML = `
        <div class="creator-diff-item-text">
          <span class="creator-diff-item-hint">#${diff.id}: ${diff.hint}</span>
          ${diff.message ? `<span class="creator-diff-item-msg">🗣️ Mascota: "${diff.message}"</span>` : `<span class="creator-diff-item-msg">🗣️ Mascota: (Por defecto)</span>`}
        </div>
        <button class="btn-delete-diff" title="Eliminar diferencia">🗑️</button>
      `;
      item.querySelector(".btn-delete-diff").addEventListener("click", () => {
        this.deleteDifference(diff.id);
      });
      list.appendChild(item);
    });
  },
  
  validateForm() {
    const name = document.getElementById("creator-name").value.trim();
    const hasImages = this.imgOriginalBase64 && this.imgModifiedBase64;
    const hasDiffs = this.differences.length >= 1;
    
    const isValid = name !== '' && hasImages && hasDiffs;
    
    document.getElementById("btn-save-level").disabled = !isValid;
    document.getElementById("btn-export-level").disabled = !isValid;
    
    // Update counter hint color
    const counter = document.getElementById("creator-diff-count");
    if (counter) {
      counter.style.color = this.differences.length === 0 ? '#e53935' :
                            this.differences.length < 5 ? '#f57f17' : '#2e7d32';
    }
  },
  
  async saveLevel() {
    const name = document.getElementById("creator-name").value.trim();
    const difficulty = document.getElementById("creator-difficulty").value;
    const requiresIdInput = document.getElementById("creator-requires").value;
    const requiresId = requiresIdInput ? parseInt(requiresIdInput) : null;
    
    const serverOrig = document.getElementById("creator-server-orig").value.trim();
    const serverMod = document.getElementById("creator-server-mod").value.trim();
    
    let maxId = 0;
    activeLevels.forEach(lvl => {
      if (typeof lvl.id === 'number' && lvl.id > maxId) {
        maxId = lvl.id;
      }
    });
    const newId = maxId + 1;
    
    const newLevel = {
      id: newId,
      name: name,
      difficulty: difficulty,
      requiresLevelId: requiresId,
      type: "image",
      imgOriginal: serverOrig || this.imgOriginalBase64,
      imgModified: serverMod || this.imgModifiedBase64,
      differences: this.differences,
      isCustom: true
    };
    
    let savedLevels = [];
    const saved = localStorage.getItem("buscar_diferencias_custom_levels");
    if (saved) {
      try {
        savedLevels = JSON.parse(saved);
      } catch (e) {
        savedLevels = [];
      }
    }
    savedLevels.push(newLevel);
    localStorage.setItem("buscar_diferencias_custom_levels", JSON.stringify(savedLevels));
    
    try {
      await fetch('/api/custom-levels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(savedLevels)
      });
    } catch (e) {
      console.error("Error syncing new level to server:", e);
    }
    
    alert(`¡Nivel "${name}" guardado con éxito! Ya puedes jugarlo en la lista de aventuras.`);
    
    loadAllLevels();
    renderLevelGrid();
    
    showScreen("level-screen");
  },
  
  exportLevel() {
    const name = document.getElementById("creator-name").value.trim();
    const difficulty = document.getElementById("creator-difficulty").value;
    const requiresIdInput = document.getElementById("creator-requires").value;
    const requiresId = requiresIdInput ? parseInt(requiresIdInput) : null;
    
    const serverOrig = document.getElementById("creator-server-orig").value.trim();
    const serverMod = document.getElementById("creator-server-mod").value.trim();
    
    const cleanLevelObj = {
      id: "CAMBIAR_POR_ID_SIGUIENTE",
      name: name,
      difficulty: difficulty,
      requiresLevelId: requiresId,
      type: "image",
      imgOriginal: serverOrig || "Ruta de la imagen original en tu servidor (ej. img/nivel_orig.jpg)",
      imgModified: serverMod || "Ruta de la imagen modificada en tu servidor (ej. img/nivel_mod.jpg)",
      differences: this.differences
    };
    
    const jsonStr = JSON.stringify(cleanLevelObj, null, 2);
    
    document.getElementById("export-code-area").value = jsonStr;
    document.getElementById("export-modal").classList.add("active");
  }
};
