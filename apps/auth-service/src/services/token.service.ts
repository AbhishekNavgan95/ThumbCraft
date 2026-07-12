import jwt from "jsonwebtoken";
import type { AuthServiceConfig } from "../config.js";
import type { PublicUser } from "../types.js";

export function createToken(config: AuthServiceConfig, user: PublicUser): string {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name, role: user.role },
    config.JWT_SECRET,
    { expiresIn: config.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"] },
  );
}
