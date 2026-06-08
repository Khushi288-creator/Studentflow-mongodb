import mongoose, { type InferSchemaType } from 'mongoose'
import { withStringId } from './common'

const studyTaskSchema = withStringId(
  {
    userId: { type: String, required: true, index: true },
    title: { type: String, required: true },
    dueDate: { type: Date, required: true },
  },
  { collection: 'study_tasks', updatedAt: false },
)

export type StudyTaskDoc = InferSchemaType<typeof studyTaskSchema> & { _id: string; createdAt: Date }

export const StudyTask = mongoose.models.StudyTask ?? mongoose.model('StudyTask', studyTaskSchema)
