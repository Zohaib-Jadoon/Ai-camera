import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
  DefaultValuePipe,
  Req,
} from '@nestjs/common';
import { AlertsService } from './alerts.service';
import { ReviewAlertDto } from './dto/review-alert.dto';
import {
  CreateAlertDto,
  UpdateAlertStatusDto,
} from './dto/create-alert.dto';
import { AssignAlertDto } from './dto/assign-alert.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
} from '@nestjs/swagger';

@ApiTags('alerts')
@ApiBearerAuth()
@Controller('alerts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @Get()
  @ApiOperation({ summary: 'List alerts with optional filters' })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['PENDING', 'ACKNOWLEDGED', 'RESOLVED'],
  })
  @ApiQuery({ name: 'assignee', required: false, type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  findAll(
    @Query('status') status?: string,
    @Query('assignee') assignee?: string,
    @Query('limit', new DefaultValuePipe(100), ParseIntPipe) limit?: number,
  ) {
    return this.alertsService.findAll(status, assignee, limit);
  }

  @Get('active-count')
  @ApiOperation({ summary: 'Get count of pending alerts (cached)' })
  getActiveCount() {
    return this.alertsService.getActiveCount();
  }

  @Post()
  @Roles(Role.ADMIN, Role.SECURITY_OPERATOR)
  @ApiOperation({ summary: 'Manually create an alert' })
  create(@Body() body: CreateAlertDto) {
    return this.alertsService.create(body);
  }

  @Patch(':id/assign')
  @Roles(Role.ADMIN, Role.SECURITY_OPERATOR)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Assign an alert to a user' })
  assign(
    @Param('id') id: string,
    @Body() dto: AssignAlertDto,
  ) {
    return this.alertsService.assign(id, dto.assigneeId);
  }

  @Patch(':id/status')
  @Roles(Role.ADMIN, Role.SECURITY_OPERATOR)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update alert status (PENDING → ACKNOWLEDGED → RESOLVED)',
  })
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateAlertStatusDto,
  ) {
    return this.alertsService.updateStatus(id, dto.status);
  }

  @Post(':id/review')
  @Roles(Role.ADMIN, Role.SECURITY_OPERATOR)
  review(@Param('id') id: string, @Body() dto: ReviewAlertDto, @Req() req: any) {
    return this.alertsService.review(id, dto.verdict, dto.note, req.user.sub);
  }
}
