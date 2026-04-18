import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { requireAuth } from "./lib/auth.js";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Global auth guard — protect all /api routes except public ones
app.use("/api", (req: Request, res: Response, next: NextFunction) => {
  const isPublic =
    (req.method === "POST" && req.path === "/auth/login") ||
    (req.method === "GET"  && (req.path === "/healthz" || req.path === "/health")) ||
    (req.method === "POST" && req.path === "/admin/requests") || // scan form
    (req.method === "GET"  && req.path.startsWith("/erp/options/")); // dropdown options used by public forms
  if (isPublic) return next();
  requireAuth(req, res, next);
});

app.use("/api", router);

export default app;
