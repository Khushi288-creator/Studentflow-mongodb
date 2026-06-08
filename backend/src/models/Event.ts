import mongoose, { type InferSchemaType } from 'mongoose'
import { withStringId } from './common'

const eventSchema = withStringId(
  {
    title: { type: String, required: true },
    date: { type: Date, required: true, index: true },
    description: { type: String, required: true },
    status: { type: String, default: 'upcoming' },
    time: { type: String, default: null },
    targetClass: { type: String, default: 'All Classes' },
  },
  { collection: 'events', updatedAt: false },
)

export type EventDoc = InferSchemaType<typeof eventSchema> & { _id: string; createdAt: Date }

export const Event = mongoose.models.Event ?? mongoose.model('Event', eventSchema)
