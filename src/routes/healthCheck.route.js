import { Router } from "express";
import {
  healthCheck,
  heartCheck,
} from "../controllers/healthCheck.controller.js";

const router = Router();

router.route("/").get(healthCheck);
router.route("/heart").get(heartCheck);

export default router;
