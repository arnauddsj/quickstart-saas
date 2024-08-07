import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn } from "typeorm"
import { User } from "./User"

@Entity()
export class Token {
  @PrimaryGeneratedColumn("uuid")
  id: string

  @Column()
  token: string

  @ManyToOne(() => User, user => user.tokens)
  user: User

  @Column()
  expiresAt: Date

  @CreateDateColumn()
  createdAt: Date
}