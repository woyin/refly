import { Controller, UseGuards, Get, Query } from '@nestjs/common';
import { CreditService } from './credit.service';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { LoginedUser } from '../../utils/decorators/user.decorator';
import {
  User,
  GetCreditRechargeResponse,
  GetCreditUsageResponse,
  GetCreditBalanceResponse,
  GetCreditUsageByResultIdResponse,
  GetCreditUsageByExecutionIdResponse,
} from '@refly/openapi-schema';
import { buildSuccessResponse } from '../../utils';

// Define pagination DTO
class PaginationDto {
  page?: string;
  pageSize?: string;
}

@Controller('v1/credit')
export class CreditController {
  constructor(private readonly creditService: CreditService) {}

  @UseGuards(JwtAuthGuard)
  @Get('/recharge')
  async getCreditRecharge(
    @LoginedUser() user: User,
    @Query() query: PaginationDto,
  ): Promise<GetCreditRechargeResponse> {
    const page = query.page ? Number.parseInt(query.page, 10) : 1;
    const pageSize = query.pageSize ? Number.parseInt(query.pageSize, 10) : 10;
    const recharge = await this.creditService.getCreditRecharge(user, { page, pageSize });
    return buildSuccessResponse(recharge);
  }

  @UseGuards(JwtAuthGuard)
  @Get('/usage')
  async getCreditUsage(
    @LoginedUser() user: User,
    @Query() query: PaginationDto,
  ): Promise<GetCreditUsageResponse> {
    const page = query.page ? Number.parseInt(query.page, 10) : 1;
    const pageSize = query.pageSize ? Number.parseInt(query.pageSize, 10) : 10;
    const usage = await this.creditService.getCreditUsage(user, { page, pageSize });
    return buildSuccessResponse(usage);
  }

  @UseGuards(JwtAuthGuard)
  @Get('/balance')
  async getCreditBalance(@LoginedUser() user: User): Promise<GetCreditBalanceResponse> {
    const balance = await this.creditService.getCreditBalance(user);
    return buildSuccessResponse(balance);
  }

  @UseGuards(JwtAuthGuard)
  @Get('/result')
  async getCreditUsageByResultId(
    @Query() query: { resultId: string },
  ): Promise<GetCreditUsageByResultIdResponse> {
    const { resultId } = query;
    const total = await this.creditService.countResultCreditUsage(resultId);
    return buildSuccessResponse({ total });
  }

  @UseGuards(JwtAuthGuard)
  @Get('/execution')
  async getCreditUsageByExecutionId(
    @Query() query: { executionId: string },
  ): Promise<GetCreditUsageByExecutionIdResponse> {
    const { executionId } = query;
    const total = await this.creditService.countExecutionCreditUsageByExecutionId(executionId);
    return buildSuccessResponse({ total });
  }
}
