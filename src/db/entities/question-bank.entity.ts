import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';

import { BaseEntity } from '../base.entity';
import { Company } from './company.entity';
import { User } from './user.entity';

/*
  Maps to question_banks table
*/
@Entity({ name: 'question_banks' })
export class QuestionBank extends BaseEntity {

  /*
    Each question bank belongs to one company
  */
  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'company_id' })
  @Index()
  company: Company;

  /*
    Track who created this question bank
  */
  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by' })
  created_by: User;

  /*
    Name of question bank
    Example: "Backend Screening v1"
  */
  @Column({
    type: 'varchar',
    length: 255,
  })
  name: string;

  /*
    JSONB column for storing array of question objects

    This allows dynamic structure
  */
  @Column({
    type: 'jsonb',
  })
  questions_json: any;
}
