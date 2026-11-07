import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { handleApiRequest } from "./server/api.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(async (req, res, next) => {
  if (req.url.startsWith("/api")) {
    try {
      await handleApiRequest(req, res, next);
    } catch (err) {
      console.error("API error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  } else {
    next();
  }
});

const distPath = path.resolve(__dirname, "dist");
app.use(express.static(distPath));

app.get("*", (req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`NEXUS server running on http://0.0.0.0:${PORT}`);
});
