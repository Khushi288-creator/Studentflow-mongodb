import mongoose, { type InferSchemaType } from 'mongoose'
import { withStringId } from './common'

const salarySchema = withStringId(
  {
    teacherId: { type: String, required: true, index: true },
    month: { type: Number, required: true },
    year: { type: Number, required: true },
    baseSalary: { type: Number, required: true },
    hra: { type: Number, default: 0 },
    bonus: { type: Number, default: 0 },
    leaveDeduction: { type: Number, default: 0 },
    latePenalty: { type: Number, default: 0 },
    netSalary: { type: Number, required: true },
    status: { type: String, default: 'pending' },
    paidAt: { type: Date, default: null },
  },
  { collection: 'salaries', updatedAt: false },
)

export type SalaryDoc = InferSchemaType<typeof salarySchema> & { _id: string; createdAt: Date }

export const Salary = mongoose.models.Salary ?? mongoose.model('Salary', salarySchema)
