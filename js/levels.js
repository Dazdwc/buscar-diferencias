// Configuración de niveles para el juego de Buscar Diferencias
// Por defecto se encuentra vacío para que el administrador cree los niveles dinámicamente.

const GAME_LEVELS = [];

// Hacer disponible el array a nivel global para que game.js lo cargue
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GAME_LEVELS;
}
