import mongoose, { type InferSchemaType } from 'mongoose'
import { withStringId } from './common'

const parentProfileSchema = withStringId(
  {
    userId: { type: String, required: true, unique: true, index: true },
    phone: { type: String, default: null },
    photoUrl: { type: String, default: null },
    studentId: { type: String, default: null, index: true },
  },
  { collection: 'parent_profiles', updatedAt: false },
)

export type ParentProfileDoc = InferSchemaType<typeof parentProfileSchema> & {
  _id: string
  createdAt: Date
}

export const ParentProfile =
  mongoose.models.ParentProfile ?? mongoose.model('ParentProfile', parentProfileSchema)
