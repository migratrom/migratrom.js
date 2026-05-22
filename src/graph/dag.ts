import {
	CycleDetectedError,
	DuplicateMigrationIdError,
	MissingParentError,
	MissingRootError,
	MultipleRootsError,
} from "../errors.ts";
import type { Migration } from "../types.ts";

export function planOrder(migrations: Migration[], appliedIds: ReadonlySet<number>): Migration[] {
	const byId = new Map<number, Migration>();
	for (const m of migrations) {
		if (byId.has(m.id)) throw new DuplicateMigrationIdError(m.id);
		byId.set(m.id, m);
	}

	const roots = migrations.filter((m) => m.parentId === null);
	if (appliedIds.size === 0) {
		if (roots.length === 0) throw new MissingRootError();
		if (roots.length > 1) throw new MultipleRootsError(roots.map((r) => r.id));
	} else {
		const newRoots = roots.filter((r) => !appliedIds.has(r.id));
		if (newRoots.length > 0) {
			throw new MultipleRootsError(newRoots.map((r) => r.id));
		}
	}

	for (const m of migrations) {
		if (m.parentId === null) continue;
		const parentInBatch = byId.has(m.parentId);
		const parentApplied = appliedIds.has(m.parentId);
		if (!parentInBatch && !parentApplied) {
			throw new MissingParentError(m.id, m.parentId);
		}
	}

	const depthCache = new Map<number, number>();

	function depth(id: number, path: Set<number>): number {
		const cached = depthCache.get(id);
		if (cached !== undefined) return cached;

		if (path.has(id)) {
			throw new CycleDetectedError([...path, id]);
		}
		path.add(id);

		const m = byId.get(id);
		if (!m) {
			// Parent-only-in-history: treat as depth 0 anchor for children in batch
			depthCache.set(id, 0);
			path.delete(id);
			return 0;
		}

		let d: number;
		if (m.parentId === null) {
			d = 0;
		} else {
			d = depth(m.parentId, path) + 1;
		}
		path.delete(id);
		depthCache.set(id, d);
		return d;
	}

	for (const m of migrations) {
		depth(m.id, new Set());
	}

	const pending = migrations
		.filter((m) => !appliedIds.has(m.id))
		.sort((a, b) => {
			const da = depth(a.id, new Set());
			const db = depth(b.id, new Set());
			if (da !== db) return da - db;
			return a.id - b.id;
		});

	return pending;
}
