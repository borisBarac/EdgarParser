## File structure:

data:
  filing
    org file
    clean file
    chunks (optional)
    tables (optional)


## DB MODEL:

FILE
----
ID
ORG_FILE_PATH
CLEAN_FILE_PATH
ORG_FILE_PATH UNIQUE

CHUNK
-----
ID
FILE_ID
XPATH_START
XPATH_END
ORDER_IN_FILE
TEXT
UNIQUE(FILE_ID, ORDER_IN_FILE)

TABLE
-----
ID
FILE_ID
XPATH
ORDER_IN_FILE
TEXT
PREV_CHUNK_ID
PREV_CHUNK_FILE_ID
NEXT_CHUNK_ID
NEXT_CHUNK_FILE_ID
UNIQUE(FILE_ID, ORDER_IN_FILE)

## Relationships

FILE
 1:N -> CHUNK
 1:N -> TABLE

TABLE
  PREV_CHUNK_ID, PREV_CHUNK_FILE_ID -> CHUNK(ID, FILE_ID)
  NEXT_CHUNK_ID, NEXT_CHUNK_FILE_ID -> CHUNK(ID, FILE_ID)
  PREV/NEXT FILE_ID MUST MATCH TABLE FILE_ID

## Note

Preferred shape was shared-column composite FKs:
- `(PREV_CHUNK_ID, FILE_ID) -> CHUNK(ID, FILE_ID)`
- `(NEXT_CHUNK_ID, FILE_ID) -> CHUNK(ID, FILE_ID)`

Prisma 7.10 allows reusing `FILE_ID` across relations, but not with `onDelete: SetNull` when `FILE_ID` stays required. The explicit `PREV_CHUNK_FILE_ID` / `NEXT_CHUNK_FILE_ID` columns are intentional so nullable prev/next links still work at the DB level.


## SQL Lite for the table
i think i will also use prisma
