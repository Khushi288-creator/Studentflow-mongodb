import mongoose, { type InferSchemaType } from 'mongoose'
import { withStringId } from './common'
import { ATTENDANCE_STATUSES } from '../types/enums'

const attendanceSchema = withStringId(
  {
    studentId: { type: String, required: true, index: true },
    courseId: { type: String, required: true, index: true },
    date: { type: Date, required: true, index: true },
    status: { type: String, enum: ATTENDANCE_STATUSES, required: true },
  },
  { collection: 'attendances', updatedAt: false },
)

attendanceSchema.index({ studentId: 1, courseId: 1, date: 1 }, { unique: true })

export type AttendanceDoc = InferSchemaType<typeof attendanceSchema> & { _id: string; createdAt: Date }

export const Attendance = mongoose.models.Attendance ?? mongoose.model('Attendance', attendanceSchema)
