// Cache

const store = new Map<string, unknown>();

export const cache = {
  get<T>(key: string): T | undefined {
    return store.get(key) as T | undefined;
  },
  set<T>(key: string, value: T): void {
    store.set(key, value);
  },
  clear(): void {
    store.clear();
  },
};
