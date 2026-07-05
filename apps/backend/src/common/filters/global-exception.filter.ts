import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: any = 'Internal server error';

    // @ts-ignore - Prisma might not be typed fully here but we can duck type
    if (exception && typeof exception === 'object' && 'code' in exception && (exception as any).clientVersion) {
      // It's a Prisma error
      const prismaError = exception as any;
      if (prismaError.code === 'P2002') {
        status = HttpStatus.CONFLICT;
        message = 'A record with this value already exists';
      } else if (prismaError.code === 'P2003' || prismaError.code === 'P2025') {
        status = HttpStatus.BAD_REQUEST;
        message = 'Foreign key constraint failed or record not found';
      } else {
        status = HttpStatus.BAD_REQUEST;
        message = prismaError.message || 'Database query error';
      }
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      message = exception.getResponse();
    }

    const errorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message: typeof message === 'object' ? (message as any).message || message : message,
    };

    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} → ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else {
      this.logger.warn(`${request.method} ${request.url} → ${status}: ${JSON.stringify(message)}`);
      if (status === 400) {
        this.logger.warn(`400 Error Body: ${JSON.stringify(request.body)}`);
      }
    }

    response.status(status).json(errorResponse);
  }
}
