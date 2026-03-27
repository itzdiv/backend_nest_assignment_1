import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../base.entity';
import { User } from './user.entity';

@Entity({ name: 'resumes' })
export class Resume extends BaseEntity {
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  @Index()
  user: User;

  @Column({ type: 'varchar', length: 255, nullable: true })
  title: string;

  // Internal path in Supabase Storage bucket (e.g. "user-uuid/file-uuid.pdf")
  @Column({ type: 'text', nullable: false })
  storage_key: string;

  @Column({ type: 'varchar', length: 255, nullable: false })
  original_filename: string;

  @Column({ type: 'varchar', length: 100, nullable: false })
  mime_type: string;

  @Column({ type: 'int', nullable: false })
  file_size_bytes: number;

  @Column({ type: 'boolean', default: false })
  is_primary: boolean;
}
