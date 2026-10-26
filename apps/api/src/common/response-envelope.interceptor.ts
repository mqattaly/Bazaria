import {
  Injectable,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import { map, type Observable } from 'rxjs';
import { currentRequestId } from './request-context';

/**
 * Success envelope from api-conventions.md:
 * { data: ..., meta: { requestId } }
 */
@Injectable()
export class ResponseEnvelopeInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      map((data) => {
        if (data === undefined || data === null) return data;
        const payload = data as { data?: unknown; meta?: Record<string, unknown> };
        if (
          payload &&
          typeof payload === 'object' &&
          'data' in payload &&
          'meta' in payload &&
          payload.meta &&
          typeof payload.meta === 'object'
        ) {
          return {
            data: payload.data,
            meta: { ...payload.meta, requestId: currentRequestId() },
          };
        }
        return { data, meta: { requestId: currentRequestId() } };
      }),
    );
  }
}
