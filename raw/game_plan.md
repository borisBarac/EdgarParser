
## Pipeline

✅ cleanUp (img, style, scripts)
✅ save new files to disk
✅ db prep
✅ make chunks based on tables, end of table is end of one chunk, make sure the chunk has a number (index in original file) as well as start and end XPATH
✅ extract tables, have references to chunk before and chunk after
- llm extraction from chunks (with token used and cost)
✅ scoring and grounding

## Grounding
Based on chunk ids and XPaths

## Scoring
✅ bm25 search
✅ jaccard implementation
✅ scoring: bm25 search to validate, and jaccard similarity score. <br>


I wanted to do Vector Similarity, but no access to embeddings model, so i went with the similarity score