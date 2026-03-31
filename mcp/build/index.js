import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { Pool } from "pg";
import "dotenv/config";
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5433/reservation",
});
const server = new Server({ name: "reservation-mcp", version: "1.0.0" }, { capabilities: { tools: {} } });
server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
        {
            name: "query_database",
            description: "Run a read-only SQL query against the Reservation DB",
            inputSchema: {
                type: "object",
                properties: {
                    sql: { type: "string", description: "The SQL query to execute (must be SELECT)" },
                },
                required: ["sql"],
            },
        },
        {
            name: "inspect_schema",
            description: "List all tables in the public schema",
            inputSchema: {
                type: "object",
                properties: {},
            },
        },
    ],
}));
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    if (name === "query_database") {
        const sql = args.sql;
        if (typeof sql !== "string") {
            throw new Error("Invalid arguments: sql must be a string");
        }
        const queryType = sql.trim().split(" ")[0].toUpperCase();
        if (queryType !== "SELECT" && queryType !== "WITH") {
            return {
                content: [{ type: "text", text: "Error: Only read-only queries (SELECT/WITH) are allowed." }],
                isError: true,
            };
        }
        try {
            const client = await pool.connect();
            try {
                const result = await client.query(sql);
                return {
                    content: [{ type: "text", text: JSON.stringify(result.rows, null, 2) }],
                };
            }
            finally {
                client.release();
            }
        }
        catch (err) {
            return {
                content: [{ type: "text", text: `Database Error: ${err.message}` }],
                isError: true,
            };
        }
    }
    if (name === "inspect_schema") {
        try {
            const client = await pool.connect();
            try {
                const result = await client.query(`
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_schema = 'public'
          ORDER BY table_name;
        `);
                return {
                    content: [{ type: "text", text: JSON.stringify(result.rows, null, 2) }],
                };
            }
            finally {
                client.release();
            }
        }
        catch (err) {
            return {
                content: [{ type: "text", text: `Error: ${err.message}` }],
                isError: true,
            };
        }
    }
    throw new Error(`Unknown tool: ${name}`);
});
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Reservation MCP Server running on stdio");
}
main().catch((error) => {
    console.error("Fatal error in main():", error);
    process.exit(1);
});
