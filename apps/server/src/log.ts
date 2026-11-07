const LEVELS = { info: 20, warn: 30, error: 40 } as const;
type Level = keyof typeof LEVELS;
type Fields = Record<string, unknown>;

export interface Logger {
  info(msg: string, fields?: Fields): void;
  warn(msg: string, fields?: Fields): void;
  error(msg: string, fields?: Fields): void;
}

const isLevel = (name: string): name is Level => Object.hasOwn(LEVELS, name);

/**
 * JSON-lines logger with levels (SPEC §10). Callers must never pass personal data
 * (nicknames, chat text): log ids, codes and counts only.
 */
export function createLogger({
  level,
  write = (line) => {
    process.stdout.write(line + '\n');
  },
}: {
  level: string;
  write?: (line: string) => void;
}): Logger {
  const min = LEVELS[isLevel(level) ? level : 'info'];
  const emit = (lvl: Level, msg: string, fields?: Fields) => {
    if (LEVELS[lvl] < min) return;
    write(JSON.stringify({ time: new Date().toISOString(), level: lvl, msg, ...fields }));
  };
  return {
    info: (msg, fields) => {
      emit('info', msg, fields);
    },
    warn: (msg, fields) => {
      emit('warn', msg, fields);
    },
    error: (msg, fields) => {
      emit('error', msg, fields);
    },
  };
}
