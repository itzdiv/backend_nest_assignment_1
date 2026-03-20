import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { paginate } from 'src/libs/pagination';
import { Notification, NotificationType } from './notification.entity';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
  ) {}

  async create(payload: {
    userId: string;
    type: NotificationType;
    message: string;
    applicationId?: string;
    jobTitle?: string;
    companyName?: string;
  }): Promise<void> {
    const notification = this.notificationRepository.create({
      user: { id: payload.userId } as any,
      type: payload.type,
      message: payload.message,
      application_id: payload.applicationId ?? null,
      job_title: payload.jobTitle ?? null,
      company_name: payload.companyName ?? null,
    });

    await this.notificationRepository.save(notification);
  }

  async findAllForUser(userId: string, page: number, limit: number): Promise<{
    data: Notification[];
    unreadCount: number;
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const [data, total, unreadCount] = await Promise.all([
      this.notificationRepository.find({
        where: { user: { id: userId } },
        order: { created_at: 'DESC' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.notificationRepository.count({
        where: { user: { id: userId } },
      }),
      this.notificationRepository.count({
        where: { user: { id: userId }, is_read: false },
      }),
    ]);

    const result = paginate(data, total, page, limit);

    return {
      data: result.data,
      unreadCount,
      meta: result.meta,
    };
  }

  async markAllAsRead(userId: string): Promise<void> {
    await this.notificationRepository.update(
      {
        user: { id: userId },
        is_read: false,
      },
      {
        is_read: true,
      },
    );
  }
}