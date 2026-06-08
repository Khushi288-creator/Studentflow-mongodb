import mongoose, { type InferSchemaType } from 'mongoose'
import { withStringId } from './common'

const noticeReadSchema = withStringId(
  {
    noticeId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    readAt: { type: Date, default: () => new Date() },
  },
  { collection: 'notice_reads', updatedAt: false },
)

noticeReadSchema.index({ noticeId: 1, userId: 1 }, { unique: true })

export type NoticeReadDoc = InferSchemaType<typeof noticeReadSchema> & { _id: string; createdAt: Date }

export const NoticeRead = mongoose.models.NoticeRead ?? mongoose.model('NoticeRead', noticeReadSchema)
