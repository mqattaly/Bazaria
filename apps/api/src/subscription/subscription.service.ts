import { Injectable } from '@nestjs/common';
import type { SubscriptionSnapshot } from '@bazaria/shared';
import { env } from '../config/env';
import { AppError } from '../common/errors';
import { evaluateSubscription } from './subscription-policy';

@Injectable()
export class SubscriptionService {
  readonly graceDays = env.subscriptionGraceDays;

  evaluate(
    companyStatus: string,
    licenseStatus: string,
    validUntil: string | null,
    now: Date = new Date(),
  ): SubscriptionSnapshot {
    return evaluateSubscription(
      { companyStatus, licenseStatus, validUntil, graceDays: this.graceDays },
      now,
    );
  }

  readOnlyError(snapshot: SubscriptionSnapshot): AppError {
    return new AppError('COMPANY_SUBSCRIPTION_READ_ONLY', {
      details: [
        {
          field: 'subscription',
          code: 'READ_ONLY',
          message:
            'برای تمدید اشتراک با مدیر شرکت یا مدیر پلتفرم تماس بگیرید.',
        },
      ],
      meta: {
        subscriptionState: snapshot.state,
        graceEndsAt: snapshot.graceEndsAt,
        writeAllowed: false,
      },
    });
  }

  assertWritable(snapshot: SubscriptionSnapshot): void {
    if (!snapshot.writeAllowed) {
      throw this.readOnlyError(snapshot);
    }
  }
}
