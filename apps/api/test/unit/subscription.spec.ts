import {
  DEFAULT_GRACE_DAYS,
  addDaysToUtcDate,
  endOfUtcDate,
  evaluateSubscription,
  parseGraceDays,
  toUtcDateOnly,
} from '../../src/subscription/subscription-policy';

const VALID_UNTIL = '2026-10-20';
const VALIDITY_END = new Date('2026-10-21T00:00:00.000Z');
const GRACE_END = new Date('2026-10-28T00:00:00.000Z');

describe('Subscription policy (UTC boundaries)', () => {
  it('keeps the subscription active through the end of the stored UTC date', () => {
    const justBefore = new Date(VALIDITY_END.getTime() - 1);
    expect(
      evaluateSubscription(
        {
          companyStatus: 'active',
          licenseStatus: 'active',
          validUntil: VALID_UNTIL,
          graceDays: 7,
        },
        justBefore,
      ),
    ).toMatchObject({ state: 'active', writeAllowed: true });

    const atBoundary = evaluateSubscription(
      {
        companyStatus: 'active',
        licenseStatus: 'active',
        validUntil: VALID_UNTIL,
        graceDays: 7,
      },
      VALIDITY_END,
    );
    expect(atBoundary.state).toBe('grace_period');
    expect(atBoundary.writeAllowed).toBe(true);
    expect(atBoundary.graceEndsAt).toBe(GRACE_END.toISOString());
  });

  it('allows writes during the grace period and blocks them at its exact end', () => {
    const during = evaluateSubscription(
      {
        companyStatus: 'active',
        licenseStatus: 'active',
        validUntil: VALID_UNTIL,
        graceDays: 7,
      },
      new Date(GRACE_END.getTime() - 1),
    );
    expect(during.state).toBe('grace_period');
    expect(during.writeAllowed).toBe(true);

    const atEnd = evaluateSubscription(
      {
        companyStatus: 'active',
        licenseStatus: 'active',
        validUntil: VALID_UNTIL,
        graceDays: 7,
      },
      GRACE_END,
    );
    expect(atEnd.state).toBe('read_only');
    expect(atEnd.writeAllowed).toBe(false);
  });

  it('treats zero grace days as immediate read-only after expiry', () => {
    const atBoundary = evaluateSubscription(
      {
        companyStatus: 'active',
        licenseStatus: 'active',
        validUntil: VALID_UNTIL,
        graceDays: 0,
      },
      VALIDITY_END,
    );
    expect(atBoundary.state).toBe('read_only');
    expect(atBoundary.writeAllowed).toBe(false);
    expect(atBoundary.graceEndsAt).toBe(VALIDITY_END.toISOString());
  });

  it('treats a null expiry as active and suspension as no access', () => {
    const noExpiry = evaluateSubscription(
      {
        companyStatus: 'active',
        licenseStatus: 'active',
        validUntil: null,
        graceDays: 7,
      },
      new Date('2030-01-01T00:00:00Z'),
    );
    expect(noExpiry).toMatchObject({
      state: 'active',
      writeAllowed: true,
      graceEndsAt: null,
    });

    const suspendedLicense = evaluateSubscription(
      {
        companyStatus: 'active',
        licenseStatus: 'suspended',
        validUntil: null,
        graceDays: 7,
      },
      new Date(),
    );
    expect(suspendedLicense.state).toBe('suspended');
    expect(suspendedLicense.writeAllowed).toBe(false);

    const suspendedCompany = evaluateSubscription(
      {
        companyStatus: 'suspended',
        licenseStatus: 'active',
        validUntil: null,
        graceDays: 7,
      },
      new Date(),
    );
    expect(suspendedCompany.state).toBe('suspended');
    expect(suspendedCompany.writeAllowed).toBe(false);
  });

  it('fails closed for invalid dates', () => {
    for (const invalid of ['not-a-date', '2026-02-30', '2026-13-01', '2026-1-1']) {
      const snapshot = evaluateSubscription(
        {
          companyStatus: 'active',
          licenseStatus: 'active',
          validUntil: invalid,
          graceDays: 7,
        },
        new Date(),
      );
      expect(snapshot.state).toBe('read_only');
      expect(snapshot.writeAllowed).toBe(false);
      expect(snapshot.graceEndsAt).toBeNull();
    }
  });

  it('parses a non-negative grace period and rejects invalid values', () => {
    expect(parseGraceDays(undefined)).toBe(DEFAULT_GRACE_DAYS);
    expect(parseGraceDays('')).toBe(DEFAULT_GRACE_DAYS);
    expect(parseGraceDays('0')).toBe(0);
    expect(parseGraceDays('7')).toBe(7);
    expect(parseGraceDays('3650')).toBe(3650);
    expect(parseGraceDays(' 3 ')).toBe(3);

    for (const invalid of ['-1', '1.5', 'abc', '3651', '99999999999999999999']) {
      expect(() => parseGraceDays(invalid)).toThrow();
    }
  });

  it('does UTC date arithmetic without timezone drift', () => {
    expect(endOfUtcDate('2026-03-21')?.toISOString()).toBe('2026-03-22T00:00:00.000Z');
    expect(addDaysToUtcDate('2026-10-20', 7)).toBe('2026-10-27');
    expect(toUtcDateOnly(new Date('2026-10-20T23:59:59.999Z'))).toBe('2026-10-20');
    expect(endOfUtcDate('2026-02-30')).toBeNull();
  });
});
