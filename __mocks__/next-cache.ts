// Mock for next/cache — unstable_cache just calls the function directly in tests
export function unstable_cache<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T
): T {
  return fn;
}
