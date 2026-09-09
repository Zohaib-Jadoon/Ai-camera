import { ExecutionContext, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { FacesController } from './faces.controller';
import { FacesService } from './faces.service';
import { EventsGateway } from '../events/events.gateway';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

describe('face enrollment privacy over HTTP', () => {
  let app: INestApplication;
  let faces: any;
  let gateway: any;
  let role: string;

  beforeEach(async () => {
    role = 'SECURITY_OPERATOR';
    faces = {
      createPerson: jest.fn().mockResolvedValue({ id: 'person' }),
      findOne: jest.fn().mockResolvedValue({ id: 'person', name: 'Test' }),
      addEmbedding: jest.fn().mockResolvedValue({ id: 'embedding' }),
      updatePerson: jest.fn().mockResolvedValue({ id: 'person' }),
      getAllEmbeddings: jest
        .fn()
        .mockResolvedValue([
          { person_id: 'person', embedding_vector: [0.1, 0.2] },
        ]),
    };
    gateway = {
      extractFaceEmbedding: jest.fn().mockResolvedValue([0.1, 0.2]),
      emitToAiEngines: jest.fn(),
      server: { emit: jest.fn() },
    };
    const module = await Test.createTestingModule({
      controllers: [FacesController],
      providers: [
        { provide: FacesService, useValue: faces },
        { provide: EventsGateway, useValue: gateway },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate(context: ExecutionContext) {
          context.switchToHttp().getRequest().user = { sub: 'operator', role };
          return true;
        },
      })
      .compile();
    app = module.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it.each(['VIEWER', 'SECURITY_OPERATOR'])(
    'denies bulk biometric export for %s',
    async (userRole) => {
      role = userRole;
      await request(app.getHttpServer()).get('/faces/embeddings').expect(403);
      expect(faces.getAllEmbeddings).not.toHaveBeenCalled();
    },
  );

  it('permits an administrator to export embeddings', async () => {
    role = 'ADMIN';
    await request(app.getHttpServer()).get('/faces/embeddings').expect(200);
    expect(faces.getAllEmbeddings).toHaveBeenCalledTimes(1);
  });

  it.each(['/faces/persons', '/faces/persons/person/upload-image'])(
    'sends enrollment vectors only to engines: %s',
    async (endpoint) => {
      await request(app.getHttpServer())
        .post(endpoint)
        .send({ name: 'Test', image_b64: 'test-image' })
        .expect(201);
      expect(gateway.emitToAiEngines).toHaveBeenCalledWith('sync_embeddings', [
        { person_id: 'person', embedding_vector: [0.1, 0.2] },
      ]);
      expect(gateway.server.emit).not.toHaveBeenCalled();
    },
  );
});
