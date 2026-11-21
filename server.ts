import "dotenv/config";
import express from "express";
import type { NextFunction, Request, Response } from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import {
  GeminiRequestError,
  transcribeAudioToKhmerSrt,
} from "./server/gemini.ts";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // JSON body parser
  app.use(express.json({ limit: "50mb" }));

  // API routes
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", time: new Date().toISOString() });
  });

  app.post("/api/gemini/transcribe", async (req, res) => {
    try {
      const { base64Data, mimeType, model, duration } = req.body ?? {};
      const srt = await transcribeAudioToKhmerSrt({
        base64Data,
        mimeType,
        modelName: model,
        duration,
      });
      res.json({ srt });
    } catch (err) {
      if (err instanceof GeminiRequestError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }

      const upstreamStatus = (err as { status?: number })?.status;
      const rawMessage =
        err instanceof Error ? err.message : "Failed to process audio file.";
      console.error("Gemini API error:", rawMessage);

      const statusCode =
        typeof upstreamStatus === "number" &&
        upstreamStatus >= 400 &&
        upstreamStatus < 600
          ? upstreamStatus
          : 500;

      res.status(statusCode).json({ error: rawMessage });
    }
  });

  // Handle malformed JSON or oversized payloads cleanly on API routes
  app.use(
    (
      err: { status?: number; type?: string; message?: string },
      req: Request,
      res: Response,
      next: NextFunction
    ) => {
      if (req.path.startsWith("/api/")) {
        if (err.type === "entity.too.large") {
          res.status(413).json({
            error: "Audio file is too large to upload. Please try a smaller file.",
          });
          return;
        }
        if (err.type === "entity.parse.failed") {
          res.status(400).json({ error: "Invalid JSON request body." });
          return;
        }
        res
          .status(err.status && err.status >= 400 ? err.status : 500)
          .json({ error: err.message || "Internal server error." });
        return;
      }
      next(err);
    }
  );

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Error starting server:", err);
});
