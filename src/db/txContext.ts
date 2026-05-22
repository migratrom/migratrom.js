import { AsyncLocalStorage } from "node:async_hooks";

export function createTxContext<T>() {
	const store = new AsyncLocalStorage<T>();
	return {
		getActive(): T | undefined {
			return store.getStore();
		},
		run<R>(handle: T, fn: () => Promise<R>): Promise<R> {
			if (store.getStore() !== undefined) return fn();
			return store.run(handle, fn);
		},
		runWithBegin<R>(
			begin: (fn: () => Promise<R>) => Promise<R>,
			handle: T,
			fn: () => Promise<R>,
		): Promise<R> {
			if (store.getStore() !== undefined) return fn();
			return begin(() => store.run(handle, fn));
		},
	};
}
