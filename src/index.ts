import app from "./app";
import { env } from "./config/env";
import { startScheduler } from "./services/scheduler";
import { scheduleCleanupJob, startCleanupWorker } from "./jobs/cleanupPendingDeposits";
import { initDb } from "./config/initDb";
import { logger } from "./config/logger";
import { prisma } from "./config/prisma";
import { redis } from "./config/redis";

const port = Number(process.env.PORT ?? 3000);

// --- Global process error handlers ---
process.on("uncaughtException", (err) => {
  logger.fatal({ err }, "Uncaught exception — shutting down");
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  logger.fatal({ err: reason }, "Unhandled rejection — shutting down");
  process.exit(1);
});

// Initialize database (ensure tables exist) then start server
initDb()
  .then(() => {
    const server = app.listen(port, () => {
      if (env.nodeEnv !== "test") {
        startScheduler();
        startCleanupWorker();
        scheduleCleanupJob().catch(err => logger.error({ err }, "Failed to schedule cleanup job"));
        logger.info(`Reservation API listening on port ${port}`);
      }
    });

    // --- Graceful shutdown ---
    const shutdown = async (signal: string) => {
      logger.info(`${signal} received — starting graceful shutdown`);
      server.close(async () => {
        try {
          await prisma.$disconnect();
          redis.disconnect();
          logger.info("Graceful shutdown complete");
          process.exit(0);
        } catch (err) {
          logger.error({ err }, "Error during shutdown cleanup");
          process.exit(1);
        }
      });
      // Force exit after 30s if graceful shutdown stalls
      setTimeout(() => {
        logger.error("Shutdown timed out — forcing exit");
        process.exit(1);
      }, 30_000).unref();
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
  })
  .catch((err) => {
    logger.error("Failed to initialize database:", err);
    process.exit(1);
  });
