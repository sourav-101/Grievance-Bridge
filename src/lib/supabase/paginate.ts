import "server-only";

/** Supabase (PostgREST) returns at most 1000 rows per request by default, whatever `.limit()` asks for. */
export const PAGE_SIZE = 1000;

type Page = PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>;

/**
 * Fetch every row of a query by walking `.range()` pages. `page(from, to)` must
 * build a fresh query with a stable `.order()` and apply `.range(from, to)`.
 * Rows are returned as `T` (supabase-js has no generated types in this project).
 */
export async function fetchAllRows<T>(page: (from: number, to: number) => Page, max = 50_000): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; from < max; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    rows.push(...((data ?? []) as T[]));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return rows;
}
