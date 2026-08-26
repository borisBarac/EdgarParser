declare module "wink-bm25-text-search" {
	type Document = Record<string, string>;
	type SearchResult = [documentId: string, score: number];

	interface Engine {
		defineConfig(config: { fldWeights: Record<string, number> }): boolean;
		definePrepTasks(tasks: Array<(text: string) => string[]>): number;
		addDoc(document: Document, uniqueId: string | number): boolean;
		consolidate(precision?: number): boolean;
		search(text: string, limit?: number): SearchResult[];
	}

	const createEngine: () => Engine;
	export default createEngine;
}
