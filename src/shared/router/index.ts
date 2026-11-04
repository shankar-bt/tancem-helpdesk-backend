import { Router } from 'express';
import { sql } from 'drizzle-orm';
import { db } from '../../config/database';
import { authRoutes } from '../../modules/auth';
import { departmentRoutes } from '../../modules/departments';
import { masterRoutes } from '../../modules/masters';
import { roleRoutes } from '../../modules/roles';
import { slaRoutes } from '../../modules/sla';
import { ticketRoutes } from '../../modules/tickets';
import { userRoutes } from '../../modules/users';
import { notificationRoutes } from '../../modules/notifications';
import { chatbotRoutes } from '../../modules/chatbot';
import { designationRoutes } from '../../modules/designations';

export const apiRouter = Router();

/**
 * Health check endpoint verifying both API process and PostgreSQL database connectivity.
 * Used by container health checks, cloud probes, and uptime monitors.
 */
apiRouter.get('/health', async (_req, res) => {
  try {
    const start = Date.now();
    await db.execute(sql`SELECT 1`);
    const dbLatencyMs = Date.now() - start;

    res.json({
      success: true,
      data: {
        status: 'healthy',
        database: 'connected',
        dbLatencyMs,
        uptimeSeconds: Math.floor(process.uptime()),
        memoryUsageMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      data: {
        status: 'unhealthy',
        database: 'disconnected',
        error: (error as Error).message,
        timestamp: new Date().toISOString(),
      },
    });
  }
});

apiRouter.use('/auth', authRoutes);
apiRouter.use('/users', userRoutes);
apiRouter.use('/roles', roleRoutes);
apiRouter.use('/departments', departmentRoutes);
apiRouter.use('/tickets', ticketRoutes);
apiRouter.use('/masters', masterRoutes);
apiRouter.use('/sla', slaRoutes);
apiRouter.use('/notifications', notificationRoutes);
apiRouter.use('/chatbot', chatbotRoutes);
apiRouter.use('/designations', designationRoutes);
