import { AppDataSource } from "../data-source"
import { User } from "../entity/User"
import { sign, verify } from "jsonwebtoken"
import crypto from "crypto"
import { CONFIG } from "../config"
import { Token } from "../entity/Token"

export async function generateAuthToken(user: User): Promise<string> {
  const tokenRepository = AppDataSource.getRepository(Token)
  const tokenValue = crypto.randomBytes(32).toString("hex")
  const expiresAt = new Date(Date.now() + CONFIG.SESSION_DURATION * 1000)

  const tokenEntity = await tokenRepository.save({
    token: tokenValue,
    user,
    expiresAt,
  })

  return sign({ userId: user.id, tokenId: tokenEntity.id }, CONFIG.JWT_SECRET, { expiresIn: CONFIG.SESSION_DURATION })
}

export async function verifyAndGetUser(token: string): Promise<User | null> {
  try {
    const decoded = verify(token, CONFIG.JWT_SECRET) as { userId: string; tokenId: string }
    const tokenRepository = AppDataSource.getRepository(Token)
    const userRepository = AppDataSource.getRepository(User)

    const storedToken = await tokenRepository.findOne({
      where: { id: decoded.tokenId },
      relations: ["user"],
    })

    if (!storedToken || storedToken.expiresAt < new Date()) {
      return null
    }

    const user = await userRepository.findOne({ where: { id: decoded.userId } })
    return user || null
  } catch (error) {
    console.error("Token verification failed:", error)
    return null
  }
}