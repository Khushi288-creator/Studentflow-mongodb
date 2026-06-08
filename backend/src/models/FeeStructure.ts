import mongoose, { type InferSchemaType } from 'mongoose'
import { withStringId } from './common'

const feeStructureSchema = withStringId(
  {
    className: { type: String, required: true, index: true },
    feeType: { type: String, default: 'tuition' },
    amount: { type: Number, required: true },
    dueDate: { type: String, default: null },
  },
  { collection: 'fee_structures', updatedAt: false },
)

export type FeeStructureDoc = InferSchemaType<typeof feeStructureSchema> & {
  _id: string
  createdAt: Date
}

export const FeeStructure =
  mongoose.models.FeeStructure ?? mongoose.model('FeeStructure', feeStructureSchema)
