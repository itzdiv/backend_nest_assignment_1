import {z} from 'zod';

//validation schema for registering
export const RegisterSchema=z.object({
    email: z.email(),
    password:z.string().min(6),
});

//validation schema for login
export const LoginSchema=z.object({
    email:z.email(),
    password:z.string()
});

export type RegisterDto=z.infer<typeof RegisterSchema>;
export type LoginDto=z.infer<typeof LoginSchema>;