# Review Findings

- High: duplicated grounding/scoring flow in `src/pipeline/grounding/quote_grounding.ts` and `src/pipeline/grounding/table_grounding.ts`.
- Medium: near-identical agent wrappers in `src/pipeline/llm_extraction/quotes.ts` and `src/pipeline/llm_extraction/tables.ts`.
- Medium: normalization/tokenization duplicated across `src/utility/search.ts`, `src/utility/similarity.ts`, `src/utility/html_text.ts`, and `src/pipeline/steps/chunk.ts`.
- Medium: `src/pipeline/steps/llm_extract/llm_extract.ts` linearly scans chunks to find the previous chunk for each chunk.
- Low: `src/db/repo.write.ts` builds a full chunk map just to recover ids/fileIds for table rows.
- Low: `src/agent/agent.ts` has a redundant env check that always reports `PIPELINE_KEY`.
- Low: `src/agent/schema_prompt.ts` appears unused.
- Low: `src/pipeline/steps/clean.ts` is a pure passthrough wrapper.

- Skipped risky refactor: renaming `adjesonData` / `GetAdjesonData` because it is part of the tool contract and would ripple through prompts and tests.
