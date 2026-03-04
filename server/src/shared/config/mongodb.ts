// here we will define all the mongodb config

import mongoose from "mongoose";
import config from "./index";
import logger from "./logger";

/**
 *  this class is used to connect to the mongodb database.
 *  it is a singleton class, so it can only be instantiated once.
 */
class MongoConnection {
    private static instance: MongoConnection;
    private connection: mongoose.Connection | null

    private constructor() {
        this.connection = null
    }

    /**
     * Returns the single shared instance of MongoConnection.
     * Creates it on first call, reuses it on every subsequent call.
     */
    static getInstance(): MongoConnection {
        if (!MongoConnection.instance) {
            MongoConnection.instance = new MongoConnection();
        }
        return MongoConnection.instance;
    }

    /**
     *  this method is used to connect to the mongodb database.
     * @returns {Promise<mongoose.Connection | null>}
     */
    async connect(): Promise<mongoose.Connection | null> {
        try {
            if (this.connection) {
                logger.info("MongoDB already connected");
                return this.connection;
            }

            await mongoose.connect(config.mongo.uri, {
                dbName: config.mongo.dbName,
            });

            this.connection = mongoose.connection;

            logger.info(`MongoDB connected to ${this.connection.host}:${this.connection.port}`);

            this.connection.on("error", (error) => {
                logger.error("MongoDB connection error", error);
            });

            this.connection.on("disconnected", () => {
                logger.info("MongoDB disconnected");
            });

            return this.connection;
        } catch (error) {
            logger.error("MongoDB connection error", error);
            throw error;
        }
    }

    /**
     *  this method is used to disconnect from the mongodb database.
     * @returns {Promise<void>}
     */
    async disconnect(): Promise<void> {
        try {
            if (this.connection) {
                await mongoose.disconnect();
                this.connection = null;
                logger.info("MongoDB disconnected");
            }
        } catch (error) {
            logger.error('Failed to disconnect to MongoDB:', error);
            throw error;
        }
    }

    /**
     * Get the active connection
     * @returns {mongoose.Connection}
     */
    getConnection() {
        return this.connection;
    }
}

export default MongoConnection.getInstance();
