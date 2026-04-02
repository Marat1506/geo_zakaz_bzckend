import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { UserRole } from '../entities/user.entity';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Backward compatibility: accept both legacy 'admin' and new 'superadmin' role
    return (
      user &&
      (user.role === UserRole.SUPERADMIN || (user.role as string) === 'admin')
    );
  }
}
