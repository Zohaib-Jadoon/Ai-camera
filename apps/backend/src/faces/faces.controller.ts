import {
  Controller, Get, Post, Patch, Delete, Body, Query, Param, UseGuards,
  DefaultValuePipe, ParseIntPipe, HttpCode, HttpStatus, BadRequestException,
  ServiceUnavailableException, Inject, forwardRef, Logger,
} from '@nestjs/common';

import { FacesService } from './faces.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { CreatePersonDto, UpdatePersonDto, AddEmbeddingDto } from './dto/create-person.dto';
import { EventsGateway } from '../events/events.gateway';

@ApiTags('faces')
@ApiBearerAuth()
@Controller('faces')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FacesController {
  private readonly logger = new Logger(FacesController.name);

  constructor(
    private readonly facesService: FacesService,
    @Inject(forwardRef(() => EventsGateway)) private readonly eventsGateway: EventsGateway,
  ) {}

  @Get('persons')
  @ApiOperation({ summary: 'List known persons' })
  @ApiQuery({ name: 'tag', required: false })
  findAllPersons(@Query('tag') tag?: string) {
    return this.facesService.findAllPersons(tag);
  }

  @Get('persons/:id')
  @ApiOperation({ summary: 'Get a single person' })
  findOne(@Param('id') id: string) {
    return this.facesService.findOne(id);
  }

  @Post('persons')
  @Roles(Role.ADMIN, Role.SECURITY_OPERATOR)
  @ApiOperation({ summary: 'Register a new person (optionally with face photo)' })
  async createPerson(@Body() body: CreatePersonDto & { image_b64?: string }) {
    const { image_b64, ...personData } = body;
    const person = await this.facesService.createPerson(personData);

    if (image_b64) {
      try {
        const embedding = await this.eventsGateway.extractFaceEmbedding(image_b64);
        await this.facesService.addEmbedding(person.id, embedding);
        await this.facesService.updatePerson(person.id, { photo_url: image_b64 });
        const allEmbeddings = await this.facesService.getAllEmbeddings();
        this.eventsGateway.emitToAiEngines('sync_embeddings', allEmbeddings);
        return this.facesService.findOne(person.id);
      } catch (err) {
        // Person was created but face extraction failed — return person so client can retry upload
        this.logger.warn(`Person created but face extraction failed: ${err.message}`);
        return person;
      }
    }

    return person;
  }

  @Patch('persons/:id')
  @Roles(Role.ADMIN, Role.SECURITY_OPERATOR)
  @ApiOperation({ summary: 'Update person details (name, tag, photo, alert settings)' })
  updatePerson(@Param('id') id: string, @Body() body: UpdatePersonDto) {
    return this.facesService.updatePerson(id, body);
  }

  @Delete('persons/:id')
  @Roles(Role.ADMIN, Role.SECURITY_OPERATOR)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a person and their embeddings' })
  deletePerson(@Param('id') id: string) {
    return this.facesService.deletePerson(id);
  }

  @Get('embeddings')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Get all face embeddings (for AI engine loading)' })
  getAllEmbeddings() {
    return this.facesService.getAllEmbeddings();
  }

  @Post('persons/:id/embeddings')
  @Roles(Role.ADMIN, Role.SECURITY_OPERATOR)
  @ApiOperation({ summary: 'Add face embedding to a person' })
  addEmbedding(
    @Param('id') personId: string,
    @Body() body: AddEmbeddingDto,
  ) {
    return this.facesService.addEmbedding(personId, body.embedding_vector);
  }

  @Post('persons/:id/upload-image')
  @Roles(Role.ADMIN, Role.SECURITY_OPERATOR)
  @ApiOperation({ summary: 'Upload face image to extract and save embedding' })
  async uploadImage(
    @Param('id') personId: string,
    @Body('image_b64') imageB64: string,
  ) {
    if (!imageB64) {
      throw new BadRequestException('image_b64 is required');
    }
    try {
      const embedding = await this.eventsGateway.extractFaceEmbedding(imageB64);
      const saved = await this.facesService.addEmbedding(personId, embedding);
      // Persist the photo so the UI card can show a preview
      await this.facesService.updatePerson(personId, { photo_url: imageB64 });
      const allEmbeddings = await this.facesService.getAllEmbeddings();
      if (this.eventsGateway.server) {
        this.eventsGateway.emitToAiEngines('sync_embeddings', allEmbeddings);
      }
      return saved;
    } catch (err: any) {
      const msg: string = err?.message || 'Failed to extract face embedding';
      if (msg.includes('not connected') || msg.includes('AI Engine')) {
        throw new ServiceUnavailableException('AI Engine is not connected — start the AI engine and try again');
      }
      if (msg.includes('No face detected') || msg.includes('No face')) {
        throw new BadRequestException('No face detected in the image — use a clear front-facing photo');
      }
      throw new BadRequestException(msg);
    }
  }


  @Get('events')
  @ApiOperation({ summary: 'Get face recognition events' })
  @ApiQuery({ name: 'cameraId', required: false })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getFaceEvents(
    @Query('cameraId') cameraId?: string,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit?: number,
  ) {
    return this.facesService.getFaceEvents(cameraId, limit);
  }

  @Get('unknown')
  @ApiOperation({ summary: 'Get unidentified face events' })
  getUnknownFaces() {
    return this.facesService.getUnknownFaces();
  }
}
