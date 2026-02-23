// src/db/entities/application-comment.entity.ts

import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';

import { BaseEntity } from '../base.entity';
import { JobApplication } from './job-application.entity';
import { Company } from './company.entity';
import { User } from './user.entity';

/*
  Maps to application_comments table
*/
@Entity({ name: 'application_comments' })
export class ApplicationComment extends BaseEntity {

  /*
    Each comment belongs to one application
  */
  @ManyToOne(() => JobApplication, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'job_application_id' })
  @Index()
  job_application: JobApplication;

  /*
    Denormalized company reference
    So we can filter comments by company
    without joining job_applications
  */
  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'company_id' })
  @Index()
  company: Company;

  /*
    User who wrote the comment
    Must be company member
  */
  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  @Index()
  user: User;

  /*
    Comment text
  */
  @Column({
    type: 'text',
  })
  comment: string;

  /*
    Optional: visible_to_candidate flag

    If true → candidate can see it
    If false → internal only
  */
  @Column({
    type: 'boolean',
    default: false,
  })
  visible_to_candidate: boolean;
}
