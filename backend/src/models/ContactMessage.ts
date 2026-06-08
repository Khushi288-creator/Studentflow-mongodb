import mongoose, { type InferSchemaType } from 'mongoose'
import { withStringId } from './common'

const contactMessageSchema = withStringId(
  {
    userId: { type: String, default: null, index: true },
    name: { type: String, required: true },
    email: { type: String, required: true },
    message: { type: String, required: true },
    teacherId: { type: String, default: null },
    category: { type: String, default: 'general' },
    senderRole: { type: String, default: 'student' },
    status: { type: String, default: 'pending' },
    adminReply: { type: String, default: null },
  },
  { collection: 'contact_messages', updatedAt: false },
)

export type ContactMessageDoc = InferSchemaType<typeof contactMessageSchema> & {
  _id: string
  createdAt: Date
}

export const ContactMessage =
  mongoose.models.ContactMessage ?? mongoose.model('ContactMessage', contactMessageSchema)
