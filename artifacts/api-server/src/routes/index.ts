import { Router, type IRouter } from "express";
import healthRouter from "./health";
import qrRouter from "./qr";

const router: IRouter = Router();

router.use(healthRouter);
router.use(qrRouter);

export default router;
