
## Agents

As for agents, we need to make 3 agents, one for qutes extraction, one for table extraction
3rd one is for company and filling info extraction, this one needs also to be added to the model
- add cost check is uses only last message

## Data Extraction

Process each chunk:
Send the chunk quote agent.
Ground the agent results

Follow the same approach for tables

## Put together
connect all wiht the pipeline, and have pipeline save a json object in the pipeline work folder

## Code review and notes