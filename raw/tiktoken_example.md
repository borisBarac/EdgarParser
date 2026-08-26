## TikeToken lib example to count tokens

```ts
import { encoding_for_model } from "tiktoken";

const enc = encoding_for_model("gpt-4o");

const text = "Some potentially very long string...";
const tokenCount = enc.encode(text).length;

console.log(tokenCount);

enc.free();
```