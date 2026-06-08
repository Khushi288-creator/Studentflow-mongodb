import mongoose, { type InferSchemaType } from 'mongoose'
import { withStringId } from './common'

const activityAttendanceSchema = withStringId(
  {
    studentId: { type: String, required: true, index: true },
    activityId: { type: String, required: true, index: true },
    date: { type: String, required: true },
    status: { type: String, default: 'present' },
  },
  { collection: 'activity_attendances', updatedAt: false },
)

activityAttendanceSchema.index({ studentId: 1, activityId: 1, date: 1 }, { unique: true })

export type ActivityAttendanceDoc = InferSchemaType<typeof activityAttendanceSchema> & {
  _id: string
  createdAt: Date
}

export const ActivityAttendance =
  mongoose.models.ActivityAttendance ?? mongoose.model('ActivityAttendance', activityAttendanceSchema)
