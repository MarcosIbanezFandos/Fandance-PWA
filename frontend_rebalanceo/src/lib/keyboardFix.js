/**
 * Recolocación tras plegar el teclado en iOS.
 *
 * Safari desplaza la *ventana* para dejar a la vista el campo enfocado, incluso
 * con el documento en overflow:hidden. Al cerrarse el teclado no siempre
 * deshace ese desplazamiento, y la app queda con la cabecera fuera de pantalla
 * y la barra de pestañas flotando a media altura: la sensación de "se ha
 * quedado pillada".
 *
 * La corrección es devolver el documento a 0 cuando el campo pierde el foco y
 * cuando el viewport visual recupera su altura.
 */
const isEditable = (el) =>
    !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);

const resetWindowScroll = () => {
    // El scroll real de la app vive en .app-scroll; lo que hay que deshacer es
    // el desplazamiento que iOS aplica al documento, que debería ser siempre 0.
    if (window.scrollY !== 0 || window.scrollX !== 0) window.scrollTo(0, 0);
    const doc = document.scrollingElement || document.documentElement;
    if (doc && doc.scrollTop !== 0) doc.scrollTop = 0;
};

export const installKeyboardFix = () => {
    if (typeof window === 'undefined') return;

    document.addEventListener('focusout', (e) => {
        if (!isEditable(e.target)) return;
        // Dos pasadas: iOS recoloca en varios fotogramas y una sola corrección
        // se pierde a mitad de la animación de cierre.
        requestAnimationFrame(resetWindowScroll);
        setTimeout(resetWindowScroll, 300);
    });

    const vv = window.visualViewport;
    if (vv) {
        vv.addEventListener('resize', () => {
            // Si el viewport visual vuelve a ocupar casi toda la ventana, el
            // teclado se ha cerrado.
            if (vv.height >= window.innerHeight - 40) resetWindowScroll();
        });
    }
};
