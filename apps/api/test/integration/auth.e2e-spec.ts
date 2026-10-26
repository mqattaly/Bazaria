import { createHash } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import {
  closeAdminPool,
  createApp,
  closeApp,
  login,
  requestApp,
  resetDatabase,
  seedUser,
  sessionCookie,
  uniqueMobile,
} from '../helpers/harness';
import { admin } from '../helpers/harness';

const PASSWORD = 'TestPass12345';

describe('Authentication (PH-1)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createApp();
  });

  afterAll(async () => {
    await closeApp(app);
    await closeAdminPool();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  it('logs in, sets a hardened HttpOnly cookie and returns no secrets', async () => {
    const mobile = uniqueMobile();
    await seedUser({ mobile, password: PASSWORD, fullName: 'مدیر آزمایشی' });

    const response = await requestApp(app)
      .post('/api/v1/auth/login')
      .send({ mobile, password: PASSWORD })
      .expect(200);

    const cookieHeader = response.headers['set-cookie'];
    const cookies = Array.isArray(cookieHeader) ? cookieHeader : [cookieHeader];
    const session = cookies.find((cookie) => cookie?.startsWith('bz_session='));
    expect(session).toBeDefined();
    expect(session).toContain('HttpOnly');
    expect(session).toContain('SameSite=Strict');
    expect(session).toContain('Path=/');
    expect(session).not.toContain('Secure'); // COOKIE_SECURE=false in tests

    expect(response.body.data.user.mobile).toBe(mobile);
    expect(response.body.meta.requestId).toBeTruthy();
    expect(JSON.stringify(response.body)).not.toContain(PASSWORD);
    expect(JSON.stringify(response.body)).not.toContain('argon2');
  });

  it('normalizes Persian digits, spaces and +98 prefix on login', async () => {
    await seedUser({ mobile: '+989121110001', password: PASSWORD });
    await requestApp(app)
      .post('/api/v1/auth/login')
      .send({ mobile: '۰۹۱۲۱۱۱۰۰۰۱', password: PASSWORD })
      .expect(200);
    await requestApp(app)
      .post('/api/v1/auth/login')
      .send({ mobile: '0912 111 0001', password: PASSWORD })
      .expect(200);
  });

  it('returns identical errors for unknown account and wrong password', async () => {
    const mobile = uniqueMobile();
    await seedUser({ mobile, password: PASSWORD });

    const wrongPassword = await requestApp(app)
      .post('/api/v1/auth/login')
      .send({ mobile, password: 'WrongPass12345' })
      .expect(401);

    const unknownUser = await requestApp(app)
      .post('/api/v1/auth/login')
      .send({ mobile: '+989999999999', password: PASSWORD })
      .expect(401);

    expect(wrongPassword.body.error.code).toBe('AUTH_INVALID_CREDENTIALS');
    expect(unknownUser.body.error.code).toBe('AUTH_INVALID_CREDENTIALS');
    expect(wrongPassword.body.error.message).toBe(unknownUser.body.error.message);
    expect(wrongPassword.body.error.requestId).toBeTruthy();
    expect(wrongPassword.body.error.retryable).toBe(false);
  });

  it('locks the account after repeated failures, even for a correct password', async () => {
    const mobile = uniqueMobile();
    await seedUser({ mobile, password: PASSWORD });

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await requestApp(app)
        .post('/api/v1/auth/login')
        .send({ mobile, password: 'WrongPass12345' })
        .expect(401);
    }

    const locked = await requestApp(app)
      .post('/api/v1/auth/login')
      .send({ mobile, password: PASSWORD })
      .expect(423);

    expect(locked.body.error.code).toBe('AUTH_ACCOUNT_LOCKED');

    const failures = await admin().query(
      `SELECT count(*)::int AS n FROM security_events WHERE event_type = 'auth.login.failed'`,
    );
    expect(failures.rows[0].n).toBeGreaterThanOrEqual(5);
  });

  it('revokes the session on logout', async () => {
    const mobile = uniqueMobile();
    await seedUser({ mobile, password: PASSWORD });
    const { cookie } = await login(app, mobile, PASSWORD);

    await requestApp(app).get('/api/v1/me').set('Cookie', cookie).expect(200);
    await requestApp(app).post('/api/v1/auth/logout').set('Cookie', cookie).expect(200);
    await requestApp(app).get('/api/v1/me').set('Cookie', cookie).expect(401);
  });

  it('rejects a missing session and never accepts tokens from another cookie', async () => {
    const missing = await requestApp(app).get('/api/v1/me').expect(401);
    expect(missing.body.error.code).toBe('AUTH_REQUIRED');

    const forged = await requestApp(app)
      .get('/api/v1/me')
      .set('Cookie', 'bz_session=not-a-real-token')
      .expect(401);
    expect(forged.body.error.code).toBe('AUTH_REQUIRED');
  });

  it('sets a password once with a single-use token and revokes old sessions', async () => {
    const mobile = uniqueMobile();
    const userId = await seedUser({ mobile, password: PASSWORD });
    const { cookie: oldCookie } = await login(app, mobile, PASSWORD);

    const token = 'activation-token-for-test-1234';
    const tokenHash = createHash('sha256').update(token).digest('hex');
    await admin().query(
      `INSERT INTO password_reset_tokens
         (user_id, token_hash, expires_at, created_by_type)
       VALUES ($1, $2, now() + interval '30 minutes', 'system')`,
      [userId, tokenHash],
    );

    const newPassword = 'BrandNewPass9876';
    await requestApp(app)
      .post('/api/v1/auth/password/set')
      .send({ token, newPassword })
      .expect(200);

    await requestApp(app).get('/api/v1/me').set('Cookie', oldCookie).expect(401);

    await requestApp(app)
      .post('/api/v1/auth/login')
      .send({ mobile, password: newPassword })
      .expect(200);

    const replay = await requestApp(app)
      .post('/api/v1/auth/password/set')
      .send({ token, newPassword: 'AnotherPass9876' })
      .expect(400);
    expect(replay.body.error.code).toBe('INVALID_RESET_TOKEN');
  });

  it('enforces the password policy with a structured validation error', async () => {
    const mobile = uniqueMobile();
    const userId = await seedUser({ mobile, password: PASSWORD });
    const token = 'policy-token-for-test-5678';
    await admin().query(
      `INSERT INTO password_reset_tokens
         (user_id, token_hash, expires_at, created_by_type)
       VALUES ($1, $2, now() + interval '30 minutes', 'system')`,
      [userId, createHash('sha256').update(token).digest('hex')],
    );

    const response = await requestApp(app)
      .post('/api/v1/auth/password/set')
      .send({ token, newPassword: 'password123' })
      .expect(422);

    expect(response.body.error.code).toBe('PASSWORD_POLICY_VIOLATION');
    expect(Array.isArray(response.body.error.details)).toBe(true);
  });

  it('rejects a mutating request from a disallowed origin', async () => {
    const mobile = uniqueMobile();
    await seedUser({ mobile, password: PASSWORD });

    const rejected = await requestApp(app)
      .post('/api/v1/auth/login')
      .set('Origin', 'https://evil.example')
      .send({ mobile, password: PASSWORD })
      .expect(400);
    expect(rejected.body.error.code).toBe('MALFORMED_REQUEST');

    await requestApp(app)
      .post('/api/v1/auth/login')
      .set('Origin', 'http://localhost:5173')
      .send({ mobile, password: PASSWORD })
      .expect(200);
  });

  it('rejects unknown body fields instead of silently ignoring them', async () => {
    const mobile = uniqueMobile();
    await seedUser({ mobile, password: PASSWORD });
    const response = await requestApp(app)
      .post('/api/v1/auth/login')
      .send({ mobile, password: PASSWORD, companyId: 'forged' })
      .expect(422);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns stable errors for unknown routes and malformed JSON', async () => {
    const notFound = await requestApp(app).get('/api/v1/not-a-route').expect(404);
    expect(notFound.body.error.code).toBe('RESOURCE_NOT_FOUND');
    expect(notFound.body.error.requestId).toBeTruthy();

    const malformed = await requestApp(app)
      .post('/api/v1/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"mobile":')
      .expect(400);
    expect(malformed.body.error.code).toBe('MALFORMED_REQUEST');
  });

  it('echoes a valid request id and generates one otherwise', async () => {
    const mobile = uniqueMobile();
    await seedUser({ mobile, password: PASSWORD });

    const withId = await requestApp(app)
      .post('/api/v1/auth/login')
      .set('X-Request-Id', 'test-request-12345')
      .send({ mobile, password: PASSWORD })
      .expect(200);
    expect(withId.headers['x-request-id']).toBe('test-request-12345');
    expect(withId.body.meta.requestId).toBe('test-request-12345');

    const generated = await requestApp(app)
      .post('/api/v1/auth/login')
      .send({ mobile, password: PASSWORD })
      .expect(200);
    expect(generated.headers['x-request-id']).toMatch(/[0-9a-f-]{36}/);
    expect(sessionCookie(generated)).toContain('bz_session=');
  });
});
