import mongoose, { type InferSchemaType } from 'mongoose'
import { withStringId } from './common'

const studentEnrollmentSchema = withStringId(
  {
    userId: { type: String, required: true, index: true },
    courseId: { type: String, required: true, index: true },
    phone: { type: String, required: true },
  },
  { collection: 'student_enrollments', updatedAt: false },
)

studentEnrollmentSchema.index({ userId: 1, courseId: 1 }, { unique: true })

export type StudentEnrollmentDoc = InferSchemaType<typeof studentEnrollmentSchema> & {
  _id: string
  createdAt: Date
}

export const StudentEnrollment =
  mongoose.models.StudentEnrollment ?? mongoose.model('StudentEnrollment', studentEnrollmentSchema)
