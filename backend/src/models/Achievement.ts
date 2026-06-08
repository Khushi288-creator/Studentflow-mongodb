import mongoose, { type InferSchemaType } from 'mongoose'
import { withStringId } from './common'

const achievementSchema = withStringId(
  {
    studentId: { type: String, required: true, index: true },
    title: { type: String, required: true },
    type: { type: String, required: true },
    rank: { type: String, default: null },
    date: { type: String, default: null },
  },
  { collection: 'achievements', updatedAt: false },
)

export type AchievementDoc = InferSchemaType<typeof achievementSchema> & {
  _id: string
  createdAt: Date
}

export const Achievement = mongoose.models.Achievement ?? mongoose.model('Achievement', achievementSchema)
