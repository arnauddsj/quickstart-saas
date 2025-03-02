/**
 * Script to create an admin user in the system
 * Usage: npm run ts-node src/scripts/create-admin.ts admin@example.com
 */

import { AppDataSource } from "../data-source"
import { User } from "../entity/User"
import dotenv from "dotenv"
import { UserRole } from "../entity/User"
import { logger } from "../utils/logger"

// Load environment variables
dotenv.config()

async function createAdmin() {
  try {
    // Get email from command line arguments
    const email = process.argv[2]
    if (!email) {
      console.error("Please provide an email address.")
      console.log("Usage: npm run ts-node src/scripts/create-admin.ts admin@example.com")
      process.exit(1)
    }

    // Initialize database connection
    await AppDataSource.initialize()
    logger.info("Database connection has been established.")

    const userRepository = AppDataSource.getRepository(User)
    
    // Check if user already exists
    let user = await userRepository.findOne({ where: { email } })
    
    if (user) {
      // If the user exists, update role to admin
      user.role = 'admin' as UserRole
      await userRepository.save(user)
      logger.info(`User ${email} already exists. Role updated to admin.`)
    } else {
      // Create a new admin user
      user = userRepository.create({
        email,
        role: 'admin' as UserRole,
        name: 'Admin User'
      })
      await userRepository.save(user)
      logger.info(`Admin user created with email: ${email}`)
    }
    
    // Log admin credentials
    logger.info('Admin user is now available.')
    logger.info('Use the "Send Magic Link" feature to log in with this account.')
    
    process.exit(0)
  } catch (error) {
    logger.error("Failed to create admin user:", {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    })
    process.exit(1)
  }
}

createAdmin() 