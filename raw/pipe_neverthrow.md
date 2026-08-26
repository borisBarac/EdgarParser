

## Pipe style example using neverthrow lib

```ts
import { errAsync, okAsync, type ResultAsync } from "neverthrow";

export type DivisionError = Readonly<{
	type: "division_error";
	message: string;
}>;

export type FormatError = Readonly<{
	type: "format_error";
	message: string;
}>;

export type PipelineError = DivisionError | FormatError;

export function divide(
	dividend: number,
	divisor: number,
): ResultAsync<number, DivisionError> {
	if (divisor === 0) {
		return errAsync({
			type: "division_error",
			message: "Cannot divide by zero.",
		});
	}

	return okAsync(dividend / divisor);
}

export function formatResult(value: number): ResultAsync<string, FormatError> {
	if (!Number.isFinite(value)) {
		return errAsync({
			type: "format_error",
			message: "Cannot format a non-finite result.",
		});
	}

	return okAsync(`Result: ${value.toFixed(2)}`);
}

export function runMathPipeline(
	dividend: number,
	divisor: number,
): ResultAsync<string, PipelineError> {
	return divide(dividend, divisor).andThen(formatResult);
}

async function printExample(dividend: number, divisor: number): Promise<void> {
	await runMathPipeline(dividend, divisor).match(
		(value) => console.log(`Success: ${value}`),
		(error) => console.log(`Error [${error.type}]: ${error.message}`),
	);
}

if (import.meta.main) {
	await printExample(10, 2);
	await printExample(10, 0);
}

```