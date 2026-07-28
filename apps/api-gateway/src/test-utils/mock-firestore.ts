type FilterOp = '==' | '>=' | '<=' | 'in' | 'array-contains';

interface Filter {
  field: string;
  op: FilterOp;
  value: any;
}

function isPlainObject(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function deepMerge(base: Record<string, any>, patch: Record<string, any>): Record<string, any> {
  const next: Record<string, any> = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (isPlainObject(value) && isPlainObject(next[key])) {
      next[key] = deepMerge(next[key], value);
      continue;
    }
    next[key] = value;
  }
  return next;
}

function getPathId(path: string) {
  const parts = path.split('/');
  return parts[parts.length - 1] || '';
}

function isDirectChild(parentPath: string, candidatePath: string) {
  const prefix = `${parentPath}/`;
  if (!candidatePath.startsWith(prefix)) return false;
  return !candidatePath.slice(prefix.length).includes('/');
}

class MockDocumentSnapshot {
  constructor(
    public readonly id: string,
    private readonly payload: any,
    public readonly ref?: MockDocRef,
  ) {}

  get exists() {
    return this.payload !== undefined;
  }

  data() {
    return this.payload;
  }
}

class MockDocRef {
  constructor(
    private readonly db: MockFirestore,
    public readonly path: string,
  ) {}

  get id() {
    return getPathId(this.path);
  }

  async get() {
    return new MockDocumentSnapshot(this.id, this.db.docs.get(this.path), this);
  }

  async update(data: Record<string, any>) {
    const current = this.db.docs.get(this.path);
    if (current === undefined) {
      throw new Error(`Document does not exist: ${this.path}`);
    }
    this.db.docs.set(this.path, deepMerge(current, data));
  }

  async set(data: Record<string, any>, options?: { merge?: boolean }) {
    const current = this.db.docs.get(this.path);
    if (options?.merge && isPlainObject(current)) {
      this.db.docs.set(this.path, deepMerge(current, data));
      return;
    }
    this.db.docs.set(this.path, data);
  }

  collection(name: string) {
    return new MockCollectionRef(this.db, `${this.path}/${name}`);
  }
}

class MockQuery {
  readonly __mockQuery = true;

  constructor(
    private readonly db: MockFirestore,
    private readonly collectionPath: string,
    private readonly filters: Filter[] = [],
    private readonly orderField?: string,
    private readonly orderDirection: 'asc' | 'desc' = 'asc',
    private readonly limitSize?: number,
    private readonly cursorId?: string,
  ) {}

  where(field: string | { toString(): string }, op: FilterOp, value: any) {
    return new MockQuery(
      this.db,
      this.collectionPath,
      [...this.filters, { field: String(field), op, value }],
      this.orderField,
      this.orderDirection,
      this.limitSize,
      this.cursorId,
    );
  }

  orderBy(field: string | { toString(): string }, direction: 'asc' | 'desc' = 'asc') {
    return new MockQuery(
      this.db,
      this.collectionPath,
      this.filters,
      String(field),
      direction,
      this.limitSize,
      this.cursorId,
    );
  }

  limit(size: number) {
    return new MockQuery(
      this.db,
      this.collectionPath,
      this.filters,
      this.orderField,
      this.orderDirection,
      size,
      this.cursorId,
    );
  }

  startAfter(cursor: { id: string }) {
    return new MockQuery(
      this.db,
      this.collectionPath,
      this.filters,
      this.orderField,
      this.orderDirection,
      this.limitSize,
      cursor.id,
    );
  }

  count() {
    return {
      get: async () => {
        const snapshot = await this.get();
        return { data: () => ({ count: snapshot.size }) };
      },
    };
  }

  aggregate(fields: Record<string, { aggregateType: 'count' | 'sum'; _field?: string }>) {
    return {
      get: async () => {
        const snapshot = await this.get();
        const data = Object.fromEntries(
          Object.entries(fields).map(([alias, aggregate]) => {
            if (aggregate.aggregateType === 'count') return [alias, snapshot.size];
            const sum = snapshot.docs.reduce(
              (total, doc) => total + Number(doc.data()?.[aggregate._field as string] || 0),
              0,
            );
            return [alias, sum];
          }),
        );
        return { data: () => data };
      },
    };
  }

  async get() {
    let docs = Array.from(this.db.docs.entries())
      .filter(([path]) => isDirectChild(this.collectionPath, path))
      .map(
        ([path, payload]) =>
          new MockDocumentSnapshot(getPathId(path), payload, new MockDocRef(this.db, path)),
      );

    docs = docs.filter((doc) => {
      const data = doc.data() || {};
      return this.filters.every((filter) => {
        const value = filter.field === '__name__' ? doc.id : data[filter.field];
        if (filter.op === '==') return value === filter.value;
        if (filter.op === '>=') return value >= filter.value;
        if (filter.op === '<=') return value <= filter.value;
        if (filter.op === 'in') return Array.isArray(filter.value) && filter.value.includes(value);
        if (filter.op === 'array-contains') {
          return Array.isArray(value) && value.includes(filter.value);
        }
        return false;
      });
    });

    if (this.orderField) {
      docs.sort((left, right) => {
        const leftValue =
          this.orderField === '__name__' ? left.id : left.data()?.[this.orderField as string];
        const rightValue =
          this.orderField === '__name__' ? right.id : right.data()?.[this.orderField as string];
        if (leftValue === rightValue) return 0;
        const result = leftValue > rightValue ? 1 : -1;
        return this.orderDirection === 'desc' ? result * -1 : result;
      });
    }

    if (this.cursorId) {
      const cursorIndex = docs.findIndex((doc) => doc.id === this.cursorId);
      docs = cursorIndex < 0 ? [] : docs.slice(cursorIndex + 1);
    }

    if (typeof this.limitSize === 'number') docs = docs.slice(0, this.limitSize);

    return {
      docs,
      empty: docs.length === 0,
      size: docs.length,
    };
  }
}

class MockCollectionRef {
  constructor(
    private readonly db: MockFirestore,
    private readonly path: string,
  ) {}

  doc(id?: string) {
    const resolvedId = id || this.db.nextId();
    return new MockDocRef(this.db, `${this.path}/${resolvedId}`);
  }

  where(field: string | { toString(): string }, op: FilterOp, value: any) {
    return new MockQuery(this.db, this.path).where(field, op, value);
  }

  orderBy(field: string | { toString(): string }, direction: 'asc' | 'desc' = 'asc') {
    return new MockQuery(this.db, this.path).orderBy(field, direction);
  }

  limit(size: number) {
    return new MockQuery(this.db, this.path).limit(size);
  }

  async add(data: Record<string, any>) {
    const ref = this.doc();
    this.db.docs.set(ref.path, data);
    return ref;
  }

  async get() {
    return new MockQuery(this.db, this.path).get();
  }
}

class MockTransaction {
  constructor(private readonly db: MockFirestore) {}

  async get(target: any) {
    return target.get();
  }

  set(ref: MockDocRef, data: Record<string, any>, options?: { merge?: boolean }) {
    const current = this.db.docs.get(ref.path);
    if (options?.merge && isPlainObject(current)) {
      this.db.docs.set(ref.path, deepMerge(current, data));
      return;
    }
    this.db.docs.set(ref.path, data);
  }

  create(ref: MockDocRef, data: Record<string, any>) {
    if (this.db.docs.has(ref.path)) {
      throw new Error(`Document already exists: ${ref.path}`);
    }
    this.db.docs.set(ref.path, data);
  }

  update(ref: MockDocRef, data: Record<string, any>) {
    const current = this.db.docs.get(ref.path) || {};
    this.db.docs.set(ref.path, deepMerge(current, data));
  }

  delete(ref: MockDocRef) {
    this.db.docs.delete(ref.path);
  }
}

class MockBatch {
  private readonly ops: Array<() => void> = [];

  constructor(private readonly db: MockFirestore) {}

  set(ref: MockDocRef, data: Record<string, any>, options?: { merge?: boolean }) {
    this.ops.push(() => {
      const current = this.db.docs.get(ref.path);
      if (options?.merge && isPlainObject(current)) {
        this.db.docs.set(ref.path, deepMerge(current, data));
        return;
      }
      this.db.docs.set(ref.path, data);
    });
    return this;
  }

  update(ref: MockDocRef, data: Record<string, any>) {
    this.ops.push(() => {
      const current = this.db.docs.get(ref.path) || {};
      this.db.docs.set(ref.path, deepMerge(current, data));
    });
    return this;
  }

  delete(ref: MockDocRef) {
    this.ops.push(() => {
      this.db.docs.delete(ref.path);
    });
    return this;
  }

  async commit() {
    for (const op of this.ops) op();
  }
}

export class MockFirestore {
  readonly docs = new Map<string, any>();
  private counter = 0;

  seed(path: string, data: Record<string, any>) {
    this.docs.set(path, data);
  }

  nextId() {
    this.counter += 1;
    return `mock_${this.counter}`;
  }

  collection(path: string) {
    return new MockCollectionRef(this, path);
  }

  batch() {
    return new MockBatch(this);
  }

  async runTransaction<T>(handler: (transaction: MockTransaction) => Promise<T>) {
    return handler(new MockTransaction(this));
  }

  listCollection(path: string) {
    return Array.from(this.docs.entries())
      .filter(([candidate]) => isDirectChild(path, candidate))
      .map(([candidate, payload]) => ({
        path: candidate,
        id: getPathId(candidate),
        data: payload,
      }));
  }

  getDoc(path: string) {
    return this.docs.get(path);
  }
}
