/**
 * Fija el lienzo: ni zoom ni desplazamiento lateral del conjunto.
 *
 * `user-scalable=no` en la meta no basta — iOS Safari lo ignora desde la
 * versión 10 justamente para no romper la accesibilidad de páginas web. En una
 * app instalada sí queremos ese comportamiento, así que se bloquea con los
 * eventos propietarios de Safari (`gesturestart`) y con el doble toque, que es
 * la otra vía de zoom.
 */
const cancelar = (e) => e.preventDefault();

export const installViewportLock = () => {
    if (typeof window === 'undefined') return;

    // Pinch en Safari (iOS y macOS). No existe en otros navegadores, donde
    // touch-action: pan-y del CSS ya hace el trabajo.
    for (const evt of ['gesturestart', 'gesturechange', 'gestureend']) {
        document.addEventListener(evt, cancelar, { passive: false });
    }

    // Doble toque para ampliar. Se deja pasar el segundo toque si cae sobre un
    // control: bloquearlo entero rompería los dobles clics legítimos.
    let ultimoToque = 0;
    document.addEventListener('touchend', (e) => {
        const ahora = Date.now();
        if (ahora - ultimoToque < 300 && !e.target.closest('input, textarea, [contenteditable]')) {
            e.preventDefault();
        }
        ultimoToque = ahora;
    }, { passive: false });

    // Zoom por rueda con Ctrl/⌘ en escritorio, que descuadra la maqueta al
    // revisarla.
    window.addEventListener('wheel', (e) => {
        if (e.ctrlKey || e.metaKey) e.preventDefault();
    }, { passive: false });
};
