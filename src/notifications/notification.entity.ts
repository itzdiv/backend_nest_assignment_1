import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { BaseEntity } from 'src/db/base.entity';
import { User } from 'src/db/entities/user.entity';

export enum NotificationType {
  APPLICATION_ACCEPTED = 'APPLICATION_ACCEPTED',
  APPLICATION_REJECTED = 'APPLICATION_REJECTED',
  APPLICATION_COMMENT = 'APPLICATION_COMMENT',
}

@Entity({ name: 'notifications' })
export class Notification extends BaseEntity {
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  @Index()
  user: User;

  @Column({
    type: 'enum',
    enum: NotificationType,
    enumName: 'notification_type_enum',
  })
  type: NotificationType;

  @Column({
    type: 'text',
    nullable: false,
  })
  message: string;

  @Column({
    type: 'uuid',
    nullable: true,
    name: 'application_id',
  })
  application_id: string | null;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
    name: 'job_title',
  })
  job_title: string | null;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
    name: 'company_name',
  })
  company_name: string | null;

  @Column({
    type: 'boolean',
    default: false,
    name: 'is_read',
  })
  @Index()
  is_read: boolean;
}