import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { PG_POOL } from '../../src/database/database.constants.js';

process.env.NODE_ENV ??= 'test';
process.env.DATABASE_URL ??= 'postgresql://bazariya:bazariya_dev_only@localhost:5432/bazariya_test';

const [{ AppModule }, { configureApp }] = await Promise.all([
  import('../../src/app.module.js'),
  import('../../src/configure-app.js'),
]);

describe('Bazariya API foundation', () => {
  let app: INestApplication;
  const queryCalls: string[] = [];
  let queryFailure: Error | undefined;
  const pool = {
    query: async (statement: string): Promise<{ rows: Array<Record<string, number>>; rowCount: number }> => {
      queryCalls.push(statement);
      if (queryFailure) {
        throw queryFailure;
      }
      return { rows: [{ '?column?': 1 }], rowCount: 1 };
    },
    end: async (): Promise<void> => undefined,
  };

  before(async () => {
    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PG_POOL)
      .useValue(pool)
      .compile();

    app = moduleFixture.createNestApplication();
    configureApp(app, 'http://localhost:5173');
    await app.init();
  });

  after(async () => {
    await app.close();
  });

  beforeEach(() => {
    queryCalls.length = 0;
    queryFailure = undefined;
  });

  it('starts and serves the versioned health endpoint', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/health');

    assert.equal(response.status, 200, JSON.stringify(response.body));
    assert.deepEqual(response.body, {
      data: {
        status: 'ok',
        service: 'bazariya-api',
        database: 'connected',
      },
    });
    assert.deepEqual(queryCalls, ['SELECT 1']);
  });

  it('returns a safe error envelope when PostgreSQL is unavailable', async () => {
    queryFailure = new Error('private connection detail');
    const response = await request(app.getHttpServer()).get('/api/v1/health');

    assert.equal(response.status, 503);
    assert.deepEqual(response.body, {
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'Database is unavailable',
      },
    });
  });

  it('uses the shared error convention for unknown routes', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/unknown-resource');

    assert.equal(response.status, 404);
    assert.deepEqual(response.body, {
      error: {
        code: 'NOT_FOUND',
        message: 'Cannot GET /api/v1/unknown-resource',
      },
    });
  });

  it('adds security headers to HTTP responses', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/health');

    assert.equal(response.status, 200);
    assert.equal(response.headers['x-content-type-options'], 'nosniff');
  });
});
