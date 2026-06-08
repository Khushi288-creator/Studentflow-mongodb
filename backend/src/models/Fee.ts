import mongoose, { type InferSchemaType } from 'mongoose'
import { withStringId } from './common'
import { FEE_STATUSES } from '../types/enums'

const feeSchema = withStringId(
  {
    studentId: { type: String, required: true, index: true },
    amount: { type: Number, required: true },
    paidAmount: { type: Number, default: 0 },
    status: { type: String, enum: FEE_STATUSES, required: true },
    className: { type: String, default: null },
    feeType: { type: String, default: 'tuition' },
    description: { type: String, default: null },
    dueDate: { type: String, default: null },
  },
  { collection: 'fees', updatedAt: false },
)

export type FeeDoc = InferSchemaType<typeof feeSchema> & { _id: string; createdAt: Date }

export const Fee = mongoose.models.Fee ?? mongoose.model('Fee', feeSchema)
