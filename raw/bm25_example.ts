import bm25 from "wink-bm25-text-search";

export type Work = Readonly<{
	id: number;
	title: string;
	body: string;
}>;

export type SearchResult = Readonly<{
	work: Work;
	score: number;
}>;

export const works: readonly Work[] = [
	{
		id: 1,
		title: "The Martian",
		body: "An astronaut uses science and engineering to survive alone on Mars after space travel and find a way home.",
	},
	{
		id: 2,
		title: "Dune",
		body: "On the desert planet Arrakis, a young heir faces political conflict, prophecy, and a struggle for power.",
	},
	{
		id: 3,
		title: "Twenty Thousand Leagues Under the Sea",
		body: "Captain Nemo explores the oceans aboard the Nautilus, encountering wonders and dangers beneath the waves.",
	},
	{
		id: 4,
		title: "The Time Machine",
		body: "A scientist travels through time and discovers the distant future and its divided human descendants.",
	},
];

function tokenize(text: string): string[] {
	return text.match(/[a-z0-9]+/gi)?.map((word) => word.toLowerCase()) ?? [];
}

function buildEngine() {
	const engine = bm25();
	engine.defineConfig({ fldWeights: { title: 2, body: 1 } });
	engine.definePrepTasks([tokenize]);

	for (const work of works) {
		engine.addDoc({ title: work.title, body: work.body }, work.id);
	}

	engine.consolidate();
	return engine;
}

const engine = buildEngine();

function rankedResults(query: string): SearchResult[] {
	const normalizedQuery = query.trim();
	if (!normalizedQuery) {
		throw new Error("Search query must not be empty.");
	}

	return engine.search(normalizedQuery).map(([documentId, score]) => {
		const work = works.find(
			(candidate) => String(candidate.id) === String(documentId),
		);
		if (!work)
			throw new Error(`Search returned unknown document ID: ${documentId}.`);
		return { work, score };
	});
}

export function score(queryTerms: string[]): number {
	if (queryTerms.length === 0 || queryTerms.every((term) => !term.trim())) {
		throw new Error("Score query must contain at least one word.");
	}

	return rankedResults(queryTerms.join(" "))[0]?.score ?? 0;
}

export function search(query: string): boolean {
	return rankedResults(query).length > 0;
}

function main(): void {
	const query = process.argv.slice(2).join(" ");

	try {
		if (!search(query)) {
			console.log("No works matched your query.");
			return;
		}

		const results = rankedResults(query);
		for (const { work, score } of results) {
			console.log(`Title: ${work.title}`);
			console.log(`Document ID: ${work.id}`);
			console.log(`Search score: ${score}`);
			console.log();
		}
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : String(error);
		console.error(`Error: ${message}`);
		process.exitCode = 1;
	}
}

if (import.meta.main) {
	main();
}
