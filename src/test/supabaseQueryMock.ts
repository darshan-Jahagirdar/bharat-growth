import { vi } from 'vitest';

export interface QueryCall {
  method: string;
  args: unknown[];
}

export interface QueryResult<T = unknown> {
  data: T;
  error: { message: string; code?: string } | null;
}

export interface QueryBuilder<T = unknown> {
  calls: QueryCall[];
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  or: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  range: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
  gt: ReturnType<typeof vi.fn>;
  gte: ReturnType<typeof vi.fn>;
  lte: ReturnType<typeof vi.fn>;
  lt: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
  then: PromiseLike<QueryResult<T>>['then'];
}

const CHAIN_METHODS = [
  'select',
  'eq',
  'or',
  'limit',
  'order',
  'range',
  'in',
  'gt',
  'gte',
  'lte',
  'lt',
  'update',
  'insert',
  'single',
] as const;

export function createQueryBuilder<T = unknown>(
  result: QueryResult<T>
): QueryBuilder<T> {
  const calls: QueryCall[] = [];
  const builder = { calls } as unknown as QueryBuilder<T>;

  for (const method of CHAIN_METHODS) {
    builder[method] = vi.fn((...args: unknown[]) => {
      calls.push({ method, args });
      return builder;
    });
  }

  builder.then = (onfulfilled, onrejected) =>
    Promise.resolve(result).then(onfulfilled, onrejected);

  return builder;
}

export function expectQueryCalls(builder: QueryBuilder): QueryCall[] {
  return builder.calls;
}
