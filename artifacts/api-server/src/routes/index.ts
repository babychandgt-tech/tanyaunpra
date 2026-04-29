import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import protectedRouter from "./protected";
import chatRouter from "./chat";
import intentsRouter from "./intents";
import coursesRouter from "./courses";
import schedulesRouter from "./schedules";
import lecturersRouter from "./lecturers";
import studentsRouter from "./students";
import announcementsRouter from "./announcements";
import academicCalendarRouter from "./academic-calendar";
import dashboardRouter from "./dashboard";
import usersRouter from "./users";
import apiDocsRouter from "./api-docs";
import fakultasProdiRouter from "./fakultas-prodi";
import forumsRouter from "./forums";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(protectedRouter);
router.use(chatRouter);
router.use(intentsRouter);
router.use(coursesRouter);
router.use(schedulesRouter);
router.use(lecturersRouter);
router.use(studentsRouter);
router.use(announcementsRouter);
router.use(academicCalendarRouter);
router.use(dashboardRouter);
router.use(usersRouter);
router.use(apiDocsRouter);
router.use(fakultasProdiRouter);
router.use(forumsRouter);

export default router;
