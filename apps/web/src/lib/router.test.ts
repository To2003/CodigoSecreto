import { describe, expect, it } from 'vitest';
import { parseRoute, roomPath } from './router';

describe('parseRoute', () => {
  it.each([
    ['/', { name: 'home' }],
    ['', { name: 'home' }],
    ['/sala/KTRX', { name: 'room', code: 'KTRX' }],
    ['/sala/ktrx/', { name: 'room', code: 'KTRX' }],
    ['/sala/KTR', { name: 'notFound' }],
    ['/otra', { name: 'notFound' }],
    ['/reglas', { name: 'rules' }],
    ['/tutorial/', { name: 'tutorial' }],
    ['/reglasx', { name: 'notFound' }],
    ['/sala/ktrx/mesa', { name: 'table', code: 'KTRX' }],
    ['/sala/KTRX/mesa/x', { name: 'notFound' }],
  ])('%j', (path, route) => {
    expect(parseRoute(path)).toEqual(route);
  });

  it('builds room paths', () => {
    expect(roomPath('KTRX')).toBe('/sala/KTRX');
  });
});
