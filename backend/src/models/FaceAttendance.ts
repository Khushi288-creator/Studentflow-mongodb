import mongoose, { Schema, type InferSchemaType } from 'mongoose'

const faceAttendanceSchema = new Schema(
  {
    studentId: { type: String, required: true, index: true },
    studentName: { type: String, required: true },
    classId: { type: String, default: null, index: true },
    date: { type: String, required: true, index: true },
    time: { type: String, required: true },
    status: { type: String, enum: ['present', 'absent'], default: 'present' },
    markedBy: { type: String, required: true },
  },
  { timestamps: true, collection: 'face_attendances' },
)

faceAttendanceSchema.index({ studentId: 1, date: 1 }, { unique: true })

export type FaceAttendanceDoc = InferSchemaType<typeof faceAttendanceSchema> & {
  _id: mongoose.Types.ObjectId
  createdAt: Date
  updatedAt: Date
}

export const FaceAttendance =
  mongoose.models.FaceAttendance ?? mongoose.model('FaceAttendance', faceAttendanceSchema)
