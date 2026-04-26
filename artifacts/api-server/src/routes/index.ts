import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import protectedRouter from "./protected";
import chatRouter from "./chat";
import intentsRouter from "./intents";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(protectedRouter);
router.use(chatRouter);
router.use(intentsRouter);

export default router;
