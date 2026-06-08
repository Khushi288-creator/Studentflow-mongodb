import mongoose, { type InferSchemaType } from 'mongoose'
import { withStringId } from './common'
import { ROLES } from '../types/enums'

const userSchema = withStringId(
  {
    uniqueId: { type: String, unique: true, sparse: true },
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, index: true },
    password: { type: String, required: true },
    role: { type: String, enum: ROLES, required: true },
  },
  { collection: 'users', updatedAt: false },
)

export type UserDoc = InferSchemaType<typeof userSchema> & { _id: string; createdAt: Date }

export const User = mongoose.models.User ?? mongoose.model('User', userSchema)
