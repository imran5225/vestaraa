import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { registerUser, loginUser } from "./auth.server";

export const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,30}$/;

const registerSchema = z
  .object({
    username: z
      .string()
      .trim()
      .min(3, "Username must be at least 3 characters")
      .max(30, "Username cannot exceed 30 characters")
      .regex(USERNAME_REGEX, "Username can only contain letters, numbers, and underscores"),
    password: z.string().min(8, "Password must be at least 8 characters long"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

const loginSchema = z.object({
  username: z.string().trim().min(1, "Please enter your username"),
  password: z.string().min(1, "Please enter your password"),
});

export const registerWithUsername = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => registerSchema.parse(input))
  .handler(async ({ data }) => {
    return registerUser(data);
  });

export const loginWithUsername = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => loginSchema.parse(input))
  .handler(async ({ data }) => {
    return loginUser(data);
  });
