export interface ApiSuccess<T> {
  data: T;
  meta?: {
    requestId?: string;
    pagination?: {
      page: number;
      pageSize: number;
      total: number;
    };
  };
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: Array<{
      field?: string;
      message: string;
    }>;
  };
  meta?: {
    requestId?: string;
  };
}

export interface HealthData {
  status: 'ok';
  service: 'bazariya-api';
  database: 'connected';
}
