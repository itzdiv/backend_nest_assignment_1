
import {
  Entity,
  Column,
  OneToOne,
  JoinColumn,
} from 'typeorm';

import { BaseEntity } from '../base.entity';
import { User } from './user.entity';

/*
  @Entity('candidate_profiles')

  Must match Supabase table name exactly.
*/
@Entity({ name: 'candidate_profiles' })
export class CandidateProfile extends BaseEntity {

  /*
    OneToOne relationship with User.

    IMPORTANT:
    In OneToOne, one side must own the relation.

    The owning side is the side that has the foreign key.

    In our SQL:
    candidate_profiles has user_id FK

    So CandidateProfile is the owning side.
  */
  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  /*
    full_name VARCHAR(255) NOT NULL
  */
  @Column({
    type: 'varchar',
    length: 255,
    nullable: false,
  })
  full_name: string;

  @Column({ type: 'text', nullable: true })
  bio: string;

  @Column({ type: 'text', nullable: true })
  photo_url: string;

  @Column({ type: 'text', nullable: true })
  linkedin_url: string;

  @Column({ type: 'text', nullable: true })
  portfolio_url: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  phone: string;
}
