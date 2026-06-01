import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditService } from './audit.service';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const method = request.method;

    if (!['POST', 'PATCH', 'DELETE'].includes(method)) {
      return next.handle();
    }

    const user = request.user;
    const userId = user?.sub || user?.id;
    const ip = request.ip;

    const controllerName = context.getClass().name;
    const resource = controllerName.replace('Controller', '');

    const actionMap: Record<string, string> = {
      POST: 'created',
      PATCH: 'updated',
      DELETE: 'deleted',
    };
    const action = `${resource.toLowerCase()}.${actionMap[method]}`;

    return next.handle().pipe(
      tap((result) => {
        const resourceId = result?.id;
        this.auditService
          .log({
            user_id: userId,
            action,
            resource,
            resource_id: resourceId,
            ip_address: ip,
            details: { path: request.path, method },
          })
          .catch(() => {});
      }),
    );
  }
}
