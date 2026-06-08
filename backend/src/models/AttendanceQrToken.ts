import mongoose, { type InferSchemaType } from 'mongoose'
import { withStringId } from './common'

const attendanceQrTokenSchema = withStringId(
  {
    courseId: { type: String, required: true, index: true },
    token: { type: String, required: true, unique: true, index: true },
    attendanceDate: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
  },
  { collection: 'attendance_qr_tokens', updatedAt: false },
)

export type AttendanceQrTokenDoc = InferSchemaType<typeof attendanceQrTokenSchema> & {
  _id: string
  createdAt: Date
}

export const AttendanceQrToken =
  mongoose.models.AttendanceQrToken ?? mongoose.model('AttendanceQrToken', attendanceQrTokenSchema)
