import type { ErrorCode } from '@clave/shared';

/**
 * Server-side text for error acks (SPEC §2.2: "mensajes en castellano rioplatense"). The web app
 * shows its own copy from es-AR.ts by code; this text is for logs and any other client.
 */
export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  BAD_REQUEST: 'Eso no se entendió. Probá de nuevo.',
  RATE_LIMITED: 'Más despacio, che: estás mandando demasiadas cosas.',
  ROOM_NOT_FOUND: 'No existe esa sala. Revisá el código.',
  ROOM_FULL: 'La sala está llena (16 jugadores).',
  NOT_IN_ROOM: 'No estás en ninguna sala.',
  NOT_HOST: 'Eso lo puede hacer solo quien armó la sala.',
  INVALID_NICKNAME: 'Poné un apodo con al menos una letra.',
  SPYMASTER_TAKEN: 'Ese equipo ya tiene jefe.',
  PLAYER_NOT_FOUND: 'No encontramos a ese jugador.',
  CANNOT_KICK_SELF: 'No te podés echar a vos mismo.',
  LOBBY_ONLY: 'Eso se cambia en el lobby, no durante la partida.',
  INTERNAL: 'Algo se rompió de nuestro lado. Probá de nuevo.',
};
