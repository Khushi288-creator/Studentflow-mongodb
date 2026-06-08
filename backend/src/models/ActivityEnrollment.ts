import mongoose, { type InferSchemaType } from 'mongoose'
import { withStringId } from './common'

const activityEnrollmentSchema = withStringId(
  {
    studentId: { type: String, required: true, index: true },
    activityId: { type: String, required: true, index: true },
    paymentStatus: { type: String, default: 'pending' },
    rating: { type: Number, default: null },
  },
  { collection: 'activity_enrollments', updatedAt: false },
)

activityEnrollmentSchema.index({ studentId: 1, activityId: 1 }, { unique: true })

export type ActivityEnrollmentDoc = InferSchemaType<typeof activityEnrollmentSchema> & {
  _id: string
  createdAt: Date
}

export const ActivityEnrollment =
  mongoose.models.ActivityEnrollment ?? mongoose.model('ActivityEnrollment', activityEnrollmentSchema)
