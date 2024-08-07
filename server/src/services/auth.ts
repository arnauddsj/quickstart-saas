import { AppDataSource } from '../data-source'
import { User } from '../entity/User'
import { Token } from '../entity/Token'

export async function verifyAndGetUser(token: string): Promise<User | null> {
  const tokenRepository = AppDataSource.getRepository(Token)
  const userRepository = AppDataSource.getRepository(User)

  const tokenRecord = await tokenRepository.findOne({
    where: { token },
    relations: ['user'],
  })

  if (!tokenRecord || tokenRecord.expiresAt < new Date()) {
    return null
  }

  const user = await userRepository.findOne({
    where: { id: tokenRecord.user.id },
  })

  return user
}
