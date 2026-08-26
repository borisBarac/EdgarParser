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

CHUNK
-----
ID
FILE_ID
XPATH_START
XPATH_END
ORDER_IN_FILE
TEXT

TABLE
-----
ID
FILE_ID
XPATH
ORDER_IN_FILE
TEXT
PREV_CHUNK_ID
NEXT_CHUNK_ID

## Relationships

FILE
 1:N -> CHUNK
 1:N -> TABLE

TABLE
 PREV_CHUNK_ID -> CHUNK.ID
 NEXT_CHUNK_ID -> CHUNK.ID


## SQL Lite for the table
i think i will also use prisma