import mongoose, { type InferSchemaType } from 'mongoose'
import { withStringId } from './common'

const resultSchema = withStringId(
  {
    studentId: { type: String, required: true, index: true },
    courseId: { type: String, required: true, index: true },
    marks: { type: Number, required: true },
    grade: { type: String, required: true },
  },
  { collection: 'results', updatedAt: false },
)

resultSchema.index({ studentId: 1, courseId: 1 }, { unique: true })

export type ResultDoc = InferSchemaType<typeof resultSchema> & { _id: string; createdAt: Date }

export const Result = mongoose.models.Result ?? mongoose.model('Result', resultSchema)
