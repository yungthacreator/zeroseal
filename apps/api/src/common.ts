import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Injectable,
  Logger,
  NestMiddleware,
} from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";
import { randomUUID } from "node:crypto";
import type { ZodType } from "zod";

export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
    requestId?: string;
  };
};

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 400,
  ) {
    super(message);
  }
}

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request & { requestId?: string }, res: Response, next: NextFunction) {
    const requestId =
      typeof req.headers["x-request-id"] === "string"
        ? req.headers["x-request-id"]
        : randomUUID();
    req.requestId = requestId;
    res.setHeader("x-request-id", requestId);
    next();
  }
}

@Catch()
export class SafeExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(SafeExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request & { requestId?: string }>();
    const res = ctx.getResponse<Response>();

    if (exception instanceof ApiError) {
      const body: ApiErrorBody = {
        error: {
          code: exception.code,
          message: exception.message,
          requestId: req.requestId,
        },
      };
      res.status(exception.status).json(body);
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body: ApiErrorBody = {
        error: {
          code: "HTTP_ERROR",
          message:
            status >= 500
              ? "The request could not be completed."
              : exception.message,
          requestId: req.requestId,
        },
      };
      res.status(status).json(body);
      return;
    }

    this.logger.error(
      JSON.stringify({
        requestId: req.requestId,
        error:
          exception instanceof Error ? exception.message : "Unknown error",
      }),
    );

    res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "The request could not be completed.",
        requestId: req.requestId,
      },
    } satisfies ApiErrorBody);
  }
}

export function parseOrThrow<T>(schema: ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (parsed.success) {
    return parsed.data;
  }

  const message = parsed.error.issues
    .map((issue) => {
      const path = issue.path.map(String).join(".");
      return `${path || "body"}: ${issue.message}`;
    })
    .join("; ");
  throw new ApiError("VALIDATION_FAILED", message, 422);
}
