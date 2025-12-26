import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { Subscription } from '@prisma/client';

const PLAN_PRIORITY_MAP: Record<string, number> = {
  enterprise: 1,
  team: 2,
  pro: 3,
  maker: 3,
  plus: 6,
  starter: 8,
  free: 10,
};

const ADJUSTMENT_FACTORS = {
  FAILURE_PENALTY: 1,
  LOW_CREDIT_PENALTY: 2,
  HIGH_LOAD_PENALTY: 1,
  EARLY_BIRD_BONUS: -1,
};

@Injectable()
export class SchedulePriorityService {
  private readonly logger = new Logger(SchedulePriorityService.name);

  constructor(private readonly prisma: PrismaService) {}

  async calculateExecutionPriority(uid: string): Promise<number> {
    // 1. Get user's current subscription
    const subscription = await this.prisma.subscription.findFirst({
      where: {
        uid,
        status: 'active',
        OR: [{ cancelAt: null }, { cancelAt: { gt: new Date() } }],
      },
      orderBy: { createdAt: 'desc' },
    });

    // 2. Get base priority from plan type
    const planType = subscription?.planType ?? 'free';
    const basePriority = PLAN_PRIORITY_MAP[planType] ?? PLAN_PRIORITY_MAP.free;

    // 3. Get priority adjustment factors
    const factors = await this.getPriorityFactors(uid, subscription);

    // 4. Apply priority adjustments
    const adjustedPriority = this.applyPriorityAdjustments(basePriority, factors);

    // 5. Ensure priority is within valid range (1-10)
    const finalPriority = Math.max(1, Math.min(10, adjustedPriority));

    this.logger.debug(
      `Priority calculated for user ${uid}: base=${basePriority}, adjusted=${finalPriority}, factors=${JSON.stringify(factors)}`,
    );

    return finalPriority;
  }

  private async getPriorityFactors(uid: string, _subscription: Subscription | null) {
    // 1. Check recent failures (last 5 records)
    const recentRecords = await this.prisma.scheduleRecord.findMany({
      where: { uid },
      orderBy: { scheduledAt: 'desc' },
      take: 5,
      select: { status: true },
    });

    // Count consecutive failures from the latest record
    let consecutiveFailures = 0;
    for (const record of recentRecords) {
      if (record.status === 'failed') {
        consecutiveFailures++;
      } else {
        break;
      }
    }

    // 2. Check active schedule count
    const activeScheduleCount = await this.prisma.workflowSchedule.count({
      where: { uid, isEnabled: true, deletedAt: null },
    });

    // 3. Check credit availability (simplified check)
    // In a real scenario, we'd compare remaining credits vs average consumption
    // Here we just check if they have a decent amount of credits relative to a "safe buffer"
    // Assuming 100 credits is a safe buffer for one execution
    // Note: CreditService interaction might be needed for precise balance
    // but we can do a quick check on CreditAccount if available, or skip for now.
    // For now, we will assume credit info needs to be fetched from CreditService
    // Since we don't have CreditService injected here yet (circular dependency risk),
    // we might rely on cached data or skip complex credit logic here.
    // Let's assume we skip precise credit ratio for this iteration to keep it simple.
    const lowCredits = false; // Placeholder

    // 4. Early bird (registered > 1 year ago? or specific flag?)
    // Let's assume early bird based on user creation date if we had user table access
    // Or maybe subscription created long ago.
    const isEarlyBird = false; // Placeholder

    return {
      consecutiveFailures,
      activeScheduleCount,
      lowCredits,
      isEarlyBird,
    };
  }

  private applyPriorityAdjustments(basePriority: number, factors: any): number {
    let priority = basePriority;

    // Penalty for consecutive failures
    if (factors.consecutiveFailures > 0) {
      // Max 3 penalty levels
      const penalty = Math.min(factors.consecutiveFailures, 3) * ADJUSTMENT_FACTORS.FAILURE_PENALTY;
      priority += penalty;
    }

    // Penalty for high load (many active schedules)
    if (factors.activeScheduleCount > 5) {
      priority += ADJUSTMENT_FACTORS.HIGH_LOAD_PENALTY;
    }

    // Penalty for low credits
    if (factors.lowCredits) {
      priority += ADJUSTMENT_FACTORS.LOW_CREDIT_PENALTY;
    }

    // Bonus for early bird
    if (factors.isEarlyBird) {
      priority += ADJUSTMENT_FACTORS.EARLY_BIRD_BONUS;
    }

    return Math.floor(priority);
  }
}
