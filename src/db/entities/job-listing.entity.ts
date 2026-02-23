// src/db/entities/job-listing.entity.ts

import {
  Entity,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';

import { BaseEntity } from '../base.entity';
import { Company } from './company.entity';
import { User } from './user.entity';
import { JobStatus, JobVisibility, ApplicationMode } from '../enums';

/*
  Maps to job_listings table
*/
@Entity({ name: 'job_listings' })
export class JobListing extends BaseEntity {

  /*
    Every job belongs to a company
  */
  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'company_id' })
  @Index()
  company: Company;

  /*
    Track who created the job
  */
  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by' })
  created_by: User;

  /*
    Job title
  */
  @Column({
    type: 'varchar',
    length: 255,
  })
  title: string;

  /*
    Detailed job description
  */
  @Column({
    type: 'text',
  })
  description: string;

  /*
    Requirements section
  */
  @Column({
    type: 'text',
    nullable: true,
  })
  requirements: string;

  /*
    Salary range stored as string
    Example: "6-12 LPA"
  */
  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  salary_range: string;

  /*
    Location (Remote / Delhi / Bangalore etc.)
  */
  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  location: string;

  /*
    Employment type
    Example: FULL_TIME / INTERN / CONTRACT
  */
  @Column({
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  employment_type: string;

  /*
    How candidate applies
  */
  @Column({
    type: 'enum',
    enum: ApplicationMode,
    default: ApplicationMode.STANDARD,
  })
  application_mode: ApplicationMode;

  /*
    Public or Private listing
  */
  @Column({
    type: 'enum',
    enum: JobVisibility,
    default: JobVisibility.PUBLIC,
  })
  @Index()
  visibility: JobVisibility;

  /*
    Job lifecycle status
  */
  @Column({
    type: 'enum',
    enum: JobStatus,
    default: JobStatus.DRAFT,
  })
  @Index()
  status: JobStatus;

  /*
    Deadline for applications
  */
  @Column({
    type: 'timestamptz',
    nullable: true,
  })
  application_deadline: Date;

  /*
    Snapshot of screening questions

    IMPORTANT:
    This is copied from question bank
    at job creation time.
  */
  @Column({
    type: 'jsonb',
    nullable: true,
  })
  screening_questions_json: any;

  /*
    Soft delete column
  */
  @Column({
    type: 'timestamptz',
    nullable: true,
  })
  deleted_at: Date;
}
