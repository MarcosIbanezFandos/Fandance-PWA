/** Los errores de Supabase Auth en castellano, y diciendo qué hacer. */
export function mensajeDeError(error) {
  switch (error?.code) {
    case 'invalid_credentials':
      return 'Email o contraseña incorrectos.';
    case 'over_email_send_rate_limit':
    case 'over_request_rate_limit':
      return 'Has pedido demasiados emails seguidos. Espera un rato y vuelve a probar.';
    case 'email_address_not_authorized':
      return 'Supabase no puede mandar emails a esa dirección.';
    case 'same_password':
      return 'La contraseña nueva tiene que ser distinta de la anterior.';
    case 'weak_password':
      return 'Esa contraseña es demasiado débil. Usa la que te propone el iPhone.';
    case 'session_not_found':
    case 'reauthentication_needed':
      return 'El enlace ha caducado. Pide otro con «¿Has olvidado la contraseña?».';
    default:
      return error?.message || 'Algo ha fallado. Prueba otra vez.';
  }
}
