import 'dotenv/config';
import { pool } from '../src/config/database';

async function migrateAndSeedSLA() {
  const client = await pool.connect();
  try {
    console.log('--- Starting SLA Migration ---');
    await client.query('BEGIN');

    // 1. Create sla_policies table
    await client.query(`
      CREATE TABLE IF NOT EXISTS "sla_policies" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "name" varchar(120) NOT NULL,
        "priority" "ticket_priority" NOT NULL,
        "response_time_minutes" integer NOT NULL,
        "resolution_time_minutes" integer NOT NULL,
        "is_active" boolean DEFAULT true NOT NULL,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
        CONSTRAINT "sla_policies_priority_unique" UNIQUE("priority")
      );
    `);
    console.log('✓ sla_policies table ensured');

    // 2. Add SLA columns to tickets table
    await client.query(`
      ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "first_response_due_at" timestamp with time zone;
      ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "first_responded_at" timestamp with time zone;
      ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "resolution_due_at" timestamp with time zone;
      ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "sla_breached" boolean DEFAULT false NOT NULL;
      ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "sla_breached_at" timestamp with time zone;
    `);
    console.log('✓ tickets table SLA columns added');

    // 3. Create indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS "tickets_resolution_due_at_idx" ON "tickets" ("resolution_due_at");
      CREATE INDEX IF NOT EXISTS "tickets_sla_breached_idx" ON "tickets" ("sla_breached");
    `);
    console.log('✓ tickets SLA indexes created');

    // 4. Seed standard SLA policies
    const policies = [
      {
        name: 'Urgent Priority SLA',
        priority: 'urgent',
        responseTimeMinutes: 30, // 30 mins
        resolutionTimeMinutes: 240, // 4 hours
      },
      {
        name: 'High Priority SLA',
        priority: 'high',
        responseTimeMinutes: 120, // 2 hours
        resolutionTimeMinutes: 480, // 8 hours
      },
      {
        name: 'Medium Priority SLA',
        priority: 'medium',
        responseTimeMinutes: 240, // 4 hours
        resolutionTimeMinutes: 1440, // 24 hours (1 day)
      },
      {
        name: 'Low Priority SLA',
        priority: 'low',
        responseTimeMinutes: 480, // 8 hours
        resolutionTimeMinutes: 2880, // 48 hours (2 days)
      },
    ];

    for (const p of policies) {
      await client.query(
        `
        INSERT INTO "sla_policies" ("name", "priority", "response_time_minutes", "resolution_time_minutes", "is_active")
        VALUES ($1, $2, $3, $4, true)
        ON CONFLICT ("priority") DO UPDATE SET
          "name" = EXCLUDED."name",
          "response_time_minutes" = EXCLUDED."response_time_minutes",
          "resolution_time_minutes" = EXCLUDED."resolution_time_minutes",
          "updated_at" = NOW();
      `,
        [p.name, p.priority, p.responseTimeMinutes, p.resolutionTimeMinutes]
      );
    }
    console.log('✓ SLA default policies seeded for urgent, high, medium, low');

    // 5. Backfill existing tickets that don't have resolution_due_at
    await client.query(`
      UPDATE "tickets" t
      SET
        "first_response_due_at" = t."created_at" + (p."response_time_minutes" * INTERVAL '1 minute'),
        "resolution_due_at" = t."created_at" + (p."resolution_time_minutes" * INTERVAL '1 minute'),
        "sla_breached" = CASE
          WHEN t."status" IN ('resolved', 'closed') AND t."resolved_at" IS NOT NULL THEN
            (t."resolved_at" > (t."created_at" + (p."resolution_time_minutes" * INTERVAL '1 minute')))
          WHEN t."status" NOT IN ('resolved', 'closed') THEN
            (NOW() > (t."created_at" + (p."resolution_time_minutes" * INTERVAL '1 minute')))
          ELSE false
        END
      FROM "sla_policies" p
      WHERE t."priority" = p."priority" AND t."resolution_due_at" IS NULL;
    `);
    console.log('✓ Existing tickets backfilled with calculated SLA deadlines');

    await client.query('COMMIT');
    console.log('--- SLA Database Setup Successfully Completed ---');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Failed to setup SLA database:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrateAndSeedSLA();
