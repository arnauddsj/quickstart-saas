import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from "typeorm"

@Entity()
export class Log {
  @PrimaryGeneratedColumn("uuid")
  id: string

  @CreateDateColumn()
  timestamp: Date

  @Column({
    type: "enum",
    enum: ["error", "warn", "info", "debug"],
    default: "info"
  })
  level: "error" | "warn" | "info" | "debug"

  @Column()
  message: string

  @Column({ nullable: true })
  context?: string

  @Column({ nullable: true })
  userId?: string
} 