import { Router, type IRouter, type Request, type Response } from "express";
import { readFileSync } from "fs";
import { resolve } from "path";
import { load } from "js-yaml";
import { requireSuperAdmin } from "../middlewares/auth";

const router: IRouter = Router();

const specPath = resolve(process.cwd(), "../../lib/api-spec/openapi.yaml");

router.get("/docs/spec", requireSuperAdmin(), (req: Request, res: Response) => {
  try {
    const yaml = readFileSync(specPath, "utf-8");
    const spec = load(yaml) as Record<string, unknown>;

    const proto = req.headers["x-forwarded-proto"] ?? req.protocol ?? "https";
    const host = req.headers["x-forwarded-host"] ?? req.headers.host ?? "localhost";
    const baseUrl = `${proto}://${host}/api`;

    spec.servers = [{ url: baseUrl, description: "API Server" }];

    res.json(spec);
  } catch (err) {
    console.error("Failed to read OpenAPI spec:", err);
    res.status(500).json({ error: "Gagal memuat dokumentasi API" });
  }
});

export default router;
