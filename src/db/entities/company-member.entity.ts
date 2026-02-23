// src/db/entities/company-member.entity.ts

import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';

import { BaseEntity } from '../base.entity';
import { User } from './user.entity';
import { Company } from './company.entity';
import { CompanyRole, MemberStatus } from '../enums';

/*
  Maps to company_members table
*/
@Entity({ name: 'company_members' })
@Index(['company', 'user'], { unique: true })
export class CompanyMember extends BaseEntity {

  /*
    Many memberships belong to one company
  */
  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'company_id' })
  @Index()
  company: Company;

  /*
    Many memberships belong to one user
  */
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  @Index()
  user: User;

  /*
    Role ENUM
  */
  @Column({
    type: 'enum',
    enum: CompanyRole,
  })
  role: CompanyRole;

  /*
    Status ENUM
  */
  @Column({
    type: 'enum',
    enum: MemberStatus,
    default: MemberStatus.ACTIVE,
  })
  status: MemberStatus;

  /*
    Who invited this user
  */
  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'invited_by' })
  invited_by: User;
}
