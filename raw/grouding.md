
# Grounding
- path to the chunk used to make the assumption and chunk is gonna have xpath in it



# Scoring

Score is gonna be a combination of the JaroWinklerDistance and bm25

## String similarity
Text similarity
https://github.com/piotrmaciejbednarski/text-similarity-node

import textSimilarity from "text-similarity-node";

const similarity = textSimilarity.similarity.jaccard(
	"hello world",
	"hello universe",
	true,
);

console.log(similarity); // 0.3333333333333333



## Search scoring
BM25
https://github.com/winkjs/wink-bm25-text-search
