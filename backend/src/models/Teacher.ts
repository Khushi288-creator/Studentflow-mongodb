import mongoose, { type InferSchemaType } from 'mongoose'
import { withStringId } from './common'

const teacherSchema = withStringId(
  {
    userId: { type: String, required: true, unique: true, index: true },
    subject: { type: String, required: true },
    phone: { type: String, default: null },
    address: { type: String, default: null },
    bloodType: { type: String, default: null },
    birthday: { type: String, default: null },
    sex: { type: String, default: null },
    photoUrl: { type: String, default: null },
  },
  { collection: 'teachers', updatedAt: false },
)

export type TeacherDoc = InferSchemaType<typeof teacherSchema> & { _id: string; createdAt: Date }

export const Teacher = mongoose.models.Teacher ?? mongoose.model('Teacher', teacherSchema)
