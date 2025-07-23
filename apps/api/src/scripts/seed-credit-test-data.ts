import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from '../modules/app.module';
import { PrismaService } from '../modules/common/prisma.service';
import { genCreditRechargeId, genCreditUsageId } from '@refly/utils';
import { faker } from '@faker-js/faker';

/**
 * Credit System Test Data Seeder
 *
 * This script generates production-level test data for the credit system.
 * It creates realistic scenarios including:
 * - Multiple users with different credit histories
 * - Various recharge sources and amounts
 * - Diverse usage patterns across different services
 * - Expired and active credit records
 * - Edge cases for testing
 *
 * Usage:
 * cd apps/api
 * npx ts-node -r tsconfig-paths/register src/scripts/seed-credit-test-data.ts
 */

interface TestUser {
  uid: string;
  name: string;
  email: string;
  scenario: string;
}

interface CreditRechargeData {
  rechargeId: string;
  uid: string;
  amount: number;
  balance: number;
  enabled: boolean;
  source: 'purchase' | 'gift' | 'promotion' | 'refund';
  description: string;
  expiresAt: Date;
  createdAt: Date;
}

interface CreditUsageData {
  usageId: string;
  uid: string;
  amount: number;
  providerItemId?: string;
  modelName?: string;
  usageType: 'model_call' | 'media_generation' | 'embedding' | 'reranking' | 'other';
  actionResultId?: string;
  pilotSessionId?: string;
  description?: string;
  createdAt: Date;
}

class CreditTestDataSeeder {
  private readonly logger = new Logger('CreditTestDataSeeder');
  private prisma: PrismaService;

  // Test users with different scenarios
  private readonly testUsers: TestUser[] = [
    {
      uid: 'u-credit-test-001',
      name: 'alice-heavy-user',
      email: 'alice@credittest.refly.ai',
      scenario: 'Heavy user with multiple recharges and high usage',
    },
    {
      uid: 'u-credit-test-002',
      name: 'bob-new-user',
      email: 'bob@credittest.refly.ai',
      scenario: 'New user with first recharge and minimal usage',
    },
    {
      uid: 'u-credit-test-003',
      name: 'charlie-expired',
      email: 'charlie@credittest.refly.ai',
      scenario: 'User with expired credits and mixed usage',
    },
    {
      uid: 'u-credit-test-004',
      name: 'diana-enterprise',
      email: 'diana@credittest.refly.ai',
      scenario: 'Enterprise user with large recharges and diverse usage',
    },
    {
      uid: 'u-credit-test-005',
      name: 'eve-trial',
      email: 'eve@credittest.refly.ai',
      scenario: 'Trial user with promotional credits',
    },
    {
      uid: 'u-credit-test-zero',
      name: 'zero-balance-user',
      email: 'zero@credittest.refly.ai',
      scenario: 'User with depleted credits',
    },
  ];

  // Realistic model names for testing
  private readonly modelNames = [
    'gpt-4o',
    'gpt-4o-mini',
    'claude-3-5-sonnet',
    'claude-3-haiku',
    'gemini-1.5-pro',
    'gemini-1.5-flash',
    'llama-3.1-70b',
    'dall-e-3',
    'midjourney-v6',
    'stable-diffusion-xl',
  ];

  // Usage type distributions for realistic patterns
  private readonly usageTypeWeights = {
    model_call: 0.65, // 65% of usage
    media_generation: 0.2, // 20% of usage
    embedding: 0.1, // 10% of usage
    reranking: 0.04, // 4% of usage
    other: 0.01, // 1% of usage
  };

  constructor(prisma: PrismaService) {
    this.prisma = prisma;
    // Set deterministic seed for reproducible test data
    faker.seed(2025);
  }

  // Helper function to create future dates
  private getFutureDate(days: number): Date {
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  }

  // Helper function to create past dates
  private getPastDate(days: number): Date {
    return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  }

  // Helper function to create recent dates (within specified days range)
  private getRecentDate(days: number): Date {
    const randomDays = Math.floor(Math.random() * days);
    return new Date(Date.now() - randomDays * 24 * 60 * 60 * 1000);
  }

  async seed(): Promise<void> {
    this.logger.log('🚀 Starting credit system test data seeding...');

    // Clean existing test data
    await this.cleanExistingTestData();

    // Create test users
    await this.createTestUsers();

    // Generate credit data for each user
    for (const user of this.testUsers) {
      await this.generateUserCreditData(user);
    }

    // Generate some edge cases
    await this.generateEdgeCases();

    this.logger.log('✅ Credit system test data seeding completed successfully!');
    await this.printSummary();
  }

  private async cleanExistingTestData(): Promise<void> {
    this.logger.log('🧹 Cleaning existing test data...');

    // Delete test credit data
    await this.prisma.creditUsage.deleteMany({
      where: {
        uid: {
          in: this.testUsers.map((u) => u.uid),
        },
      },
    });

    await this.prisma.creditRecharge.deleteMany({
      where: {
        uid: {
          in: this.testUsers.map((u) => u.uid),
        },
      },
    });

    // Delete test accounts
    await this.prisma.account.deleteMany({
      where: {
        uid: {
          in: this.testUsers.map((u) => u.uid),
        },
      },
    });

    // Delete test users
    await this.prisma.user.deleteMany({
      where: {
        uid: {
          in: this.testUsers.map((u) => u.uid),
        },
      },
    });

    this.logger.log('✅ Test data cleanup completed');
  }

  private async createTestUsers(): Promise<void> {
    this.logger.log('👥 Creating test users...');

    // Import argon2 for password hashing
    const argon2 = require('argon2');
    const hashedPassword = await argon2.hash('testPassword123');

    for (const userData of this.testUsers) {
      await this.prisma.user.create({
        data: {
          uid: userData.uid,
          name: userData.name,
          email: userData.email,
          password: hashedPassword, // Add password field
          nickname: userData.name,
          emailVerified: new Date(),
          hasBetaAccess: true,
          preferences: JSON.stringify({ testScenario: userData.scenario }),
          createdAt: this.getPastDate(365), // 1 year ago
        },
      });

      // Also create an account record for email authentication
      await this.prisma.account.create({
        data: {
          type: 'email',
          uid: userData.uid,
          provider: 'email',
          providerAccountId: userData.email,
        },
      });
    }

    this.logger.log(
      `✅ Created ${this.testUsers.length} test users with password: testPassword123`,
    );
  }

  private async generateUserCreditData(user: TestUser): Promise<void> {
    this.logger.log(`💳 Generating credit data for ${user.name}...`);

    switch (user.uid) {
      case 'u-credit-test-001': // Heavy user
        await this.generateHeavyUserData(user);
        break;
      case 'u-credit-test-002': // New user
        await this.generateNewUserData(user);
        break;
      case 'u-credit-test-003': // Expired credits
        await this.generateExpiredCreditsData(user);
        break;
      case 'u-credit-test-004': // Enterprise user
        await this.generateEnterpriseUserData(user);
        break;
      case 'u-credit-test-005': // Trial user
        await this.generateTrialUserData(user);
        break;
      case 'u-credit-test-zero': // Zero balance user
        await this.generateZeroBalanceUserData(user);
        break;
    }
  }

  private async generateHeavyUserData(user: TestUser): Promise<void> {
    const recharges: CreditRechargeData[] = [
      // Recent large purchase
      {
        rechargeId: genCreditRechargeId(),
        uid: user.uid,
        amount: 50000,
        balance: 15000,
        enabled: true,
        source: 'purchase',
        description: 'Monthly subscription renewal',
        expiresAt: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), // 15 days from now
        createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
      },
      // Previous purchase (partially used)
      {
        rechargeId: genCreditRechargeId(),
        uid: user.uid,
        amount: 30000,
        balance: 5000,
        enabled: true,
        source: 'purchase',
        description: 'Top-up purchase',
        expiresAt: this.getFutureDate(25),
        createdAt: this.getRecentDate(15),
      },
      // Promotional bonus
      {
        rechargeId: genCreditRechargeId(),
        uid: user.uid,
        amount: 10000,
        balance: 2000,
        enabled: true,
        source: 'promotion',
        description: 'Holiday bonus credits',
        expiresAt: this.getFutureDate(10),
        createdAt: this.getRecentDate(20),
      },
    ];

    await this.createCreditRecharges(recharges);

    // Generate high usage patterns
    const usageCount = faker.number.int({ min: 150, max: 300 });
    await this.generateUsageRecords(user.uid, usageCount, 30); // Last 30 days
  }

  private async generateNewUserData(user: TestUser): Promise<void> {
    const recharges: CreditRechargeData[] = [
      // First purchase
      {
        rechargeId: genCreditRechargeId(),
        uid: user.uid,
        amount: 10000,
        balance: 8500,
        enabled: true,
        source: 'purchase',
        description: 'First purchase - Welcome package',
        expiresAt: this.getFutureDate(28),
        createdAt: this.getRecentDate(2),
      },
    ];

    await this.createCreditRecharges(recharges);

    // Light usage for new user
    const usageCount = faker.number.int({ min: 5, max: 15 });
    await this.generateUsageRecords(user.uid, usageCount, 3); // Last 3 days
  }

  private async generateExpiredCreditsData(user: TestUser): Promise<void> {
    const recharges: CreditRechargeData[] = [
      // Expired credit (should show in history but not count toward balance)
      {
        rechargeId: genCreditRechargeId(),
        uid: user.uid,
        amount: 20000,
        balance: 5000, // Remaining balance but expired
        enabled: false,
        source: 'purchase',
        description: 'Expired bulk purchase',
        expiresAt: this.getPastDate(5),
        createdAt: this.getPastDate(35),
      },
      // Recent small purchase
      {
        rechargeId: genCreditRechargeId(),
        uid: user.uid,
        amount: 5000,
        balance: 3000,
        enabled: true,
        source: 'purchase',
        description: 'Emergency top-up',
        expiresAt: this.getFutureDate(20),
        createdAt: this.getRecentDate(3),
      },
    ];

    await this.createCreditRecharges(recharges);

    // Mixed usage across time periods
    const usageCount = faker.number.int({ min: 50, max: 100 });
    await this.generateUsageRecords(user.uid, usageCount, 40);
  }

  private async generateEnterpriseUserData(user: TestUser): Promise<void> {
    const recharges: CreditRechargeData[] = [
      // Large enterprise purchase
      {
        rechargeId: genCreditRechargeId(),
        uid: user.uid,
        amount: 200000,
        balance: 120000,
        enabled: true,
        source: 'purchase',
        description: 'Enterprise annual plan',
        expiresAt: this.getFutureDate(20),
        createdAt: this.getRecentDate(10),
      },
      // Bonus credits from contract
      {
        rechargeId: genCreditRechargeId(),
        uid: user.uid,
        amount: 50000,
        balance: 35000,
        enabled: true,
        source: 'gift',
        description: 'Enterprise contract bonus',
        expiresAt: this.getFutureDate(25),
        createdAt: this.getRecentDate(12),
      },
    ];

    await this.createCreditRecharges(recharges);

    // High volume, diverse usage
    const usageCount = faker.number.int({ min: 400, max: 800 });
    await this.generateUsageRecords(user.uid, usageCount, 30, true); // Include all usage types
  }

  private async generateTrialUserData(user: TestUser): Promise<void> {
    const recharges: CreditRechargeData[] = [
      // Trial credits
      {
        rechargeId: genCreditRechargeId(),
        uid: user.uid,
        amount: 5000,
        balance: 4200,
        enabled: true,
        source: 'promotion',
        description: 'Free trial credits',
        expiresAt: this.getFutureDate(12), // Expires soon
        createdAt: this.getRecentDate(3),
      },
    ];

    await this.createCreditRecharges(recharges);

    // Minimal exploration usage
    const usageCount = faker.number.int({ min: 3, max: 8 });
    await this.generateUsageRecords(user.uid, usageCount, 3);
  }

  private async generateZeroBalanceUserData(user: TestUser): Promise<void> {
    // Fully depleted credit
    await this.createCreditRecharges([
      {
        rechargeId: genCreditRechargeId(),
        uid: user.uid,
        amount: 10000,
        balance: 0, // Fully used
        enabled: true,
        source: 'purchase',
        description: 'Fully depleted purchase',
        expiresAt: this.getFutureDate(15),
        createdAt: this.getPastDate(30),
      },
    ]);

    // Large usage that consumed all credits
    await this.generateUsageRecords(user.uid, 50, 5);
  }

  private async generateEdgeCases(): Promise<void> {
    this.logger.log('🔧 Generating additional edge cases...');
    // Additional edge cases can be added here if needed
    this.logger.log('✅ Edge cases generated');
  }

  private async generateUsageRecords(
    uid: string,
    count: number,
    dayRange: number,
    includeAllTypes = false,
  ): Promise<void> {
    const usageRecords: CreditUsageData[] = [];

    for (let i = 0; i < count; i++) {
      const usageType = this.getRandomUsageType(includeAllTypes);
      const modelName = this.getRandomModelName(usageType);
      const amount = this.getRealisticUsageAmount(usageType);

      usageRecords.push({
        usageId: genCreditUsageId(),
        uid,
        amount,
        modelName,
        usageType,
        providerItemId: faker.string.alphanumeric({ length: 12 }),
        actionResultId: faker.datatype.boolean()
          ? `ar-${faker.string.alphanumeric(10)}`
          : undefined,
        pilotSessionId: faker.datatype.boolean()
          ? `ps-${faker.string.alphanumeric(10)}`
          : undefined,
        description: this.getUsageDescription(usageType, modelName),
        createdAt: this.getRecentDate(dayRange),
      });
    }

    await this.createCreditUsage(usageRecords);
  }

  private getRandomUsageType(
    includeAllTypes: boolean,
  ): 'model_call' | 'media_generation' | 'embedding' | 'reranking' | 'other' {
    if (!includeAllTypes) {
      // Simplified distribution for basic users
      return faker.helpers.weightedArrayElement([
        { weight: 70, value: 'model_call' },
        { weight: 25, value: 'media_generation' },
        { weight: 5, value: 'embedding' },
      ]);
    }

    // Full distribution for enterprise users
    return faker.helpers.weightedArrayElement([
      { weight: 65, value: 'model_call' },
      { weight: 20, value: 'media_generation' },
      { weight: 10, value: 'embedding' },
      { weight: 4, value: 'reranking' },
      { weight: 1, value: 'other' },
    ]);
  }

  private getRandomModelName(usageType: string): string {
    const textModels = [
      'gpt-4o',
      'gpt-4o-mini',
      'claude-3-5-sonnet',
      'claude-3-haiku',
      'gemini-1.5-pro',
      'llama-3.1-70b',
    ];
    const imageModels = ['dall-e-3', 'midjourney-v6', 'stable-diffusion-xl'];
    const embeddingModels = ['text-embedding-3-large', 'text-embedding-ada-002'];

    switch (usageType) {
      case 'media_generation':
        return faker.helpers.arrayElement(imageModels);
      case 'embedding':
      case 'reranking':
        return faker.helpers.arrayElement(embeddingModels);
      default:
        return faker.helpers.arrayElement(textModels);
    }
  }

  private getRealisticUsageAmount(usageType: string): number {
    switch (usageType) {
      case 'model_call':
        // 1-50 credits per call (varying by model complexity)
        return faker.number.int({ min: 1, max: 50 });
      case 'media_generation':
        // 100-500 credits per image
        return faker.number.int({ min: 100, max: 500 });
      case 'embedding':
        // 5-20 credits per embedding
        return faker.number.int({ min: 5, max: 20 });
      case 'reranking':
        // 2-10 credits per rerank
        return faker.number.int({ min: 2, max: 10 });
      case 'other':
        // Variable for other services
        return faker.number.int({ min: 1, max: 100 });
      default:
        return faker.number.int({ min: 1, max: 30 });
    }
  }

  private getUsageDescription(usageType: string, modelName?: string): string {
    const descriptions = {
      model_call: [
        `AI chat conversation using ${modelName}`,
        `Document analysis with ${modelName}`,
        `Code generation using ${modelName}`,
        `Translation task with ${modelName}`,
      ],
      media_generation: [
        `Image generation using ${modelName}`,
        `Creative artwork with ${modelName}`,
        `Logo design using ${modelName}`,
        `Illustration creation with ${modelName}`,
      ],
      embedding: [
        'Document vectorization',
        'Semantic search indexing',
        'Knowledge base embedding',
        'Content similarity analysis',
      ],
      reranking: [
        'Search result optimization',
        'Content relevance ranking',
        'Query result reordering',
      ],
      other: ['Custom service usage', 'API call processing', 'Batch operation'],
    };

    return faker.helpers.arrayElement(descriptions[usageType] || descriptions.other);
  }

  private async createCreditRecharges(recharges: CreditRechargeData[]): Promise<void> {
    await this.prisma.creditRecharge.createMany({
      data: recharges,
    });
  }

  private async createCreditUsage(usageRecords: CreditUsageData[]): Promise<void> {
    await this.prisma.creditUsage.createMany({
      data: usageRecords,
    });
  }

  private async printSummary(): Promise<void> {
    this.logger.log('\n📊 === CREDIT SYSTEM TEST DATA SUMMARY ===');

    for (const user of this.testUsers) {
      const rechargeCount = await this.prisma.creditRecharge.count({
        where: { uid: user.uid },
      });

      const usageCount = await this.prisma.creditUsage.count({
        where: { uid: user.uid },
      });

      const totalRecharged = await this.prisma.creditRecharge.aggregate({
        where: { uid: user.uid },
        _sum: { amount: true },
      });

      const totalUsed = await this.prisma.creditUsage.aggregate({
        where: { uid: user.uid },
        _sum: { amount: true },
      });

      const currentBalance = await this.prisma.creditRecharge.aggregate({
        where: {
          uid: user.uid,
          enabled: true,
          expiresAt: { gt: new Date() },
        },
        _sum: { balance: true },
      });

      this.logger.log(`\n👤 ${user.name} (${user.uid})`);
      this.logger.log(`   Scenario: ${user.scenario}`);
      this.logger.log(`   Recharge Records: ${rechargeCount}`);
      this.logger.log(`   Usage Records: ${usageCount}`);
      this.logger.log(`   Total Recharged: ${totalRecharged._sum.amount || 0} credits`);
      this.logger.log(`   Total Used: ${totalUsed._sum.amount || 0} credits`);
      this.logger.log(`   Current Balance: ${currentBalance._sum.balance || 0} credits`);
    }

    // Overall statistics
    const totalUsers = await this.prisma.user.count({
      where: {
        uid: { in: [...this.testUsers.map((u) => u.uid), 'u-credit-test-zero'] },
      },
    });

    const totalRecharges = await this.prisma.creditRecharge.count({
      where: {
        uid: { in: [...this.testUsers.map((u) => u.uid), 'u-credit-test-zero'] },
      },
    });

    const totalUsages = await this.prisma.creditUsage.count({
      where: {
        uid: { in: [...this.testUsers.map((u) => u.uid), 'u-credit-test-zero'] },
      },
    });

    this.logger.log('\n🎯 OVERALL STATISTICS:');
    this.logger.log(`   Test Users Created: ${totalUsers}`);
    this.logger.log(`   Credit Recharge Records: ${totalRecharges}`);
    this.logger.log(`   Credit Usage Records: ${totalUsages}`);
    this.logger.log('\n🔗 Test the credit system at: http://localhost:5173/credit-test');
    this.logger.log('\n💡 Use any of the test users above to login and explore the credit system!');
  }
}

async function bootstrap() {
  const logger = new Logger('CreditTestDataSeeder');

  try {
    const app = await NestFactory.createApplicationContext(AppModule);
    const prisma = app.get(PrismaService);

    const seeder = new CreditTestDataSeeder(prisma);
    await seeder.seed();

    await app.close();
  } catch (error) {
    logger.error(`❌ Seeding failed: ${error.message}`);
    logger.error(error.stack);
    process.exit(1);
  }
}

// Run the seeder if this file is executed directly
if (require.main === module) {
  bootstrap();
}
