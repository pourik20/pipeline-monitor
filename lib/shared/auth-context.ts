import { connectToDatabase } from "@/lib/shared/mongodb";
import { UserModel, type UserDoc } from "@/lib/shared/user";

const SEED_ADMIN_EMAIL = "admin@demo";

export interface AuthContext {
  currentUser(): Promise<UserDoc>;
}

export const authContext: AuthContext = {
  async currentUser() {
    await connectToDatabase();
    const existing = await UserModel.findOne({ email: SEED_ADMIN_EMAIL });
    if (existing) return existing;
    return UserModel.create({ email: SEED_ADMIN_EMAIL, role: "admin" });
  },
};
