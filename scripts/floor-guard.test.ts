import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const GUARD = resolve(import.meta.dirname, 'floor-guard.mjs');

let repo: string;

const git = (...args: string[]) =>
  execFileSync('git', args, { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

const write = (path: string, content: string) => {
  const full = join(repo, path);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content);
};

const commitAll = (msg: string) => {
  git('add', '-A');
  git('commit', '-q', '--no-gpg-sign', '-m', msg);
};

const guard = (args: string[] = [], env: Record<string, string> = {}) => {
  const res = spawnSync('node', [GUARD, ...args], {
    cwd: repo,
    encoding: 'utf8',
    env: { ...process.env, CI: '', FLOOR_GUARD_BASE: '', ...env },
  });
  return { code: res.status, out: res.stdout + res.stderr };
};

beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), 'floor-guard-'));
  git('init', '-q', '-b', 'work');
  git('config', 'user.email', 'test@example.com');
  git('config', 'user.name', 'Test');
  write('.constraintsignore', 'docs/**\n');
  write('src/a.ts', 'export const a = 1;\n');
  write('src/a.test.ts', "it('a', () => {\n  expect(a).toBe(1);\n  expect(a).not.toBe(2);\n});\n");
  write('CONSTRAINTS.md', '| Cobertura | ≥ 95% de líneas | motivo |\n');
  commitAll('base');
});

afterEach(() => {
  rmSync(repo, { recursive: true, force: true });
});

describe('floor-guard without a main branch (compares against HEAD)', () => {
  it('is clean for an ordinary change', () => {
    write('src/b.ts', 'export const b = 2;\n');
    expect(guard()).toMatchObject({ code: 0 });
  });

  it('flags a deleted test file', () => {
    rmSync(join(repo, 'src/a.test.ts'));
    const res = guard();
    expect(res.code).toBe(1);
    expect(res.out).toContain('[test-deleted]');
  });

  it('flags an assertion removed from a test that stays', () => {
    write('src/a.test.ts', "it('a', () => {\n  expect(a).toBe(1);\n});\n");
    const res = guard();
    expect(res.code).toBe(1);
    expect(res.out).toContain('[assertion-removed]');
  });

  it('flags a loosened threshold in CONSTRAINTS.md', () => {
    write('CONSTRAINTS.md', '| Cobertura | ≥ 50% de líneas | motivo |\n');
    const res = guard();
    expect(res.code).toBe(1);
    expect(res.out).toContain('[threshold-loosened]');
  });

  it('stays silent when a threshold is tightened', () => {
    write('CONSTRAINTS.md', '| Cobertura | ≥ 98% de líneas | motivo |\n');
    expect(guard()).toMatchObject({ code: 0 });
  });

  it('refuses to run in CI without a base instead of reporting clean', () => {
    expect(guard([], { CI: 'true' })).toMatchObject({ code: 2 });
  });
});

describe('floor-guard patterns', () => {
  it.each([
    ['ts-ignore', '// @ts-ignore\n', 'silenced-checker'],
    ['ts-expect-error', '// @ts-expect-error\n', 'silenced-checker'],
    ['v8 ignore', '/* v8 ignore next */\n', 'silenced-checker'],
    ['eslint-disable', '// eslint-disable-next-line\n', 'silenced-checker'],
    ['it.only', "it.only('x', () => {});\n", 'test-made-easier'],
    ['it.skipIf', "it.skipIf(true)('x', () => {});\n", 'test-made-easier'],
    ['typed empty catch', 'try { f(); } catch (e: unknown) {}\n', 'unfinished-work'],
    ['empty promise catch', 'p.catch(() => {});\n', 'unfinished-work'],
    ['TODO', '// TODO: implement\n', 'unfinished-work'],
  ])('flags %s', (_name, line, rule) => {
    write('src/c.ts', line);
    const res = guard();
    expect(res.code).toBe(1);
    expect(res.out).toContain(`[${rule}]`);
  });

  it('flags an obvious secret without printing it, even in ignored files', () => {
    const key = 'AKIA' + 'ABCDEFGHIJKLMNOP';
    write('docs/notes.md', `key: ${key}\n`);
    const res = guard();
    expect(res.code).toBe(1);
    expect(res.out).toContain('[possible-secret]');
    expect(res.out).not.toContain(key);
  });

  it('exempts nested files matched by a ** glob in .constraintsignore', () => {
    write('docs/a/b/guide.md', 'Never add // @ts-ignore\n');
    expect(guard()).toMatchObject({ code: 0 });
  });
});

describe('floor-guard --staged', () => {
  it('checks what is committed, not the working tree', () => {
    write('src/d.ts', 'export const d = 1;\n');
    git('add', 'src/d.ts');
    write('src/d.ts', '// @ts-ignore\nexport const d = 1;\n');
    expect(guard(['--staged'])).toMatchObject({ code: 0 });

    git('add', 'src/d.ts');
    write('src/d.ts', 'export const d = 1;\n');
    const res = guard(['--staged']);
    expect(res.code).toBe(1);
    expect(res.out).toContain('[silenced-checker]');
  });

  it('ignores untracked files', () => {
    write('src/e.ts', '// @ts-ignore\n');
    expect(guard(['--staged'])).toMatchObject({ code: 0 });
  });
});

describe('floor-guard with a main branch', () => {
  it('diffs against the merge base with main', () => {
    git('branch', 'main');
    write('src/f.ts', '// @ts-ignore\n');
    commitAll('add f');
    const res = guard();
    expect(res.code).toBe(1);
    expect(res.out).toContain('base: main');
  });
});
