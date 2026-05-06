# Reservation MCP Server

This MCP server provides tools to interact with the Reservation Application database.

## Prerequisites
- Node.js 18+
- Docker containers running (Postgres on port 5433)

## Installation
```bash
cd mcp
npm install
```

## Usage
Run the server using stdio transport:
```bash
npm start
```

## Tools
- `query_database`: Execute SELECT queries.
- `inspect_schema`: List database tables.
