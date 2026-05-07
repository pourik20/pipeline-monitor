import { connectToDatabase } from "./mongodb";
import { UserModel, type UserDoc } from "./models/user";

const SEED_ADMIN_EMAIL = "admin@demo";

export interface AuthContext {
  currentUser(): Promise<UserDoc>;
}

class StubAuthContext implements AuthContext {
  async currentUser(): Promise<UserDoc> {
    await connectToDatabase();
    const existing = await UserModel.findOne({ email: SEED_ADMIN_EMAIL });
    if (existing) return existing;
    return UserModel.create({ email: SEED_ADMIN_EMAIL, role: "admin" });
  }
}

export const authContext: AuthContext = new StubAuthContext();
