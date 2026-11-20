import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  BUCKETS,
  COLUMNS,
  MIGRATION_FILES,
  RPCS,
  TABLES,
  VIEWS,
} from '../scripts/preflight-manifest.mjs';

/**
 * The deploy preflight is only useful if it knows about everything a migration
 * creates. Without this guard, a new migration would ship while
 * `npm run preflight` still answered OK — the exact failure mode it exists to
 * prevent.
 */

const MIGRATIONS_DIR = join(process.cwd(), 'supabase/migrations');
const files = readdirSync(MIGRATIONS_DIR).filter((name) => name.endsWith('.sql')).sort();
const sqlByFile = new Map(
  files.map((name) => [name, readFileSync(join(MIGRATIONS_DIR, name), 'utf8')]),
);

function missingFromManifest(name: string): boolean {
  return !TABLES.some((table) => table.name === name);
}

describe('preflight manifest', () => {
  it('lists every migration file', () => {
    expect([...MIGRATION_FILES].sort()).toEqual(files);
  });

  it('declares every table a migration creates', () => {
    const missing: string[] = [];
    for (const [file, sql] of sqlByFile) {
      for (const match of sql.matchAll(/^create table (?:if not exists )?public\.([a-z0-9_]+)/gim)) {
        const table = match[1]!;
        if (missingFromManifest(table)) missing.push(`${file}: public.${table}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('attributes each table to the migration that creates it', () => {
    const wrong: string[] = [];
    for (const table of TABLES) {
      const sql = sqlByFile.get(table.migration) ?? '';
      if (!new RegExp(`^create table (?:if not exists )?public\\.${table.name}\\b`, 'm').test(sql)) {
        wrong.push(`public.${table.name} is not created by ${table.migration}`);
      }
    }
    expect(wrong).toEqual([]);
  });

  it('declares every view a migration defines', () => {
    const declared = new Set(VIEWS.map((view) => view.name));
    const missing: string[] = [];
    for (const [file, sql] of sqlByFile) {
      for (const match of sql.matchAll(/^create or replace view public\.([a-z0-9_]+)/gim)) {
        if (!declared.has(match[1]!)) missing.push(`${file}: public.${match[1]}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('points every declared RPC at a migration that really defines it', () => {
    const wrong: string[] = [];
    for (const rpc of RPCS) {
      const sql = sqlByFile.get(rpc.migration) ?? '';
      if (!sql.includes(`function public.${rpc.name}`)) {
        wrong.push(`${rpc.name}() is not defined by ${rpc.migration}`);
      }
    }
    expect(wrong).toEqual([]);
  });

  it('points every declared column at a migration that adds it', () => {
    const wrong: string[] = [];
    for (const column of COLUMNS) {
      const sql = sqlByFile.get(column.migration) ?? '';
      if (!sql.includes(`public.${column.table}`) || !sql.includes(column.column)) {
        wrong.push(`${column.table}.${column.column} is not added by ${column.migration}`);
      }
    }
    expect(wrong).toEqual([]);
  });

  it('declares every bucket a migration creates, with its access flag', () => {
    const expected = new Map<string, boolean>();
    for (const [, sql] of sqlByFile) {
      for (const match of sql.matchAll(/\('([a-z-]+)', '[a-z-]+', (true|false)\)/g)) {
        expected.set(match[1]!, match[2] === 'true');
      }
    }
    expect(expected.size).toBeGreaterThan(0);
    const declared = new Map(BUCKETS.map((bucket) => [bucket.id, bucket.public]));
    expect([...declared.keys()].sort()).toEqual([...expected.keys()].sort());
    for (const [id, isPublic] of expected) {
      expect(declared.get(id), `public flag for ${id}`).toBe(isPublic);
    }
  });
});
