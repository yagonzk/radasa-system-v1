import { Router } from "express";
import { authController } from "../controllers/auth.controller";
import { authenticate } from "../middlewares/auth";
import { validate } from "../middlewares/validate";
import { changePasswordSchema, loginSchema, registerSchema, updateProfileSchema } from "../validators/schemas";
import { asyncHandler } from "../utils/async-handler";
import { createRateLimiter } from "../middlewares/rate-limit";

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
