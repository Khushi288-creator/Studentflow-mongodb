import mongoose, { type InferSchemaType } from 'mongoose'
import { withStringId } from './common'

const assignmentSchema = withStringId(
  {
    courseId: { type: String, required: true, index: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    dueDate: { type: Date, required: true },
  },
  { collection: 'assignments', updatedAt: false },
)

export type AssignmentDoc = InferSchemaType<typeof assignmentSchema> & { _id: string; createdAt: Date }

export const Assignment = mongoose.models.Assignment ?? mongoose.model('Assignment', assignmentSchema)
