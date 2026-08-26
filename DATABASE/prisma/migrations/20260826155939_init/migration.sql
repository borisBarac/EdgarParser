-- CreateTable
CREATE TABLE "files" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "org_file_path" TEXT NOT NULL,
    "clean_file_path" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "chunks" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "file_id" INTEGER NOT NULL,
    "xpath_start" TEXT NOT NULL,
    "xpath_end" TEXT NOT NULL,
    "order_in_file" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    CONSTRAINT "chunks_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "filing_tables" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "file_id" INTEGER NOT NULL,
    "xpath" TEXT NOT NULL,
    "order_in_file" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "prev_chunk_id" INTEGER,
    "prev_chunk_file_id" INTEGER,
    "next_chunk_id" INTEGER,
    "next_chunk_file_id" INTEGER,
    CONSTRAINT "filing_tables_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "filing_tables_prev_chunk_id_prev_chunk_file_id_fkey" FOREIGN KEY ("prev_chunk_id", "prev_chunk_file_id") REFERENCES "chunks" ("id", "file_id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "filing_tables_next_chunk_id_next_chunk_file_id_fkey" FOREIGN KEY ("next_chunk_id", "next_chunk_file_id") REFERENCES "chunks" ("id", "file_id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "files_org_file_path_key" ON "files"("org_file_path");

-- CreateIndex
CREATE UNIQUE INDEX "chunks_file_id_order_in_file_key" ON "chunks"("file_id", "order_in_file");

-- CreateIndex
CREATE UNIQUE INDEX "chunks_id_file_id_key" ON "chunks"("id", "file_id");

-- CreateIndex
CREATE INDEX "filing_tables_prev_chunk_id_prev_chunk_file_id_idx" ON "filing_tables"("prev_chunk_id", "prev_chunk_file_id");

-- CreateIndex
CREATE INDEX "filing_tables_next_chunk_id_next_chunk_file_id_idx" ON "filing_tables"("next_chunk_id", "next_chunk_file_id");

-- CreateIndex
CREATE UNIQUE INDEX "filing_tables_file_id_order_in_file_key" ON "filing_tables"("file_id", "order_in_file");
