import { Controller, Get, Patch, Query, UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from 'src/api/guards/jwt-auth.guard';
import { CurrentUser } from 'src/api/decorators/current-user.decorator';
import { PaginationSchema, type PaginationDto } from 'src/zod/pagination.zod';
import { ZodValidationPipe } from 'src/api/pipes/zod-validation.pipe';

@UseGuards(JwtAuthGuard)
@Controller('v1/notifications')
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
  ) {}

  @Get()
  async findAll(
    @CurrentUser() user: { id: string },
    @Query(new ZodValidationPipe(PaginationSchema)) query: PaginationDto,
  ) {
    return this.notificationsService.findAllForUser(
      user.id,
      query.page,
      query.limit,
    );
  }

  @Patch('read-all')
  async markAllAsRead(@CurrentUser() user: { id: string }) {
    await this.notificationsService.markAllAsRead(user.id);

    return { message: 'All notifications marked as read' };
  }
}