export interface CreateScheduleDto {
  canvasId: string;
  name: string;
  cronExpression: string;
  scheduleConfig: string;
  timezone?: string;
  isEnabled?: boolean;
}

export interface UpdateScheduleDto {
  name?: string;
  cronExpression?: string;
  scheduleConfig?: string;
  timezone?: string;
  isEnabled?: boolean;
}

export interface ListSchedulesDto {
  canvasId?: string;
  page?: number;
  pageSize?: number;
}

export interface GetScheduleRecordsDto {
  scheduleId: string;
  page?: number;
  pageSize?: number;
}

export interface ListAllScheduleRecordsDto {
  page?: number;
  pageSize?: number;
  status?: 'scheduled' | 'pending' | 'running' | 'success' | 'failed';
  keyword?: string;
  tools?: string[];
}

export interface GetScheduleRecordDetailDto {
  scheduleRecordId: string;
}

export interface TriggerScheduleManuallyDto {
  scheduleId: string;
}

export interface RetryScheduleRecordDto {
  scheduleRecordId: string;
}
