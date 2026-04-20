import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  BeforeInsert,
  BeforeUpdate,
  OneToMany,
} from 'typeorm';
import * as bcrypt from 'bcrypt';

export enum UserRole {
  ADMIN = 'admin',
  SUPERADMIN = 'superadmin',
  SELLER = 'seller',
  CUSTOMER = 'customer',
}

export enum UserStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column({ name: 'password_hash' })
  passwordHash: string;

  @Column({ nullable: true })
  name: string;

  @Column({ nullable: true })
  phone: string;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.CUSTOMER,
  })
  role: UserRole;

  @Column({
    type: 'enum',
    enum: UserStatus,
    default: UserStatus.APPROVED, // Default for customers (migration logic will handle old users)
  })
  status: UserStatus;

  @Column({ name: 'is_blocked', default: false })
  isBlocked: boolean;

  @Column({ name: 'passport_main_url', nullable: true })
  passportMainUrl: string | null;

  @Column({ name: 'passport_registration_url', nullable: true })
  passportRegistrationUrl: string | null;

  @Column({ name: 'selfie_url', nullable: true })
  selfieUrl: string | null;

  @Column({ name: 'token_version', type: 'integer', default: 0 })
  tokenVersion: number;

  // Seller profile fields
  @Column({ name: 'shop_name', nullable: true })
  shopName: string | null;

  @Column({ name: 'shop_description', type: 'text', nullable: true })
  shopDescription: string | null;

  @Column({ name: 'shop_logo', nullable: true })
  shopLogo: string | null;

  @Column({ name: 'contact_phone', nullable: true })
  contactPhone: string | null;

  @Column({ name: 'contact_email', nullable: true })
  contactEmail: string | null;

  @Column({ name: 'contact_address', type: 'text', nullable: true })
  contactAddress: string | null;

  // Referral fields
  @Column({ unique: true, nullable: true })
  slug: string | null;

  @Column({ name: 'referral_code', unique: true, nullable: true })
  referralCode: string | null;

  @Column({ name: 'referral_visits', type: 'integer', default: 0 })
  referralVisits: number;

  @Column({ name: 'referral_orders', type: 'integer', default: 0 })
  referralOrders: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany('ServiceZone', 'seller')
  zones: any[];

  @BeforeInsert()
  @BeforeUpdate()
  async hashPassword() {
    if (this.passwordHash && !this.passwordHash.startsWith('$2')) {
      this.passwordHash = await bcrypt.hash(this.passwordHash, 10);
    }
  }

  async validatePassword(password: string): Promise<boolean> {
    return bcrypt.compare(password, this.passwordHash);
  }
}
