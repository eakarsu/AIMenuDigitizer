import { Request, Response, NextFunction } from 'express';

export interface PasswordValidationResult {
  valid: boolean;
  errors: string[];
  strength: number;
}

export function validatePassword(password: string): PasswordValidationResult {
  const errors: string[] = [];
  let strength = 0;

  if (password.length >= 8) strength += 1;
  else errors.push('Password must be at least 8 characters');

  if (/[A-Z]/.test(password)) strength += 1;
  else errors.push('Password must contain at least one uppercase letter');

  if (/[a-z]/.test(password)) strength += 1;
  else errors.push('Password must contain at least one lowercase letter');

  if (/[0-9]/.test(password)) strength += 1;
  else errors.push('Password must contain at least one number');

  if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) strength += 1;
  else errors.push('Password must contain at least one special character');

  return {
    valid: errors.length === 0,
    errors,
    strength,
  };
}

export const validatePasswordMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const { password } = req.body;
  if (!password) {
    return res.status(400).json({ error: 'Password is required' });
  }

  const result = validatePassword(password);
  if (!result.valid) {
    return res.status(400).json({ error: 'Password does not meet requirements', details: result.errors });
  }

  next();
};
