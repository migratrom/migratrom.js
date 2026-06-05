import type { Check, ExecuteStep, Operation } from "../types.ts";

const FORMAT_VERSION = "migratrom/ops/v1";
const encoder = new TextEncoder();

class ByteWriter {
	private readonly chunks: Uint8Array[] = [];
	private length = 0;

	appendU8(value: number): void {
		const bytes = Uint8Array.of(value);
		this.chunks.push(bytes);
		this.length += bytes.length;
	}

	appendU32(value: number): void {
		if (!Number.isSafeInteger(value) || value < 0 || value > 0xffffffff) {
			throw new RangeError(`value does not fit in u32: ${value}`);
		}
		const bytes = new Uint8Array(4);
		new DataView(bytes.buffer).setUint32(0, value, false);
		this.chunks.push(bytes);
		this.length += bytes.length;
	}

	appendField(value: string): void {
		const bytes = encoder.encode(value);
		this.appendU32(bytes.length);
		this.chunks.push(bytes);
		this.length += bytes.length;
	}

	finish(): Uint8Array {
		const output = new Uint8Array(this.length);
		let offset = 0;
		for (const chunk of this.chunks) {
			output.set(chunk, offset);
			offset += chunk.length;
		}
		return output;
	}
}

function encodeChecks(writer: ByteWriter, checks: Check[]): void {
	writer.appendU32(checks.length);
	for (const check of checks) {
		writer.appendField(check.description);
		writer.appendField(check.sql);
	}
}

function encodeSteps(writer: ByteWriter, steps: ExecuteStep[]): void {
	writer.appendU32(steps.length);
	for (const step of steps) {
		writer.appendField(step.description);
		writer.appendField(step.sql);
	}
}

/** Canonical `migratrom/ops/v1` byte encoding shared with migratrom.swift. */
export function canonicalEncode(operations: Operation[]): Uint8Array {
	const writer = new ByteWriter();
	writer.appendField(FORMAT_VERSION);
	writer.appendU32(operations.length);
	for (const operation of operations) {
		writer.appendField(operation.id);
		writer.appendField(operation.label);
		writer.appendU8(operation.outsideTransaction ? 1 : 0);
		encodeChecks(writer, operation.precheck);
		encodeSteps(writer, operation.execute);
		encodeChecks(writer, operation.postcheck);
	}
	return writer.finish();
}
