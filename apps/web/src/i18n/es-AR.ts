import type { AvatarColor, ErrorCode, StartBlocker, Team } from '@clave/shared';

/**
 * Todo el copy visible de la UI (SPEC §3.5): castellano rioplatense, con voseo.
 * Nada de strings literales en JSX: se importan de acá.
 */
const teamName: Record<Team, string> = { red: 'Equipo Rojo', blue: 'Equipo Azul' };

export const t = {
  app: {
    name: 'Clave',
    tagline: 'Deducción por equipos con palabras. Armá una sala y jugá con tus amigos.',
    footer: 'Inspirado en juegos de deducción por equipos. Proyecto sin fines de lucro.',
  },
  connection: {
    connecting: 'Buscando a los agentes…',
    connected: 'Conectado',
    reconnecting: 'Se te cortó. Reconectando…',
    disconnected: 'Se cortó la conexión. Recargá la página.',
  },
  landing: {
    create: 'Crear sala',
    creating: 'Armando la sala…',
    joinTitle: 'Unirse con código',
    codeLabel: 'Código de sala',
    codePlaceholder: 'KTRX',
    codeHelp: 'Son 4 letras. Te lo pasa quien armó la sala.',
    join: 'Entrar',
  },
  profile: {
    title: 'Tu perfil',
    nickname: 'Apodo',
    nicknamePlaceholder: 'Cómo te van a ver',
    nicknameMissing: 'Poné un apodo para entrar.',
    avatar: 'Avatar',
    avatarOption: (n: number) => `Avatar ${n}`,
    color: 'Color del accesorio',
    colors: {
      oro: 'Oro',
      turquesa: 'Turquesa',
      violeta: 'Violeta',
      coral: 'Coral',
      lima: 'Lima',
      pizarra: 'Pizarra',
    } satisfies Record<AvatarColor, string>,
  },
  room: {
    joining: (code: string) => `Entrando a la sala ${code}…`,
    joinTitle: (code: string) => `Te sumás a la sala ${code}`,
    kicked: 'Te sacaron de la sala.',
    backHome: 'Volver al inicio',
    notFoundPage: 'Esa página no existe.',
  },
  lobby: {
    title: (code: string) => `Sala ${code}`,
    copyLink: 'Copiar link',
    copied: '¡Copiado!',
    share: 'Compartir',
    shareText: (code: string) => `¡Sumate a mi sala de Clave! Código ${code}`,
    teamName,
    teamLabel: (team: Team, custom: string) => custom || teamName[team],
    spectators: 'Espectadores',
    spymaster: 'Jefe de espías',
    agents: 'Agentes',
    noSpymaster: 'Sin jefe todavía',
    noAgents: 'Nadie todavía',
    noSpectators: 'Nadie mirando',
    joinTeam: 'Sumarme',
    beSpymaster: 'Ser jefe',
    beAgent: 'Ser agente',
    watch: 'Mirar',
    you: 'vos',
    host: 'host',
    disconnected: 'desconectado',
    kick: (name: string) => `Echar a ${name}`,
    kickIcon: '✕',
    randomize: 'Sortear equipos y jefes',
    leave: 'Salir de la sala',
    start: 'Empezar',
    ready: '¡Listos! Cuando quieras, arrancá.',
    waitingHost: 'Esperando a que el host arranque la partida…',
    blocker: (b: StartBlocker, names: Record<Team, string>): string => {
      switch (b.code) {
        case 'NO_SPYMASTER':
          return `Falta un jefe en el ${names[b.team]}`;
        case 'TOO_MANY_SPYMASTERS':
          return `Hay más de un jefe en el ${names[b.team]}`;
        case 'NO_AGENT':
          return `Falta al menos un agente en el ${names[b.team]}`;
        case 'NOT_ENOUGH_WORDS':
          return 'Faltan palabras: elegí un mazo o cargá al menos 25.';
        case 'MODE_NOT_AVAILABLE':
          return 'El modo cooperativo todavía no está disponible.';
      }
    },
  },
  settings: {
    title: 'Configuración',
    readOnly: 'Solo quien armó la sala puede cambiarla.',
    mode: 'Modo',
    modes: { classic: 'Clásico', coop: 'Cooperativo (próximamente)' },
    decks: 'Mazos',
    customWords: 'Palabras propias',
    customWordsHelp:
      'Separadas por coma o en renglones distintos. Una palabra de 2 a 14 letras cada una.',
    customWordsRejected: (words: string[]) => `No se usaron: ${words.join(', ')}`,
    customWordsCount: (n: number) => (n === 1 ? '1 palabra propia' : `${n} palabras propias`),
    customShare: 'Porcentaje de palabras propias',
    clueTimer: 'Tiempo para la pista',
    guessTimer: 'Tiempo para adivinar',
    timerOff: 'Sin tiempo',
    seconds: (n: number) => `${n} s`,
    firstTurnBonus: '+30 s en el primer turno de cada equipo',
    revealMode: 'Cómo se revela una carta',
    revealModes: { any: 'Cualquier agente', majority: 'Mayoría del equipo' },
    objections: 'Objeciones a las pistas',
    spectatorsSeeMap: 'Los espectadores ven el mapa',
    compoundWords: 'Pistas con palabras compuestas (con guion)',
    chat: 'Chat',
    teamNames: 'Nombres de los equipos',
  },
  errors: {
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
    TIMEOUT: 'El server no contesta. Revisá tu conexión y probá de nuevo.',
  } satisfies Record<ErrorCode | 'TIMEOUT', string>,
} as const;
