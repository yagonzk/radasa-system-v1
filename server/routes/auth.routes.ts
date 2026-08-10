import { Router } from "express";
import { authController } from "../controllers/auth.controller.js";
import { authenticate } from "../middlewares/auth.js";
import { validate } from "../middlewares/validate.js";
import { changePasswordSchema, loginSchema, registerSchema, updateProfileSchema } from "../validators/schemas.js";
import { asyncHandler } from "../utils/async-handler.js";
import { createRateLimiter } from "../middlewares/rate-limit.js";

export const authRoutes = Router();

const authRateLimit = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { message: "Muitas tentativas. Aguarde alguns minutos e tente novamente." },
});

authRoutes.post("/login", authRateLimit, validate(loginSchema), asyncHandler(authController.login));
authRoutes.post("/register", authRateLimit, validate(registerSchema), asyncHandler(authController.register));
authRoutes.get("/me", authenticate, asyncHandler(authController.me));
authRoutes.put("/profile", authenticate, validate(updateProfileSchema), asyncHandler(authController.updateProfile));
authRoutes.put("/change-password", authenticate, validate(changePasswordSchema), asyncHandler(authController.changePassword));
