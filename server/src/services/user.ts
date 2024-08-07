import { AppDataSource } from "../data-source"
import { User } from "../entity/User"
import { Token } from "../entity/Token"
import { sign, verify } from "jsonwebtoken"
import crypto from "crypto"
import { CONFIG } from "../config"

export async function createUser(userData: Partial<User>): Promise<User> {
  const userRepository = AppDataSource.getRepository(User)
  const user = userRepository.create(userData)
  return await userRepository.save(user)
}

export async function generateAuthToken(user: User): Promise<string> {
  const tokenRepository = AppDataSource.getRepository(Token)
  const token = crypto.randomBytes(32).toString("hex")
  const expiresAt = new Date(Date.now() + CONFIG.SESSION_DURATION * 1000)

  await tokenRepository.save({
    token,
    user,
    expiresAt,
  })

  return sign({ userId: user.id, token }, CONFIG.JWT_SECRET, { expiresIn: CONFIG.SESSION_DURATION })
}

export async function verifyAndGetUser(token: string): Promise<User | null> {
  try {
    const decoded = verify(token, CONFIG.JWT_SECRET) as { userId: string; token: string }
    const tokenRepository = AppDataSource.getRepository(Token)

    const storedToken = await tokenRepository.findOne({
      where: { token: decoded.token },
      relations: ["user"],
    })

    if (!storedToken || storedToken.expiresAt < new Date()) {
      return null
    }

    return storedToken.user
  } catch (error) {
    console.error("Token verification failed:", error)
    return null
  }
}