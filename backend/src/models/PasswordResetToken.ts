import mongoose, { type InferSchemaType } from 'mongoose'
import { withStringId } from './common'

const passwordResetTokenSchema = withStringId(
  {
    userId: { type: String, required: true, index: true },
    token: { type: String, required: true, unique: true, index: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: null },
  },
  { collection: 'password_reset_tokens', updatedAt: false },
)

export type PasswordResetTokenDoc = InferSchemaType<typeof passwordResetTokenSchema> & {
  _id: string
  createdAt: Date
}

export const PasswordResetToken =
  mongoose.models.PasswordResetToken ??
  mongoose.model('PasswordResetToken', passwordResetTokenSchema)
