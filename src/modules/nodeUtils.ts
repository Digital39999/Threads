export class AdvancedSet<T> extends Set {
	constructor(data: T[] | Set<T> | AdvancedSet<T> | Iterable<T> | null) {
		super(Array.isArray(data) ? data : data ? [...data] : null);
	}

	public add(...values: T[]): this {
		for (const value of values) super.add(value);
		return this;
	}

	public addEx(seconds: number, ...values: T[]): this {
		for (const value of values) super.add(value);
		setTimeout(() => this.delete(...values), seconds * 1000);
		return this;
	}

	public delete(...values: T[]): boolean {
		for (const value of values) super.delete(value);
		return false;
	}

	public clear(): void {
		super.clear();
	}

	public first(): T | undefined {
		return this.values().next().value;
	}

	public last(): T | undefined {
		return [...this.values()].pop();
	}

	public random(): T | undefined {
		return [...this.values()][Math.floor(Math.random() * this.size)];
	}

	public toArray(): T[] {
		return [...this.values()];
	}

	public map<U>(callbackfn: (value: T, index: number, array: T[]) => U, thisArg?: unknown): U[] {
		return this.toArray().map(callbackfn, thisArg);
	}
}

export class AdvancedMap<K, V> extends Map<K, V> {
	constructor(entries?: readonly (readonly [K, V])[] | null) {
		super(entries);
	}

	public set(key: K, value: V): this {
		super.set(key, value);
		return this;
	}

	public setEx(seconds: number, key: K, value: V): this {
		super.set(key, value); setTimeout(() => this.delete(key), seconds * 1000);
		return this;
	}

	public delete(...keys: K[]): boolean {
		for (const key of keys) super.delete(key);
		return false;
	}

	public clear(): void {
		super.clear();
	}

	public first(): V | undefined {
		return this.values().next().value;
	}

	public last(): V | undefined {
		return [...this.values()].pop();
	}

	public random(): V | undefined {
		return [...this.values()][Math.floor(Math.random() * this.size)];
	}

	public toArray(): V[] {
		return [...this.values()];
	}

	public map<U>(callbackfn: (value: V, index: number, array: V[]) => U, thisArg?: unknown): U[] {
		return this.toArray().map(callbackfn, thisArg);
	}
}
