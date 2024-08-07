import "reflect-metadata"
import { DataSource } from "typeorm"
import { SnakeNamingStrategy } from "typeorm-naming-strategies"
import { join } from "path"
import dotenv from "dotenv"
import { CONFIG } from "./config"

// Load environment variables from .env file
dotenv.config()

console.log("DATABASE_URL:", CONFIG.DATABASE_URL)

export const AppDataSource = new DataSource({
  type: "postgres",
  url: CONFIG.DATABASE_URL,
  synchronize: false,
  logging: true,
  migrationsRun: true,
  namingStrategy: new SnakeNamingStrategy(),
  entities: [join(__dirname, 'entity', '*.{js,ts}')],
  migrations: [join(__dirname, 'migrations', '*.{js,ts}')],
  subscribers: [],
})