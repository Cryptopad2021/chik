import { z } from 'zod';
import { Role } from '../../common/constants';

export const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Пароль минимум 8 символов'),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  role: z.nativeEnum(Role),
});

export const patchUserSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  role: z.nativeEnum(Role).optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(8).optional(),
});
