## EdgarParse (this was written manually, please read it)

## Implementation notes (running instructions are next)

### Workflow changes
Because of limited tokens amount, i wanted to maximize the impact per token, and minimize waist, so because of that i did not use more then 2 sessions at time, no loops (i like them, but not for limited token budget). This also allowed me to use a 5.4-mini often. <br>
I also usually use `/review` a lot, but that burns tokens a lot. I used it, but less then normal.

### Challenges
I had problems with xpath library and getting to work without a headless browser. That and making a chunking strategy was the main problem.

### Research docs
All the research i did and code examples for libraries i made are in `./raw`. <br>
I was giving this files to the agent to help with implementation, i use this a lot usually.

### Main Implementation Idea
Pipeline is basically:
- clean html
- chunk it (tables are separators, they are extracted separately and chunks are the text between tables). Chunks and tables are stored in SqlLightDB (not needed byt useful)
- 2 workers extracting data, one for chunks, one for tables. When extracted, we add cost for extraction and we ground it using BM25 and text similarity. This is done per extraction and we also provide the chunks/table used to make this assumption.
- next we compose the total cost from the cost we had per extraction.
- save final output to json file

### Agent extractor
Simple agent that uses Structured Output. It has 2 tools we configure when we make it, one provides the main text we are doing extraction on, and the next is for adjacent data. They are configured when agent is made, so agent uses them when needed and if needed (2nd one), so we are not polluting the context, and it is cheaper.

### Improvement ideas
- evals, this works, but without golden tests, i do not know how good it is
- make pipeline startable from any step, and save all the extracted info to DB
- depending on LLM limits we can increase the parallel processing, how is just 2 agents (mostly because i wanted to avoid 429)
- during Quote data Extraction, we can pre-made calibrated word dictionaries we can use with BM25 to see if chunk is worth giving to LLM. This would need calibration.
- Observability
- Support for processing of multiple files at the same time
- I might add something, still have tokens left

### Example run
Data is in the `./edgar_test_files` folder

## Technical Setup and Commands
Project uses `bun` and TS.

### Prerequisites
Needed because of (if u on mac and have xcode-cli, you are good) [similarity-node lib](https://github.com/piotrmaciejbednarski/text-similarity-node) <br>
Jump to the [setup details](#prerequisites-setup).

### Tests
- bun run test:e2e -> this is live E2E test, needs KEY in ENV
- bun run test:unit

### SetUp for full run
- copy `.env.example` to `.env` and add they key
- app init: `bun install && bun run db:bootstrap`
- db reset if needed: `db:reset-local`

### Full Run
TSM: `bun run TSM` (167 tables and a lot of chunks) takes time. <br>
`MINI_EXTRACTION=1 bun run TSM`: this is gonna cap extraction at 20 tables and 30 chunks, still gets a lot of data.

### Prerequisites Setup
Before installing, ensure you have the necessary build tools installed on your system:

### Windows
Visual Studio 2017 or newer (with "Desktop development with C++" workload installed).
Python 3.x (required by node-gyp).
### macOS
Xcode Command Line Tools (xcode-select --install).
### Linux
GCC/G++ and Python 3.x.