// PostgreSQL connection pool — singleton pattern
// Uses `pg.Pool` for connection pooling and query execution.

import pg, { Pool, PoolClient, QueryResult, QueryResultRow } from "pg";
import config from "./index.js";
import logger from "./logger.js";

/**
 * Manages a single PostgreSQL connection pool for the entire application.
 *
 * Usage:
 *   import postgresConnection from "./postgres.js";
 *   await postgresConnection.testConnection();
 *   const result = await postgresConnection.query("SELECT * FROM users WHERE id = $1", [id]);
 */
class PostgresConnection {
    private static instance: PostgresConnection;   // holds the one shared instance
    private pool: Pool | null = null;

    /** Private constructor — use PostgresConnection.getInstance() instead. */
    private constructor() {}

    /**
     * Returns the single shared PostgresConnection instance.
     * Creates it on the first call; reuses it on every subsequent call.
     */
    static getInstance(): PostgresConnection {
        if (!PostgresConnection.instance) {
            PostgresConnection.instance = new PostgresConnection();
        }
        return PostgresConnection.instance;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Pool Management
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Returns the active Pool, creating it on first access (lazy initialisation).
     * Attaches an error listener to log unexpected idle-client errors without
     * crashing the process — Docker's restart policy handles recovery.
     *
     * @returns {Pool} The active pg.Pool instance.
     */
    getPool(): Pool {
        if (!this.pool) {
            this.pool = new Pool({
                host:                   config.postgres.host,
                port:                   config.postgres.port,
                database:               config.postgres.database,
                user:                   config.postgres.user,
                password:               config.postgres.password,
                max:                    20,                // max concurrent connections
                idleTimeoutMillis:      30_000,            // close idle connections after 30 s
                connectionTimeoutMillis: 2_000,            // fail fast if no connection within 2 s
            });

            this.pool.on("error", (err: Error) => {
                logger.error("Unexpected error on idle PG client", { error: err.message });
                // ⚠️  Do NOT process.exit() here — let Docker/PM2 restart if needed
            });

            logger.info("PostgreSQL pool created", {
                host:     config.postgres.host,
                port:     config.postgres.port,
                database: config.postgres.database,
            });
        }

        return this.pool;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Connection Test
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Acquires a client from the pool, runs a lightweight `SELECT NOW()` query,
     * and releases the client immediately.
     * Call this at server startup to verify the database is reachable.
     *
     * @throws {Error} If the database is unreachable.
     */
    async testConnection(): Promise<void> {
        const client: PoolClient = await this.getPool().connect();
        try {
            const result: QueryResult = await client.query("SELECT NOW() AS now");
            logger.info(`PostgreSQL connected successfully`, {
                serverTime: result.rows[0].now,
            });
        } catch (error) {
            logger.error("Failed to connect to PostgreSQL", { error });
            throw error;
        } finally {
            client.release();   // always release, even on error
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Query Helper
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Executes a parameterised SQL query against the pool.
     * Logs the query text, execution duration, and row count at DEBUG level.
     *
     * @param text   - Parameterised SQL string, e.g. `"SELECT * FROM users WHERE id = $1"`
     * @param params - Ordered array of parameter values, e.g. `[userId]`
     * @returns      The full pg.QueryResult object (rows, rowCount, fields, …)
     * @throws {Error} Rethrows any database error after logging it.
     *
     * @example
     * const { rows } = await postgres.query(
     *   "SELECT * FROM endpoint_metrics WHERE client_id = $1",
     *   [clientId]
     * );
     */
    async query<T extends QueryResultRow = QueryResultRow>(
        text: string,
        params?: unknown[]
    ): Promise<QueryResult<T>> {
        const start = Date.now();
        try {
            const result = await this.getPool().query<T>(text, params);
            logger.debug("Executed query", {
                text,
                durationMs: Date.now() - start,
                rowCount:   result.rowCount,
            });
            return result;
        } catch (error) {
            logger.error("Query error", {
                text,
                error: error instanceof Error ? error.message : error,
            });
            throw error;
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Graceful Shutdown
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Drains all pool connections and closes the pool.
     * Call this during graceful server shutdown (SIGTERM / SIGINT).
     */
    async close(): Promise<void> {
        if (this.pool) {
            await this.pool.end();
            this.pool = null;
            logger.info("PostgreSQL pool closed gracefully");
        }
    }
}

export default PostgresConnection.getInstance();