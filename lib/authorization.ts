import type { UserDoc, UserRole } from "./models/user";

export interface AuthorizationService {
  requireRole(user: UserDoc, role: UserRole): void;
}
