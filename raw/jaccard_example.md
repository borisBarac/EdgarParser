## Jaccard similarity example

```ts
import textSimilarity from "text-similarity-node";

const similarity = textSimilarity.similarity.jaccard(
	"hello world",
	"hello universe",
	true,
);

console.log(similarity); // 0.3333333333333333
```ts