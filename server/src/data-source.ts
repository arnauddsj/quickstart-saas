import "reflect-metadata"
import { DataSource, DataSourceOptions } from "typeorm"
import { SnakeNamingStrategy } from "typeorm-naming-strategies"
import { join } from "path"
import dotenv from "dotenv"
import { CONFIG } from "./config"

// Load environment variables from .env file
dotenv.config()

const baseConfig: Partial<DataSourceOptions> = {
  type: "postgres",
  url: CONFIG.DATABASE_URL,
  synchronize: true,
  logging: !CONFIG.IS_PRODUCTION,
  namingStrategy: new SnakeNamingStrategy(),
  entities: [join(__dirname, 'entity', '*.{js,ts}')],
  migrations: [join(__dirname, 'migrations', '*.{js,ts}')],
  subscribers: [],
  // Connection pool configuration
  extra: {
    // Min/max size of the pool
    min: 2,
    max: 10,
    idleTimeoutMillis: 30000,
    acquireTimeoutMillis: 30000,
  },
  // Query cache configuration
  cache: CONFIG.IS_PRODUCTION ? {
    type: "ioredis",
    duration: 60000, // 1 minute
  } : false,
}

export const AppDataSource = new DataSource(baseConfig as DataSourceOptions)