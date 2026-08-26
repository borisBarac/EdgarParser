## Original prompt:

help me structure this prompt:

We need to use extract the tables from the html file and after create the chunks.

So if the file is like:

text1
text2
table1
text3
text4
table2
text5

Extracted tables would be table1 and table2.
Extracted chunks are: chunk1 (text1 + text2), chunk2 (text3 + text4), chunk3 (text5)
Tables are the border basically.

I need to pass this logic to LLM for implementation.

## GPT optimized + my tweaks to the guide
I’d make the prompt explicit about **DOM order**, **table extraction happening first**, and **tables acting as chunk boundaries**.

Implement HTML processing that extracts tables separately and chunks the remaining text based on table boundaries.

## Goal

Given an HTML document:

1. Extract all `<table>` elements.
2. Preserve their position/order in the original document.
3. Remove or exclude the tables from text chunking.
4. Create text chunks where each table acts as a hard chunk boundary.

## Example

Given this document order:

```text
text1
text2
table1
text3
text4
table2
text5
```

The extracted tables should be:

```text
table1
table2
```

The extracted text chunks should be:

```text
chunk1 = text1 + text2
chunk2 = text3 + text4
chunk3 = text5
```

Conceptually:

```text
[chunk1]
table1
[chunk2]
table2
[chunk3]
```

## Chunking rules

* Process the document in DOM/document order.
* A `<table>` is always a hard boundary between chunks.
* Text before the first table belongs to the first chunk.
* Text between two tables belongs to one chunk.
* Text after the last table belongs to the final chunk.
* Tables themselves must NOT be included in chunk text.
* Consecutive tables should not create empty chunks.
* Ignore chunks that contain no meaningful text after trimming/normalization.
* Preserve the original ordering of both chunks and tables.

## Important

Do not chunk the document first and then try to discover tables inside the chunks.

The processing model should effectively be:

```text
HTML
  ↓
walk DOM in document order
  ↓
table encountered?
  ├── yes → finish current text chunk + extract table
  └── no  → accumulate content into current text chunk
  ↓
continue until end of document
```

Tables therefore act as separators between narrative text regions.

The implementation should preserve enough ordering information so the original sequence can later be reconstructed as:

```text
chunk → table → chunk → table → chunk
```
