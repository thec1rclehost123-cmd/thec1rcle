type CacheRecord<T> = {
  value: T;
  expiresAt: number;
};

export class TimedLruCache<T> {
  private map = new Map<string, CacheRecord<T>>();

  constructor(private readonly maxEntries: number) {}

  get(key: string): CacheRecord<T> | undefined {
    const record = this.map.get(key);
    if (!record) return undefined;
    this.map.delete(key);
    this.map.set(key, record);
    return record;
  }

  getFreshValue(key: string, now = Date.now()): T | null {
    const record = this.get(key);
    if (!record) return null;
    if (record.expiresAt <= now) {
      this.map.delete(key);
      return null;
    }
    return record.value;
  }

  set(key: string, value: T, ttlMs: number, now = Date.now()) {
    this.map.delete(key);
    if (this.map.size >= this.maxEntries) {
      const oldestKey = this.map.keys().next().value;
      if (oldestKey) this.map.delete(oldestKey);
    }
    this.map.set(key, {
      value,
      expiresAt: now + ttlMs,
    });
  }

  clear() {
    this.map.clear();
  }
}
