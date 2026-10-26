import { randomUUID } from 'node:crypto';
import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { requestStore, type RequestStore } from './request-context';
import { REQUEST_ID_HEADER } from '@bazaria/shared';

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._-]{8,128}$/;

/**
 * Assigns/propagates a request id and opens the async request context used by
 * services and the audit trail.
 */
@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const incoming = req.header(REQUEST_ID_HEADER);
    const requestId = incoming && REQUEST_ID_PATTERN.test(incoming) ? incoming : randomUUID();
    res.setHeader(REQUEST_ID_HEADER, requestId);

    const store: RequestStore = {
      requestId,
      ip: req.ip,
      userAgent: req.header('user-agent') ?? undefined,
    };
    requestStore.enterWith(store);
    next();
  }
}
