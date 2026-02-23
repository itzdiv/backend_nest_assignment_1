// src/db/entities/resume.entity.ts

import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';

import { BaseEntity } from '../base.entity';
import { User } from './user.entity';

/*
  resumes table
*/
@Entity({ name: 'resumes' })
export class Resume extends BaseEntity {

  /*
    Many resumes belong to ONE user.

    So this is ManyToOne.
  */
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  @Index() // heavily filtered field
  user: User;

  /*
    title VARCHAR(255)
  */
  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  title: string;

  /*
    file_url TEXT NOT NULL
  */
  @Column({
    type: 'text',
    nullable: false,
  })
  file_url: string;

  /*
    is_primary BOOLEAN DEFAULT false
  */
  @Column({
    type: 'boolean',
    default: false,
  })
  is_primary: boolean;
}
