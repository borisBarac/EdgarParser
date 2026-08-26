## Folder format

This is genral idea, every filling gets this folder, and that folder has all the data in it.
We also have a SQLLight db that points to the folders

filing/
├── original.html
├── original_cleaned.html
├── chunks/
│   ├── chunk_001.md
│   ├── chunk_002.md
│   └── ...
│
└── tables/
    ├── table_001.html
    ├── table_002.html
    └── ...
