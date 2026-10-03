import { Prisma } from "../../generated/prisma/client.js";

import { ApplicationError } from "../../app/application-error.js";
import { prisma } from "../../lib/prisma.js";
import {
  hashPassword,
  verifyPassword,
} from "../../lib/password.js";

export class EmailAlreadyExistsError extends ApplicationError {
  constructor() {
    super(
      "EMAIL_ALREADY_EXISTS",
      "A user with this email already exists.",
      409,
    );

    this.name = "EmailAlreadyExistsError";
  }
}

export async function createUser(
  email: string,
  password: string,
  name: string,
) {
  const passwordHash = await hashPassword(password);

  try {
    return await prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new EmailAlreadyExistsError();
    }

    throw error;
  }
}

export async function authenticateUser(
  email: string,
  password: string,
) {
  const user = await prisma.user.findUnique({
    where: {
      email,
    },
  });

  if (!user || !user.isActive) {
    return null;
  }

  const passwordValid = await verifyPassword(
    password,
    user.passwordHash,
  );

  if (!passwordValid) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  };
}