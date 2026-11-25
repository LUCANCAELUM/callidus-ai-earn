import { Request, Response, NextFunction } from 'express';
import { DecodedIdToken } from 'firebase-admin/auth';
import { eq } from 'drizzle-orm';
import { adminAuth } from '../lib/firebase-admin.ts';
import { db } from '../db/index.ts';
import { users } from '../db/schema.ts';

export interface AuthRequest extends Request {
  user?: DecodedIdToken;
  dbUser?: typeof users.$inferSelect;
}

function makeReferralCode(uid: string) {
  const clean = uid.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 6);
  return `CAL-${clean || 'KE254'}`;
}

export async function getOrCreateUser(
  uid: string,
  email: string,
  fullName?: string,
  emailVerified?: boolean
) {
  try {
    const referralCode = makeReferralCode(uid);
    const existing = await db.select().from(users).where(eq(users.uid, uid)).limit(1);
    if (existing.length > 0) {
      const updated = await db
        .update(users)
        .set({
          email,
          emailVerified: emailVerified ?? existing[0].emailVerified,
          fullName: existing[0].fullName || fullName || email.split('@')[0],
          updatedAt: new Date(),
        })
        .where(eq(users.uid, uid))
        .returning();
      return updated[0];
    }

    const result = await db
      .insert(users)
      .values({
        uid,
        email,
        fullName: fullName || email.split('@')[0],
        emailVerified: Boolean(emailVerified),
        referralCode,
        role: 'contributor',
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email,
          emailVerified: Boolean(emailVerified),
          updatedAt: new Date(),
        },
      })
      .returning();

    return result[0];
  } catch (error) {
    console.error('Database error in getOrCreateUser:', error);
    throw new Error('Failed to synchronize user account.', { cause: error });
  }
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing authentication token' });
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    req.user = decodedToken;
    const dbUser = await getOrCreateUser(
      decodedToken.uid,
      decodedToken.email || `${decodedToken.uid}@callidus.local`,
      typeof decodedToken.name === 'string' ? decodedToken.name : undefined,
      decodedToken.email_verified
    );
    if (dbUser.accountStatus === 'suspended') {
      return res.status(403).json({ error: 'Account suspended. Contact compliance support.' });
    }
    req.dbUser = dbUser;
    next();
  } catch (error) {
    console.error('Auth verification error:', error);
    return res.status(401).json({ error: 'Unauthorized: Invalid or expired session token' });
  }
};

export const optionalAuth = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }
  const token = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    req.user = decodedToken;
    const existing = await db
      .select()
      .from(users)
      .where(eq(users.uid, decodedToken.uid))
      .limit(1);
    if (existing.length > 0) {
      req.dbUser = existing[0];
    }
  } catch {
    // Proceed unauthenticated if optional token is invalid
  }
  next();
};

export const requireRoles = (allowedRoles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.dbUser) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    if (!allowedRoles.includes(req.dbUser.role)) {
      return res.status(403).json({
        error: `Forbidden: Requires one of [${allowedRoles.join(', ')}] permissions`,
      });
    }
    next();
  };
};
