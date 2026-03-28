import { Router, type IRouter } from "express";
import healthRouter from "./health";
import qrRouter from "./qr";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use(qrRouter);
router.use(adminRouter);

export default router;
