/**
 * Todo el copy visible de la UI (SPEC §3.5): castellano rioplatense, con voseo.
 * Nada de strings literales en JSX: se importan de acá.
 */
export const t = {
  app: {
    name: 'Clave',
  },
  connection: {
    connecting: 'Buscando a los agentes…',
    connected: 'Conectado',
    reconnecting: 'Se te cortó. Reconectando…',
    disconnected: 'Se cortó la conexión. Recargá la página.',
  },
} as const;
