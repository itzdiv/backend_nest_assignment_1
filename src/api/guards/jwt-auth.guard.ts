import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as jwt from 'jsonwebtoken';

import { User } from 'src/db/entities/user.entity';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  /*
    Inject User repository.
    We need it because token only contains user_id.
    We must fetch actual user from DB.
  */
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  /*
    canActivate() is required method when implementing CanActivate.

    It returns:
      - true  → allow request
      - false → block request
      - OR throw exception
  */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    /*
      Switch execution context to HTTP.
      (Nest can run GraphQL, WS, RPC — so we specify HTTP)
    */
    const request = context.switchToHttp().getRequest();

    /*
      Authorization header format:
      Authorization: Bearer <token>
    */
    const authHeader = request.headers['authorization'];

    if (!authHeader) {
      throw new UnauthorizedException('Authorization header missing');
    }

    /*
      Split "Bearer tokenvalue"
    */
    const [type, token] = authHeader.split(' ');

    if (type !== 'Bearer' || !token) {
      throw new UnauthorizedException('Invalid authorization format');
    }

    let decoded: any;

    try {
      /*
        Verify token using JWT_SECRET.
        This checks:
          - signature
          - expiration
      */
      decoded = jwt.verify(token, process.env.JWT_SECRET!);
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    /*
      decoded payload structure:
      {
        user_id: string
      }
    */
    const user = await this.userRepository.findOne({
      where: { id: decoded.user_id },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (!user.is_active) {
      throw new UnauthorizedException('User account inactive');
    }

    /*
      Attach user to request object.
      This is VERY IMPORTANT.

      After this, inside controller we can access:

      request.user
    */
    request.user = user;

    /*
      Return true to allow request to continue.
    */
    return true;
  }
}
