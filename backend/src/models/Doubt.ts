import mongoose, { type InferSchemaType } from 'mongoose'
import { withStringId } from './common'
import { DOUBT_STATUSES } from '../types/enums'

const doubtSchema = withStringId(
  {
    userId: { type: String, required: true, index: true },
    studentId: { type: String, default: null, index: true },
    subject: { type: String, default: null },
    question: { type: String, required: true },
    status: { type: String, enum: DOUBT_STATUSES, default: 'open' },
    teacherReply: { type: String, default: null },
  },
  { collection: 'doubts', updatedAt: false },
)

export type DoubtDoc = InferSchemaType<typeof doubtSchema> & { _id: string; createdAt: Date }

export const Doubt = mongoose.models.Doubt ?? mongoose.model('Doubt', doubtSchema)
