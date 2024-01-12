export default class PromiseHandler {
	public promises: Map<string, { resolve: (value: string | null) => void; selfDestruct: NodeJS.Timeout; userId: string; }> = new Map();

	public async createPromise(id: string, userId: string): Promise<string | null> {
		return new Promise<string | null>((resolve) => {
			this.promises.set(id, { resolve, selfDestruct: setTimeout(() => { this.promises.delete(id); resolve(null); }, 60000), userId }); // 1 minute
		});
	}

	public async resolvePromise(id: string, value: string | null, userId: string): Promise<boolean | null> {
		if (!this.promises.has(id)) return null;

		const promise = this.promises.get(id);
		if (promise?.userId !== userId) return false;

		promise.resolve(value);
		this.promises.delete(id);

		clearTimeout(promise.selfDestruct);
		return true;
	}
}
