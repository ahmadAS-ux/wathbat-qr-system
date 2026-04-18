import { Router, type IRouter } from "express";
import healthRouter from "./health";
import qrRouter from "./qr";
import adminRouter from "./admin";
import authRouter from "./auth";
import erpRouter from "./erp";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(qrRouter);
router.use(adminRouter);
router.use(erpRouter);

export default router;
