/**
 * Que el usuario vea la versión recién publicada sin tener que abrir la app dos
 * veces.
 *
 * El service worker sirve la app desde su caché, así que tras un despliegue la
 * primera apertura muestra todavía la versión anterior: la nueva se instala de
 * fondo y no se ve hasta la siguiente. En una app que se abre una vez al mes
 * —cuando toca subir el CSV— eso significa ir siempre una versión por detrás.
 *
 * Con `clientsClaim`, el worker nuevo toma el control de la página en cuanto se
 * activa y dispara `controllerchange`. Ahí se recarga una sola vez y la sesión
 * ya corre con el código nuevo.
 */
export const instalarAutoActualizacion = () => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

    // En la primera visita no hay worker previo, y el `clientsClaim` inicial
    // también dispara controllerchange. Recargar ahí sería un parpadeo gratuito
    // en el peor momento: el primer contacto con la app.
    const habiaWorker = !!navigator.serviceWorker.controller;
    if (!habiaWorker) return;

    let recargando = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (recargando) return;
        recargando = true;
        window.location.reload();
    });
};

/**
 * Comprueba si hay versión nueva al volver a la app.
 *
 * El navegador sólo busca actualizaciones al cargar la página. Una PWA
 * instalada puede pasar semanas en segundo plano sin recargarse nunca, así que
 * se fuerza la comprobación al volver a primer plano.
 */
export const buscarActualizacionAlVolver = () => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState !== 'visible') return;
        navigator.serviceWorker.getRegistrations()
            .then(regs => regs.forEach(r => r.update()))
            .catch(() => { /* sin red no hay nada que comprobar */ });
    });
};
