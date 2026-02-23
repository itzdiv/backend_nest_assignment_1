// src/db/entities/company.entity.ts

import {
  Entity,
  Column,
  OneToMany,
} from 'typeorm';

import { BaseEntity } from '../base.entity';
import { CompanyMember } from './company-member.entity';
import { QuestionBank } from './question-bank.entity';
import { ApplicationComment } from './application-comment.entity';
/*
  Maps to companies table
*/
@Entity({ name: 'companies' })
export class Company extends BaseEntity {

  @Column({
    type: 'varchar',
    length: 255,
    nullable: false,
  })
  name: string;

  @Column({
    type: 'text',
    nullable: true,
  })
  description: string;

  @Column({
    type: 'text',
    nullable: true,
  })
  logo_url: string;

  @Column({
    type: 'text',
    nullable: true,
  })
  website: string;

  /*
    Soft delete column

    If deleted_at is NOT null,
    company is considered deleted.
  */
  @Column({
    type: 'timestamptz',
    nullable: true,
  })
  deleted_at: Date;

  /*
    One company → many company members
  */
  @OneToMany(
    () => CompanyMember,
    (member) => member.company,
  )
  members: CompanyMember[];

  @OneToMany(
    ()=> QuestionBank,
    (qb)=>qb.company,
  )
  questionsBanks:QuestionBank[];
  @OneToMany(
  () => ApplicationComment,
  (comment) => comment.company,
)
applicationComments: ApplicationComment[];
}
