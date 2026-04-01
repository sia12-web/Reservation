import request from 'supertest';
import { httpServer } from '../src/app';
import { env } from '../src/config';
import prisma from '../src/config/database';

describe('Health Check Endpoint', () => {
  beforeAll(async () => {
    // Mock database connection for tests
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
    httpServer.close();
  });

  describe('GET /health', () => {
    it('should return 200 status', async () => {
      const response = await request(httpServer).get('/health');
      expect(response.status).toBe(200);
    });

    it('should return ok status', async () => {
      const response = await request(httpServer).get('/health');
      expect(response.body).toHaveProperty('status', 'ok');
    });

    it('should return timestamp', async () => {
      const response = await request(httpServer).get('/health');
      expect(response.body).toHaveProperty('timestamp');
      expect(new Date(response.body.timestamp)).toBeInstanceOf(Date);
    });

    it('should return environment', async () => {
      const response = await request(httpServer).get('/health');
      expect(response.body).toHaveProperty('environment');
      expect(response.body.environment).toBe(env.NODE_ENV);
    });

    it('should work without authentication', async () => {
      const response = await request(httpServer).get('/health');
      expect(response.status).toBe(200);
    });
  });
});
