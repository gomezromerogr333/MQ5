/**
 * Modo exposición (ADR-026): abre TODOS los mundos y niveles en pantalla para poder mostrar el
 * juego completo (p. ej. en una clase) sin haberlos ganado.
 *
 * - Solo cambia lo que SE VE como desbloqueado en este navegador. No escribe nada en la base de
 *   datos, no cambia reglas ni progreso real; las rondas que se jueguen se guardan normal.
 * - Se activa abriendo cualquier página con `?expo=1` y se apaga con `?expo=0`. Se recuerda en
 *   este navegador (localStorage) para que siga activo al pasar por el registro.
 * - Sin el parámetro, el juego se comporta exactamente como siempre.
 */
const KEY = 'mq5.expo';
let memory = false;

/** Lee `?expo=1|0` de la dirección y lo guarda. Llamar una vez al arrancar. */
export function syncExpoFromUrl(search: string = typeof window !== 'undefined' ? window.location.search : ''): void {
  const v = new URLSearchParams(search).get('expo');
  if (v !== '1' && v !== '0') return;
  memory = v === '1';
  try {
    if (memory) window.localStorage.setItem(KEY, '1');
    else window.localStorage.removeItem(KEY);
  } catch {
    /* sin almacenamiento: queda solo en memoria durante esta carga */
  }
}

export function isExpoMode(): boolean {
  if (memory) return true;
  try {
    return window.localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}
