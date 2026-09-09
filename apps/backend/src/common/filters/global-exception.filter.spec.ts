import { BadRequestException, Logger } from '@nestjs/common';
import { GlobalExceptionFilter } from './global-exception.filter';

describe('safe error reporting', () => {
  afterEach(() => jest.restoreAllMocks());
  it('does not log request bodies or query tokens on validation errors', () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    const response: any = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const host: any = { switchToHttp: () => ({ getRequest: () => ({ method: 'POST', path: '/api/cameras', url: '/api/cameras?token=private', body: { password: 'private' } }), getResponse: () => response }) };
    new GlobalExceptionFilter().catch(new BadRequestException('Invalid request'), host);
    expect(JSON.stringify(warn.mock.calls)).not.toContain('private');
    expect(JSON.stringify(response.json.mock.calls)).not.toContain('private');
  });
  it('does not expose Prisma query diagnostics in responses or logs', () => {
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    const response: any = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const host: any = { switchToHttp: () => ({ getRequest: () => ({ method: 'POST', path: '/api/cameras' }), getResponse: () => response }) };
    new GlobalExceptionFilter().catch({ code: 'P2000', clientVersion: 'test', message: 'SQL with private credentials' }, host);
    expect(response.status).toHaveBeenCalledWith(500);
    expect(JSON.stringify(response.json.mock.calls)).not.toContain('private');
    expect(JSON.stringify(error.mock.calls)).not.toContain('private');
  });
});
