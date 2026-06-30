import type { Document } from 'mongoose'

type WithMongoId = { _id?: unknown; id?: string }

/** Normalize mongoose document for API responses (id field like Prisma) */
export function toApiId<T extends WithMongoId>(doc: T | null | undefined): T | null | undefined {
  if (!doc) return doc
  const id = doc.id ?? (doc._id != null ? String(doc._id) : undefined)
  if (id && !doc.id) {
    return { ...doc, id }
  }
  return doc
}

export function mapApiIds<T extends WithMongoId>(docs: T[]): T[] {
  return docs.map((d) => toApiId(d) as T)
}

export function leanDoc<T extends Record<string, unknown>>(doc: T | null): (T & { id: string }) | null {
  if (!doc) return null
  const id = doc.id != null ? String(doc.id) : doc._id != null ? String(doc._id) : ''
  const { _id, ...rest } = doc
  return { ...rest, id } as T & { id: string }
}

export function leanDocs<T extends Record<string, unknown>>(docs: T[]): (T & { id: string })[] {
  return docs.map((d) => leanDoc(d)!)
}

export function pickUserFields(user: {
  _id?: unknown
  id?: string
  name: string
  email: string
  role: string
  uniqueId?: string | null
  createdAt?: Date
}) {
  const id = user.id ?? String(user._id)
  return {
    id,
    name: user.name,
    email: user.email,
    role: user.role,
    uniqueId:
      user.uniqueId ??
      (user.email.endsWith('@school.local') ? user.email.replace('@school.local', '') : null),
    ...(user.createdAt ? { createdAt: user.createdAt } : {}),
  }
}

export function isMongoDoc(doc: unknown): doc is Document {
  return doc != null && typeof (doc as Document).toObject === 'function'
}
