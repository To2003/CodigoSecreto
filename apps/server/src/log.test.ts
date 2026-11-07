import { describe, expect, it, vi } from 'vitest';
import { createLogger } from './log';

describe('createLogger', () => {
  it('writes messages at or above the configured level with their fields', () => {
    const write = vi.fn<(line: string) => void>();
    const log = createLogger({ level: 'warn', write });

    log.info('ignored');
    log.warn('room expired', { roomCode: 'KTRX' });
    log.error('boom');

    expect(write).toHaveBeenCalledTimes(2);
    expect(JSON.parse(write.mock.calls[0]?.[0] ?? '')).toMatchObject({
      level: 'warn',
      msg: 'room expired',
      roomCode: 'KTRX',
    });
    expect(JSON.parse(write.mock.calls[1]?.[0] ?? '')).toMatchObject({
      level: 'error',
      msg: 'boom',
    });
  });

  it('falls back to info for an unknown level name', () => {
    const write = vi.fn<(line: string) => void>();
    const log = createLogger({ level: 'verbose', write });
    log.info('shown');
    expect(write).toHaveBeenCalledOnce();
  });

  it('keeps its own fields when callers pass colliding keys', () => {
    const write = vi.fn<(line: string) => void>();
    createLogger({ level: 'info', write }).info('real', { level: 'debug', msg: 'fake' });
    expect(JSON.parse(write.mock.calls[0]?.[0] ?? '')).toMatchObject({
      level: 'info',
      msg: 'real',
    });
  });

  it('serializes errors and never throws on unserializable fields', () => {
    const write = vi.fn<(line: string) => void>();
    const log = createLogger({ level: 'info', write });
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    log.error('with error', { err: new TypeError('boom') });
    expect(() => {
      log.error('circular', { circular, big: 10n });
    }).not.toThrow();

    expect(JSON.parse(write.mock.calls[0]?.[0] ?? '')).toMatchObject({
      err: { name: 'TypeError', message: 'boom' },
    });
    expect(JSON.parse(write.mock.calls[1]?.[0] ?? '')).toMatchObject({
      level: 'error',
      msg: 'circular',
      logError: 'fields could not be serialized',
    });
  });
});
