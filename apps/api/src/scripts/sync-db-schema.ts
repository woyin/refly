import { migrateDbSchema } from '../utils/prisma';

if (require.main === module) {
  console.log('Migrating DB schema...');

  migrateDbSchema().then(() => {
    console.log('DB schema migrated!');
    process.exit(0);
  });
}
