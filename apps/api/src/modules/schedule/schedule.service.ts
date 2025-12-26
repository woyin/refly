import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateScheduleDto, UpdateScheduleDto } from './schedule.dto';
import { genScheduleId } from '@refly/utils';
import { CronExpressionParser } from 'cron-parser';

@Injectable()
export class ScheduleService {
  private readonly logger = new Logger(ScheduleService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createSchedule(uid: string, dto: CreateScheduleDto) {
    // 1. Validate Cron Expression
    try {
      CronExpressionParser.parse(dto.cronExpression);
    } catch {
      throw new BadRequestException('Invalid cron expression');
    }

    // 2. Check Plan Quota
    const activeSchedulesCount = await this.prisma.workflowSchedule.count({
      where: { uid, isEnabled: true, deletedAt: null },
    });

    // Check user subscription for quota (reserved for future plan-based limits)
    await this.prisma.subscription.findFirst({
      where: { uid, status: 'active' },
    });
    // Simplified quota check (future: fetch actual limit from plan)
    const maxSchedules = 10; // Default limit
    if (activeSchedulesCount >= maxSchedules) {
      throw new BadRequestException('Schedule quota exceeded');
    }

    // 3. Calculate next run time
    const interval = CronExpressionParser.parse(dto.cronExpression, {
      tz: dto.timezone || 'Asia/Shanghai',
    });
    const nextRunAt = interval.next().toDate();

    // 4. Create Schedule
    const scheduleId = genScheduleId();
    return this.prisma.workflowSchedule.create({
      data: {
        scheduleId,
        uid,
        canvasId: dto.canvasId,
        name: dto.name,
        cronExpression: dto.cronExpression,
        scheduleConfig: dto.scheduleConfig,
        timezone: dto.timezone,
        isEnabled: dto.isEnabled ?? false,
        nextRunAt: dto.isEnabled ? nextRunAt : null,
      },
    });
  }

  async updateSchedule(uid: string, scheduleId: string, dto: UpdateScheduleDto) {
    const schedule = await this.prisma.workflowSchedule.findUnique({
      where: { scheduleId },
    });

    if (!schedule || schedule.uid !== uid || schedule.deletedAt) {
      throw new NotFoundException('Schedule not found');
    }

    let nextRunAt = schedule.nextRunAt;
    if (dto.cronExpression || dto.isEnabled !== undefined) {
      const cron = dto.cronExpression || schedule.cronExpression;
      const timezone = dto.timezone || schedule.timezone;
      const isEnabled = dto.isEnabled !== undefined ? dto.isEnabled : schedule.isEnabled;

      if (isEnabled) {
        try {
          const interval = CronExpressionParser.parse(cron, { tz: timezone });
          nextRunAt = interval.next().toDate();
        } catch {
          throw new BadRequestException('Invalid cron expression');
        }
      } else {
        nextRunAt = null;
      }
    }

    return this.prisma.workflowSchedule.update({
      where: { scheduleId },
      data: {
        ...dto,
        nextRunAt,
      },
    });
  }

  async deleteSchedule(uid: string, scheduleId: string) {
    const schedule = await this.prisma.workflowSchedule.findUnique({
      where: { scheduleId },
    });

    if (!schedule || schedule.uid !== uid || schedule.deletedAt) {
      throw new NotFoundException('Schedule not found');
    }

    return this.prisma.workflowSchedule.update({
      where: { scheduleId },
      data: {
        deletedAt: new Date(),
        isEnabled: false,
        nextRunAt: null,
      },
    });
  }

  async getSchedule(uid: string, scheduleId: string) {
    const schedule = await this.prisma.workflowSchedule.findUnique({
      where: { scheduleId },
    });

    if (!schedule || schedule.uid !== uid || schedule.deletedAt) {
      throw new NotFoundException('Schedule not found');
    }

    return schedule;
  }

  async listSchedules(uid: string, canvasId?: string, page = 1, pageSize = 10) {
    const where = {
      uid,
      deletedAt: null,
      ...(canvasId ? { canvasId } : {}),
    };

    const [total, items] = await Promise.all([
      this.prisma.workflowSchedule.count({ where }),
      this.prisma.workflowSchedule.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return { total, page, pageSize, items };
  }

  async getScheduleRecords(uid: string, scheduleId: string, page = 1, pageSize = 10) {
    const where = {
      uid,
      scheduleId,
    };

    const [total, items] = await Promise.all([
      this.prisma.scheduleRecord.count({ where }),
      this.prisma.scheduleRecord.findMany({
        where,
        orderBy: { scheduledAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return { total, page, pageSize, items };
  }
}
