import { SignJWT, jwtVerify } from "jose";

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? "routine-secret-key-change-in-production"
);

export async function createEditJwt(eventId: string): Promise<string> {
  return new SignJWT({ eventId, role: "editor" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("2h")
    .sign(SECRET);
}

export async function verifyEditJwt(
  token: string
): Promise<{ eventId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    if (
      typeof payload.eventId === "string" &&
      payload.role === "editor"
    ) {
      return { eventId: payload.eventId };
    }
    return null;
  } catch {
    return null;
  }
}
