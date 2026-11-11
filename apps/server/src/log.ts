const LEVELS = { info: 20, warn: 30, error: 40 } as const;
type Level = keyof typeof LEVELS;
type Fields = Record<string, unknown>;

export interface Logger {
  info(msg: string, fields?: Fields): void;
  warn(msg: string, fields?: Fields): void;
  error(msg: string, fields?: Fields): void;
}

const isLevel = (name: string): name is Level => Object.hasOwn(LEVELS, name);

/** JSON.stringify drops Error fields and throws on BigInt; make both loggable. */
const serialize = (_key: string, value: unknown): unknown => {
  if (value instanceof Error) return { name: value.name, message: value.message };
  if (typeof value === 'bigint') return value.toString();
  return value;
};

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
    // Own keys go last so a caller's { level, msg } can't overwrite them.
    const base = { time: new Date().toISOString(), level: lvl, msg };
    let line: string;
    try {
      line = JSON.stringify({ ...fields, ...base }, serialize);
    } catch {
      // Circular structures: logging must never throw inside a request or socket handler.
      line = JSON.stringify({ ...base, logError: 'fields could not be serialized' });
    }
    write(line);
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
