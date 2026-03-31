import app from "./app";
import { env } from "./config/env";
import { startScheduler } from "./services/scheduler";
import { initDb } from "./config/initDb";
import { logger } from "./config/logger";

const port = Number(process.env.PORT ?? 3000);

// Initialize database (ensure tables exist) then start server
initDb()
  .then(() => {
    app.listen(port, () => {
      if (env.nodeEnv !== "test") {
        startScheduler();
        logger.info(`Reservation API listening on port ${port}`);
      }
    });
  })
  .catch((err) => {
    logger.error("Failed to initialize database:", err);
    process.exit(1);
  });
