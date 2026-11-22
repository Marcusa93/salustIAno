/**
 * Cliente de Supabase falso y mínimo para tests de Server Actions: registra
 * cada `from(tabla).<op>()` con sus filtros y devuelve lo que diga el handler
 * de esa tabla/operación.
 */

export interface FakeResult {
  data?: unknown;
  error?: { code?: string; message?: string } | null;
}

type Operation = 'select' | 'insert' | 'delete' | 'update';
type Handler = (payload: unknown) => FakeResult;

export class FakeQuery implements PromiseLike<FakeResult> {
  readonly filters: Array<[string, ...unknown[]]> = [];

  constructor(private readonly run: () => FakeResult) {}

  private filter(name: string, args: unknown[]) {
    this.filters.push([name, ...args]);
    return this;
  }
  select(...args: unknown[]) {
    return this.filter('select', args);
  }
  eq(...args: unknown[]) {
    return this.filter('eq', args);
  }
  neq(...args: unknown[]) {
    return this.filter('neq', args);
  }
  is(...args: unknown[]) {
    return this.filter('is', args);
  }
  limit(...args: unknown[]) {
    return this.filter('limit', args);
  }
  maybeSingle() {
    return Promise.resolve(this.run());
  }
  // biome-ignore lint/suspicious/noThenProperty: imita el builder thenable de supabase-js.
  then<T1 = FakeResult, T2 = never>(
    onfulfilled?: ((value: FakeResult) => T1 | PromiseLike<T1>) | null,
    onrejected?: ((reason: unknown) => T2 | PromiseLike<T2>) | null,
  ): PromiseLike<T1 | T2> {
    return Promise.resolve(this.run()).then(onfulfilled, onrejected);
  }
}

export interface FakeCall {
  table: string;
  op: Operation;
  payload: unknown;
  query: FakeQuery;
}

export function createFakeSupabase(
  handlers: Record<string, Partial<Record<Operation, Handler>>> = {},
  userId: string | null = 'user-1',
) {
  const calls: FakeCall[] = [];
  return {
    calls,
    callsTo(table: string, op?: Operation) {
      return calls.filter((call) => call.table === table && (!op || call.op === op));
    },
    auth: {
      getUser: async () => ({ data: { user: userId ? { id: userId } : null } }),
    },
    from(table: string) {
      const start = (op: Operation, payload?: unknown) => {
        const handler = handlers[table]?.[op];
        const query = new FakeQuery(() => handler?.(payload) ?? { data: null, error: null });
        calls.push({ table, op, payload, query });
        return query;
      };
      return {
        select: (...args: unknown[]) => start('select').select(...args),
        insert: (row: unknown) => start('insert', row),
        delete: () => start('delete'),
        update: (values: unknown) => start('update', values),
      };
    },
  };
}
