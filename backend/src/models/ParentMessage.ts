import mongoose, { type InferSchemaType } from 'mongoose'
import { withStringId } from './common'

const parentMessageSchema = withStringId(
  {
    parentId: { type: String, required: true, index: true },
    teacherId: { type: String, required: true, index: true },
    senderId: { type: String, required: true, index: true },
    text: { type: String, required: true },
  },
  { collection: 'parent_messages', updatedAt: false },
)

export type ParentMessageDoc = InferSchemaType<typeof parentMessageSchema> & {
  _id: string
  createdAt: Date
}

export const ParentMessage =
  mongoose.models.ParentMessage ?? mongoose.model('ParentMessage', parentMessageSchema)
