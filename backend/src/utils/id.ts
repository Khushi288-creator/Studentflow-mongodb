import { randomBytes } from 'crypto'

/** CUID-like string id compatible with existing Prisma records */
export function createId(): string {
  const time = Date.now().toString(36)
  const rand = randomBytes(8).toString('base64url').replace(/[^a-z0-9]/gi, '').slice(0, 12)
  return `c${time}${rand}`.slice(0, 25)
}
