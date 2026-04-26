import { Router, type IRouter, type Request, type Response } from "express";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/ping/admin", requireAuth(["admin"]), (_req: Request, res: Response) => {
  res.json({ message: "Halo admin!", role: "admin" });
});

router.get("/ping/dosen", requireAuth(["dosen", "admin"]), (req: Request, res: Response) => {
  res.json({ message: `Halo ${req.user!.role}!`, role: req.user!.role });
});

router.get("/ping/mahasiswa", requireAuth(["mahasiswa", "dosen", "admin"]), (req: Request, res: Response) => {
  res.json({ message: `Halo ${req.user!.role}!`, role: req.user!.role });
});

export default router;
