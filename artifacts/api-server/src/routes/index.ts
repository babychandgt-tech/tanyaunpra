import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import protectedRouter from "./protected";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(protectedRouter);

export default router;
