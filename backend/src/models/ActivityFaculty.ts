import mongoose, { type InferSchemaType } from 'mongoose'
import { withStringId } from './common'

const activityFacultySchema = withStringId(
  {
    name: { type: String, required: true },
    activityId: { type: String, required: true, index: true },
    salaryType: { type: String, default: 'fixed' },
    salaryAmount: { type: Number, required: true },
  },
  { collection: 'activity_faculties', updatedAt: false },
)

export type ActivityFacultyDoc = InferSchemaType<typeof activityFacultySchema> & {
  _id: string
  createdAt: Date
}

export const ActivityFaculty =
  mongoose.models.ActivityFaculty ?? mongoose.model('ActivityFaculty', activityFacultySchema)
