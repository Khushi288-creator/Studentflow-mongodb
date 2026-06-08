import mongoose, { type InferSchemaType } from 'mongoose'
import { withStringId } from './common'

const noticeSchema = withStringId(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    date: { type: Date, default: () => new Date() },
    type: { type: String, default: 'notice' },
    userId: { type: String, default: null, index: true },
  },
  { collection: 'notices', updatedAt: false },
)

export type NoticeDoc = InferSchemaType<typeof noticeSchema> & { _id: string; createdAt: Date }

export const Notice = mongoose.models.Notice ?? mongoose.model('Notice', noticeSchema)
