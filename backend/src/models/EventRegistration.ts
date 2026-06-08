import mongoose, { type InferSchemaType } from 'mongoose'
import { withStringId } from './common'

const eventRegistrationSchema = withStringId(
  {
    eventId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
  },
  { collection: 'event_registrations', updatedAt: false },
)

eventRegistrationSchema.index({ eventId: 1, userId: 1 }, { unique: true })

export type EventRegistrationDoc = InferSchemaType<typeof eventRegistrationSchema> & {
  _id: string
  createdAt: Date
}

export const EventRegistration =
  mongoose.models.EventRegistration ?? mongoose.model('EventRegistration', eventRegistrationSchema)
