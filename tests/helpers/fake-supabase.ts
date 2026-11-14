/**
 * Minimal in-memory PostgREST query builder for the hosted store tests.
 *
 * It implements only the chains the stores use:
 *   select / insert / upsert / update / delete
 *   eq / order / limit / maybeSingle / single
 *   select(..., { count: 'exact', head: true })
 *   rpc('increment_faq_topic')
 *
 * The real Supabase client is replaced through `vi.mock`, so these tests
 * exercise query shape and mapping without a network call.
 */
type Row = Record<string, unknown>;

interface FakeDatabase {
  profile_customizations: Row[];
  seller_follows: Row[];
  story_submissions: Row[];
  inspection_bookings: Row[];
  support_requests: Row[];
  ai_faq_counts: Row[];
  platform_settings: Row[];
}

export const socialTables: FakeDatabase = {
  profile_customizations: [],
  seller_follows: [],
  story_submissions: [],
  inspection_bookings: [],
  support_requests: [],
  ai_faq_counts: [],
  platform_settings: [],
};

/** In-memory object storage keyed by bucket then object path. */
export const socialStorage: Record<string, Map<string, Uint8Array>> = {
  'profile-media': new Map(),
  'story-media': new Map(),
};

export function resetSocialDb(): void {
  for (const key of Object.keys(socialTables) as Array<keyof FakeDatabase>) {
    socialTables[key] = [];
  }
  for (const bucket of Object.values(socialStorage)) bucket.clear();
}

type Filter = [string, unknown];
type CountOptions = { count?: 'exact'; head?: boolean } | undefined;

class FakeQuery {
  private filters: Filter[] = [];
  private operation: 'select' | 'insert' | 'upsert' | 'update' | 'delete' = 'select';
  private payload: Row | Row[] | null = null;
  private conflict = 'id';
  private orderBy: { column: string; ascending: boolean } | null = null;
  private maxRows: number | null = null;
  private countOptions: CountOptions = undefined;

  constructor(
    private readonly table: keyof FakeDatabase,
    private readonly db: FakeDatabase,
  ) {}

  select(_columns?: string, options?: CountOptions): this {
    this.countOptions = options;
    return this;
  }

  insert(payload: Row | Row[]): this {
    this.operation = 'insert';
    this.payload = payload;
    return this;
  }

  upsert(payload: Row | Row[], options?: { onConflict?: string }): this {
    this.operation = 'upsert';
    this.payload = payload;
    this.conflict = options?.onConflict ?? 'id';
    return this;
  }

  update(payload: Row): this {
    this.operation = 'update';
    this.payload = payload;
    return this;
  }

  delete(): this {
    this.operation = 'delete';
    return this;
  }

  eq(column: string, value: unknown): this {
    this.filters.push([column, value]);
    return this;
  }

  order(column: string, options?: { ascending?: boolean }): this {
    this.orderBy = { column, ascending: options?.ascending ?? true };
    return this;
  }

  limit(count: number): this {
    this.maxRows = count;
    return this;
  }

  maybeSingle(): Promise<{ data: Row | null; error: null; count: null }> {
    return Promise.resolve(this.result(true));
  }

  single(): Promise<{ data: Row | null; error: { message: string } | null; count: null }> {
    const result = this.result(true);
    if (!result.data) return Promise.resolve({ ...result, error: { message: 'no rows' } });
    return Promise.resolve(result);
  }

  then<TResult1 = unknown, TResult2 = never>(
    onfulfilled?: ((value: unknown) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.result(false)).then(onfulfilled, onrejected);
  }

  private matches(row: Row): boolean {
    return this.filters.every(([column, value]) => row[column] === value);
  }

  private result(single: boolean): {
    data: Row | Row[] | null;
    error: { message: string; code?: string } | null;
    count: number | null;
  } {
    const rows = this.db[this.table];
    if (this.operation === 'insert' || this.operation === 'upsert') {
      const payloads = Array.isArray(this.payload) ? this.payload : [this.payload ?? {}];
      const written: Row[] = [];
      for (const payload of payloads) {
        if (this.operation === 'insert' && this.table === 'seller_follows') {
          if (
            rows.some(
              (row) =>
                row.follower_id === payload.follower_id && row.seller_id === payload.seller_id,
            )
          ) {
            return {
              data: null,
              error: { message: 'duplicate key value', code: '23505' },
              count: null,
            };
          }
        }
        if (this.operation === 'insert' && this.table === 'support_requests') {
          if (rows.some((row) => row.code === payload.code)) {
            return {
              data: null,
              error: { message: 'duplicate key value', code: '23505' },
              count: null,
            };
          }
        }
        const existingIndex = rows.findIndex((row) => row[this.conflict] === payload[this.conflict]);
        if (this.operation === 'upsert' && existingIndex >= 0) {
          rows[existingIndex] = { ...rows[existingIndex], ...payload };
          written.push(rows[existingIndex]!);
          continue;
        }
        const created: Row = {
          id: crypto.randomUUID(),
          created_at: new Date().toISOString(),
          ...payload,
        };
        rows.push(created);
        written.push(created);
      }
      return {
        data: single ? (written[0] ?? null) : written,
        error: null,
        count: null,
      };
    }

    if (this.operation === 'update') {
      const updated: Row[] = [];
      for (let index = 0; index < rows.length; index += 1) {
        const row = rows[index]!;
        if (!this.matches(row)) continue;
        const next = { ...row, ...(this.payload as Row) };
        rows[index] = next;
        updated.push(next);
      }
      return {
        data: single ? (updated[0] ?? null) : updated,
        error: null,
        count: null,
      };
    }

    if (this.operation === 'delete') {
      this.db[this.table] = rows.filter((row) => !this.matches(row));
      return { data: null, error: null, count: null };
    }

    let matched = rows.filter((row) => this.matches(row));
    if (this.orderBy) {
      const { column, ascending } = this.orderBy;
      matched = [...matched].sort((a, b) => {
        const left = String(a[column] ?? '');
        const right = String(b[column] ?? '');
        return ascending ? left.localeCompare(right) : right.localeCompare(left);
      });
    }
    if (this.maxRows !== null) matched = matched.slice(0, this.maxRows);
    if (this.countOptions?.head) {
      return { data: null, error: null, count: matched.length };
    }
    return {
      data: single ? (matched[0] ?? null) : matched,
      error: null,
      count: this.countOptions?.count === 'exact' ? matched.length : null,
    };
  }
}

export function fakeAdmin(): {
  from: (table: keyof FakeDatabase) => FakeQuery;
  storage: {
    from: (bucket: string) => {
      upload: (
        path: string,
        bytes: Uint8Array,
      ) => Promise<{ data: { path: string }; error: { message: string } | null }>;
      getPublicUrl: (path: string) => { data: { publicUrl: string } };
      remove: (paths: string[]) => Promise<{ data: null; error: { message: string } | null }>;
    };
  };
  rpc: (
    name: string,
    params?: Record<string, unknown>,
  ) => Promise<{ data: null; error: { message: string } | null }>;
} {
  return {
    from: (table: keyof FakeDatabase) => new FakeQuery(table, socialTables),
    storage: {
      from: (bucket: string) => {
        const objects = (socialStorage[bucket] ??= new Map());
        return {
          upload: async (path: string, bytes: Uint8Array) => {
            objects.set(path, bytes);
            return { data: { path }, error: null };
          },
          getPublicUrl: (path: string) => ({
            data: {
              publicUrl: `https://fake.supabase.co/storage/v1/object/public/${bucket}/${path}`,
            },
          }),
          remove: async (paths: string[]) => {
            for (const path of paths) objects.delete(path);
            return { data: null, error: null };
          },
        };
      },
    },
    rpc: async (name, params) => {
      if (name !== 'increment_faq_topic') {
        return { data: null, error: { message: `unknown rpc: ${name}` } };
      }
      const topic = String(params?.topic_name ?? '');
      if (!topic) return { data: null, error: { message: 'topic required' } };
      const existing = socialTables.ai_faq_counts.find((row) => row.topic === topic);
      if (existing) existing.count = Number(existing.count ?? 0) + 1;
      else socialTables.ai_faq_counts.push({ topic, count: 1, updated_at: new Date().toISOString() });
      return { data: null, error: null };
    },
  };
}
