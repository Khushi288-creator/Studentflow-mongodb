import mongoose, { type InferSchemaType } from 'mongoose'
import { withStringId } from './common'

const studentProfileSchema = withStringId(
  {
    userId: { type: String, required: true, unique: true, index: true },
    gender: { type: String, default: null },
    fatherName: { type: String, default: null },
    motherName: { type: String, default: null },
    dob: { type: String, default: null },
    religion: { type: String, default: null },
    fatherOccupation: { type: String, default: null },
    address: { type: String, default: null },
    className: { type: String, default: null, index: true },
    phone: { type: String, default: null },
    photoUrl: { type: String, default: null },
  },
  { collection: 'student_profiles', updatedAt: false },
)

export type StudentProfileDoc = InferSchemaType<typeof studentProfileSchema> & {
  _id: string
  createdAt: Date
}

export const StudentProfile =
  mongoose.models.StudentProfile ?? mongoose.model('StudentProfile', studentProfileSchema)
