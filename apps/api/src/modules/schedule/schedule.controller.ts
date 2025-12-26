import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { User } from '@refly/openapi-schema';
import { ScheduleService } from './schedule.service';
import {
  CreateScheduleDto,
  UpdateScheduleDto,
  ListSchedulesDto,
  GetScheduleRecordsDto,
} from './schedule.dto';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { LoginedUser } from '../../utils/decorators/user.decorator';

@Controller('v1/schedule')
@UseGuards(JwtAuthGuard)
export class ScheduleController {
  constructor(private readonly scheduleService: ScheduleService) {}

  @Post('create')
  async createSchedule(@LoginedUser() user: User, @Body() dto: CreateScheduleDto) {
    return this.scheduleService.createSchedule(user.uid, dto);
  }

  @Post('update')
  async updateSchedule(
    @LoginedUser() user: User,
    @Body() body: UpdateScheduleDto & { scheduleId: string },
  ) {
    const { scheduleId, ...dto } = body;
    return this.scheduleService.updateSchedule(user.uid, scheduleId, dto);
  }

  @Post('delete')
  async deleteSchedule(@LoginedUser() user: User, @Body() body: { scheduleId: string }) {
    return this.scheduleService.deleteSchedule(user.uid, body.scheduleId);
  }

  @Post('detail')
  async getSchedule(@LoginedUser() user: User, @Body() body: { scheduleId: string }) {
    return this.scheduleService.getSchedule(user.uid, body.scheduleId);
  }

  @Post('list')
  async listSchedules(@LoginedUser() user: User, @Body() dto: ListSchedulesDto) {
    return this.scheduleService.listSchedules(user.uid, dto.canvasId, dto.page, dto.pageSize);
  }

  @Post('records')
  async getScheduleRecords(@LoginedUser() user: User, @Body() dto: GetScheduleRecordsDto) {
    return this.scheduleService.getScheduleRecords(
      user.uid,
      dto.scheduleId,
      dto.page,
      dto.pageSize,
    );
  }
}
