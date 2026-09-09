import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { timingSafeEqual } from 'crypto';
import { Server } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';

/** Authenticate before Socket.IO admits clients to rooms or broadcasts. */
export function installSocketAuthentication(
  server: Server,
  config: ConfigService,
  jwt: JwtService,
  prisma: PrismaService,
): void {
  server.use(async (client, next) => {
    try {
      const token =
        client.handshake.auth?.token ?? client.handshake.headers.authorization;
      if (token !== undefined) {
        if (typeof token !== 'string') throw new Error('Invalid token');
        const secret = config.getOrThrow<string>('JWT_SECRET');
        const payload = jwt.verify(token.replace(/^Bearer /, ''), { secret });
        if (
          typeof payload.sub !== 'string' ||
          !payload.sub ||
          !Number.isSafeInteger(payload.exp) ||
          payload.exp * 1000 <= Date.now()
        ) {
          throw new Error('Invalid session');
        }
        const user = await prisma.user.findUnique({
          where: { id: payload.sub },
          select: { id: true, email: true, role: true, isActive: true },
        });
        if (!user?.isActive || payload.exp * 1000 <= Date.now()) {
          throw new Error('Invalid session');
        }
        client.data.user = { sub: user.id, email: user.email, role: user.role };
        client.data.expiresAt = payload.exp * 1000;
      } else {
        const key =
          client.handshake.headers['x-ai-engine-key'] ??
          client.handshake.auth?.['x-ai-engine-key'];
        const expected = config.getOrThrow<string>('AI_ENGINE_KEY');
        if (typeof key !== 'string' || !key || !expected)
          throw new Error('Invalid service key');
        const actualBytes = Buffer.from(key);
        const expectedBytes = Buffer.from(expected);
        if (
          actualBytes.length !== expectedBytes.length ||
          !timingSafeEqual(actualBytes, expectedBytes)
        ) {
          throw new Error('Invalid service key');
        }
        client.data.authenticatedEngine = true;
      }
      next();
    } catch {
      next(new Error('Unauthorized'));
    }
  });
}
