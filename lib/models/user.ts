import mongoose, { Schema, type InferSchemaType, type HydratedDocument } from 'mongoose'

export type UserRole = 'admin' | 'operator' | 'viewer'

const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true },
    role: {
      type: String,
      enum: ['admin', 'operator', 'viewer'] satisfies UserRole[],
      required: true,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
)

export type User = InferSchemaType<typeof userSchema>
export type UserDoc = HydratedDocument<User>

export const UserModel =
  (mongoose.models.User as mongoose.Model<User>) ?? mongoose.model<User>('User', userSchema)
