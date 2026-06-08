import { type NextFunction, type Request, type Response } from 'express'
import jwt from 'jsonwebtoken'
import { type Role } from '../types/enums'

export type AuthUser = {
  userId: string
  role: Role
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthUser
    }
  }
}

export function authenticateJWT(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization
  const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : null

  if (!token) return res.status(401).json({ message: 'Missing token' })

  const secret = process.env.JWT_ACCESS_SECRET
  if (!secret) return res.status(500).json({ message: 'Server misconfigured' })

  try {
    const payload = jwt.verify(token, secret) as { sub: string; role: Role }
    req.auth = { userId: payload.sub, role: payload.role }
    next()
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token' })
  }
}

export function requireRole(roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.auth) return res.status(401).json({ message: 'Not authenticated' })
    if (!roles.includes(req.auth.role)) return res.status(403).json({ message: 'Forbidden' })
    next()
  }
}

