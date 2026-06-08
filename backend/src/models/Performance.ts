import mongoose, { type InferSchemaType } from 'mongoose'
import { withStringId } from './common'

const performanceSchema = withStringId(
  {
    studentId: { type: String, required: true, index: true },
    subject: { type: String, required: true },
    marks: { type: Number, required: true },
    examName: { type: String, required: true },
  },
  { collection: 'performances', updatedAt: false },
)

export type PerformanceDoc = InferSchemaType<typeof performanceSchema> & {
  _id: string
  createdAt: Date
}

export const Performance = mongoose.models.Performance ?? mongoose.model('Performance', performanceSchema)
