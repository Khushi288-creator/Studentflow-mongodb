import mongoose, { type InferSchemaType } from 'mongoose'
import { withStringId } from './common'

const courseSchema = withStringId(
  {
    name: { type: String, required: true },
    teacherId: { type: String, required: true, index: true },
  },
  { collection: 'courses', updatedAt: false },
)

export type CourseDoc = InferSchemaType<typeof courseSchema> & { _id: string; createdAt: Date }

export const Course = mongoose.models.Course ?? mongoose.model('Course', courseSchema)
