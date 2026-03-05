// RabbitMQ connection manager — singleton pattern
// Uses `amqplib` (promise API) for AMQP 0-9-1 connection and channel management.
//
// Key amqplib API shape (v0.10):
//   amqplib.connect()  → Promise<ChannelModel>
//   ChannelModel       → .createChannel() / .createConfirmChannel() / .close()
//   Channel            → .assertQueue() / .sendToQueue() / .close() / …
//   ConfirmChannel     → extends Channel + .waitForConfirms()

import amqplib, {
    type ChannelModel,
    type Channel,
    type ConfirmChannel,
} from "amqplib";
import config from "./index.js";
import logger from "./logger.js";

/**
 * Manages a single RabbitMQ `ChannelModel` (connection) and its active channel
 * for the entire application lifetime.
 *
 * Features:
 *   - Lazy connection — opened on the first call to {@link connect} or {@link getChannel}
 *   - Publisher-confirm support — opt-in via `config.rabbitmq.publisherConfirms`
 *   - Automatic error/close event logging without crashing the process
 *   - Graceful shutdown via {@link close}
 *
 * @example
 * ```ts
 * import rabbitmq from "./rabbitmq.js";
 *
 * await rabbitmq.connect();                          // connect at startup
 * await rabbitmq.testConnection();                   // assert the queue is ready
 *
 * const ch = await rabbitmq.getChannel();
 * ch.sendToQueue("api_hits", Buffer.from(JSON.stringify(payload)));
 *
 * await rabbitmq.close();                            // graceful shutdown
 * ```
 */
class RabbitMQConnection {
    /** The one shared singleton instance. */
    private static instance: RabbitMQConnection;

    /**
     * The active AMQP `ChannelModel` returned by `amqplib.connect()`.
     * `null` when disconnected.
     */
    private model: ChannelModel | null = null;

    /**
     * The active AMQP channel derived from {@link model}.
     * Typed as the union so both `Channel` and `ConfirmChannel` are accepted.
     * `null` when disconnected or not yet created.
     */
    private channel: Channel | ConfirmChannel | null = null;

    /** Private constructor — use {@link RabbitMQConnection.getInstance} instead. */
    private constructor() {}

    // ─────────────────────────────────────────────────────────────────────────
    // Singleton Access
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Returns the single shared `RabbitMQConnection` instance.
     * Creates it on the first call; reuses it on every subsequent call.
     *
     * @returns {RabbitMQConnection} The singleton instance.
     */
    static getInstance(): RabbitMQConnection {
        if (!RabbitMQConnection.instance) {
            RabbitMQConnection.instance = new RabbitMQConnection();
        }
        return RabbitMQConnection.instance;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Connection Management
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Opens the AMQP connection (`ChannelModel`) and creates the backing channel.
     *
     * - `amqplib.connect()` returns a `ChannelModel`; channel-creation methods
     *   (`createChannel` / `createConfirmChannel`) are called on that model.
     * - If `config.rabbitmq.publisherConfirms` is `true` a {@link ConfirmChannel}
     *   is created; otherwise a standard {@link Channel} is used.
     * - Attaches an `"error"` listener so unexpected broker errors are logged
     *   without crashing the process.
     * - Attaches a `"close"` listener that nulls internal references, so the
     *   next call to {@link getChannel} triggers a fresh reconnect attempt.
     *
     * Calling `connect()` when already connected is a no-op.
     *
     * @throws {Error} If the broker is unreachable or channel creation fails.
     * @returns {Promise<void>}
     */
    async connect(): Promise<void> {
        if (this.model) {
            logger.info("RabbitMQ already connected");
            return;
        }

        // amqplib.connect() → Promise<ChannelModel>
        this.model = await amqplib.connect(config.rabbitmq.url);

        this.model.on("error", (err: Error) => {
            logger.error("Unexpected RabbitMQ connection error", { error: err.message });
            // ⚠️  Do NOT process.exit() here — let Docker/PM2 restart if needed
        });

        this.model.on("close", () => {
            logger.warn("RabbitMQ connection closed unexpectedly");
            this.model   = null;
            this.channel = null;
        });

        // createConfirmChannel / createChannel both live on ChannelModel
        this.channel = config.rabbitmq.publisherConfirms
            ? await this.model.createConfirmChannel()
            : await this.model.createChannel();

        logger.info("RabbitMQ connected", {
            url:               config.rabbitmq.url,
            queue:             config.rabbitmq.queue,
            publisherConfirms: config.rabbitmq.publisherConfirms,
        });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Channel Access
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Returns the active AMQP channel, auto-connecting if necessary.
     *
     * If the channel is `null` (first call, or after a connection drop) this
     * method calls {@link connect} before returning, so callers never need to
     * check connectivity manually.
     *
     * @returns {Promise<Channel | ConfirmChannel>} The active channel.
     * @throws {Error} If connecting to the broker fails.
     */
    async getChannel(): Promise<Channel | ConfirmChannel> {
        if (!this.channel) {
            await this.connect();
        }

        // Non-null assertion is safe: connect() always sets this.channel or throws.
        return this.channel!;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Connection Test
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Verifies broker connectivity by asserting the configured queue.
     *
     * Call this at server startup to confirm RabbitMQ is reachable and the
     * queue exists (or will be created) with `durable: true`.
     *
     * @throws {Error} If the broker is unreachable or the queue assertion fails.
     * @returns {Promise<void>}
     */
    async testConnection(): Promise<void> {
        try {
            const channel = await this.getChannel();

            await channel.assertQueue(config.rabbitmq.queue, {
                durable: true, // queue survives broker restarts
            });

            logger.info("RabbitMQ connection verified", {
                queue: config.rabbitmq.queue,
            });
        } catch (error) {
            logger.error("Failed to verify RabbitMQ connection", { error });
            throw error;
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Graceful Shutdown
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Closes the AMQP channel and then the underlying `ChannelModel` connection.
     *
     * Call this during graceful server shutdown (SIGTERM / SIGINT) to allow
     * in-flight messages to be acknowledged before the process exits.
     *
     * @returns {Promise<void>}
     */
    async close(): Promise<void> {
        try {
            if (this.channel) {
                await this.channel.close();
                this.channel = null;
            }

            if (this.model) {
                await this.model.close();
                this.model = null;
                logger.info("RabbitMQ connection closed gracefully");
            }
        } catch (error) {
            logger.error("Error while closing RabbitMQ connection", { error });
            throw error;
        }
    }
}

export default RabbitMQConnection.getInstance();