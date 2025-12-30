import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import { WorkflowCompletedEvent, WorkflowFailedEvent } from '../workflow/workflow.events';
import { PrismaService } from '../common/prisma.service';
import { NotificationService } from '../notification/notification.service';
import {
  generateScheduleSuccessEmail,
  generateScheduleFailedEmail,
} from './schedule-email-templates';
import { classifyScheduleError, ScheduleFailureReason } from './schedule.constants';
import { CronExpressionParser } from 'cron-parser';

@Injectable()
export class ScheduleEventListener {
  private readonly logger = new Logger(ScheduleEventListener.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
    private readonly config: ConfigService,
  ) {}

  @OnEvent('workflow.completed')
  async handleWorkflowCompleted(event: WorkflowCompletedEvent) {
    if (!event.scheduleId) return;

    try {
      this.logger.log(
        `Processing workflow.completed event for schedule record ${event.scheduleId}`,
      );

      await this.prisma.workflowScheduleRecord.update({
        where: { scheduleRecordId: event.scheduleId },
        data: {
          status: 'success',
          completedAt: new Date(),
        },
      });

      await this.sendEmail(event, 'success');
    } catch (error: any) {
      this.logger.error(`Failed to process workflow.completed event: ${error.message}`);
    }
  }

  @OnEvent('workflow.failed')
  async handleWorkflowFailed(event: WorkflowFailedEvent) {
    if (!event.scheduleId) return;

    try {
      this.logger.log(`Processing workflow.failed event for schedule record ${event.scheduleId}`);

      const errorDetails = event.error;
      let failureReason: string = ScheduleFailureReason.WORKFLOW_EXECUTION_FAILED;
      if (errorDetails?.errorMessage) {
        failureReason = classifyScheduleError(errorDetails.errorMessage);
      }

      await this.prisma.workflowScheduleRecord.update({
        where: { scheduleRecordId: event.scheduleId },
        data: {
          status: 'failed',
          completedAt: new Date(),
          failureReason,
          errorDetails: JSON.stringify(errorDetails),
        },
      });

      await this.sendEmail(event, 'failed');
    } catch (error: any) {
      this.logger.error(`Failed to process workflow.failed event: ${error.message}`);
    }
  }

  private async sendEmail(
    event: WorkflowCompletedEvent | WorkflowFailedEvent,
    status: 'success' | 'failed',
  ) {
    const fullUser = await this.prisma.user.findUnique({ where: { uid: event.userId } });
    if (!fullUser || !fullUser.email) return;

    const scheduleRecord = await this.prisma.workflowScheduleRecord.findUnique({
      where: { scheduleRecordId: event.scheduleId },
    });
    // Fallback to schedule name or Generic
    const scheduleName = scheduleRecord?.workflowTitle || 'Scheduled Workflow';

    let nextRunTime = 'Check Dashboard';
    if (scheduleRecord?.scheduleId) {
      const schedule = await this.prisma.workflowSchedule.findUnique({
        where: { scheduleId: scheduleRecord.scheduleId },
      });

      if (schedule?.cronExpression) {
        try {
          const interval = CronExpressionParser.parse(schedule.cronExpression, {
            tz: schedule.timezone || 'Asia/Shanghai',
          });
          nextRunTime = interval.next().toDate().toLocaleString();
        } catch (err) {
          this.logger.warn(
            `Failed to calculate next run time for schedule ${schedule.scheduleId}: ${err.message}`,
          );
        }
      }
    }

    if (status === 'success') {
      // Get the execution canvas ID for the run-history link
      const executionCanvasId = scheduleRecord?.canvasId || '';
      const origin = this.config.get<string>('origin');

      const { subject, html } = generateScheduleSuccessEmail({
        userName: fullUser.nickname || 'User',
        scheduleName: scheduleName,
        runTime: new Date().toLocaleString(),
        nextRunTime: nextRunTime,
        schedulesLink: `${origin}/run-history/${executionCanvasId}`,
        runDetailsLink: `${origin}/run-history/${executionCanvasId}`,
      });
      await this.notificationService.sendEmail(
        {
          to: fullUser.email,
          subject,
          html,
        },
        fullUser,
      );
    } else {
      // Get the execution canvas ID for the run-history link
      const executionCanvasId = scheduleRecord?.canvasId || '';
      const origin = this.config.get<string>('origin');

      const { subject, html } = generateScheduleFailedEmail({
        userName: fullUser.nickname || 'User',
        scheduleName: scheduleName,
        runTime: new Date().toLocaleString(),
        nextRunTime: nextRunTime,
        schedulesLink: `${origin}/run-history/${executionCanvasId}`,
        runDetailsLink: `${origin}/run-history/${executionCanvasId}`,
      });
      await this.notificationService.sendEmail(
        {
          to: fullUser.email,
          subject,
          html,
        },
        fullUser,
      );
    }
  }
}
