// src/db/entities/job-application.entity.ts

import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
  OneToMany
} from 'typeorm';

import { BaseEntity } from '../base.entity';
import { User } from './user.entity';
import { Company } from './company.entity';
import { JobListing } from './job-listing.entity';
import { Resume } from './resume.entity';
import { ApplicationStatus } from '../enums';
import { ApplicationComment } from './application-comment.entity';

/*
  Maps to job_applications table
*/
@Entity({ name: 'job_applications' })
@Index(['job', 'user'], { unique: true }) // Prevent duplicate applications
export class JobApplication extends BaseEntity {

  /*
    Many applications belong to one job
  */
  @ManyToOne(() => JobListing, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'job_id' })
  @Index()
  job: JobListing;

  /*
    Denormalized company_id

    Why?

    So we can filter applications by company
    without joining job_listings table every time.
  */
  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'company_id' })
  @Index()
  company: Company;

  /*
    Candidate user who applied
  */
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  @Index()
  user: User;

  /*
    Resume used in this application
  */
  @ManyToOne(() => Resume, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'resume_id' })
  resume: Resume;

  /*
    Snapshot of candidate answers

    Structure depends on job.screening_questions_json
  */
  @Column({
    type: 'jsonb',
    nullable: true,
  })
  answers_json: any;

  /*
    Optional video URL
  */
  @Column({
    type: 'text',
    nullable: true,
  })
  video_url: string;

  /*
    Application lifecycle status
  */
  @Column({
    type: 'enum',
    enum: ApplicationStatus,
    default: ApplicationStatus.APPLIED,
  })
  @Index()
  status: ApplicationStatus;

  /*
    Who changed the status (recruiter/admin)
  */
  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'status_changed_by' })
  status_changed_by: User;

  @OneToMany(
  () => ApplicationComment,
  (comment) => comment.job_application,
)
comments: ApplicationComment[];
}
