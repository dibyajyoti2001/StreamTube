import express from "express";
import cors from "cors";
import { logger } from "./utils/logger.js";
import morgan from "morgan";

const app = express();

// Format of the logger
const morganFormat = ":method :url :status :response-time ms";

// Common Middlewares
app.use(
  cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
  })
);
app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(express.static("public"));
app.use(cookieParser());

// Logger Middleware
app.use(
  morgan(morganFormat, {
    stream: {
      write: (message) => {
        const logObject = {
          method: message.split(" ")[0],
          url: message.split(" ")[1],
          status: message.split(" ")[2],
          responseTime: message.split(" ")[3],
        };
        logger.info(JSON.stringify(logObject));
      },
    },
  })
);

// routes import
import healthCheckRouter from "./routes/healthCheck.route.js";
import cookieParser from "cookie-parser";

// routes declaration
app.use("/api/v1/healthCheck", healthCheckRouter);

// how it will see: http://localhost:8000/api/v1/users/register

export { app };
