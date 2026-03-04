// here we will define all the logger level config

import winston from "winston";
import config from "./index";

/**
 *  winston is a logging library that is used to log messages to the console or to a file.
 *  it is used to log messages to the console or to a file.
 */
const logger = winston.createLogger({
    level: config.node_env === "production" ? "info" : "debug",
    format: winston.format.combine(
        winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
        winston.format.errors({ stack: true }),
        winston.format.splat(),
        winston.format.json()
    ),
    defaultMeta: { service: "api-monitoring-system" },
    transports: [
        new winston.transports.File({ filename: "logs/error.log", level: "error" }),
        new winston.transports.File({ filename: "logs/combined.log" }),
    ],
});

if (config.node_env !== "production") {
    logger.add(
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            )
        })
    );
}

export default logger;