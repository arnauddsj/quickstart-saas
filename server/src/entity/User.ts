import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from "typeorm"
import { Token } from "./Token"

// Define the UserRole type for better type safety
export type UserRole = 'admin' | 'member'

@Entity()
export class User {
  @PrimaryGeneratedColumn("uuid")
  id: string

  @Column({ unique: true })
  email: string

  @Column({ nullable: true })
  name: string

  @Column({
    type: 'varchar',
    default: 'member',
    enum: ['admin', 'member']
  })
  role: UserRole

  @OneToMany(() => Token, token => token.user)
  tokens: Token[]

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}