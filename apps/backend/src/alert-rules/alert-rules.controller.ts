import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AlertRulesService } from './alert-rules.service';
import { CreateAlertRuleDto } from './dto/create-alert-rule.dto';
import { UpdateAlertRuleDto } from './dto/update-alert-rule.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('alert-rules')
@ApiBearerAuth()
@Controller('alert-rules')
@UseGuards(JwtAuthGuard)
export class AlertRulesController {
  constructor(private readonly alertRulesService: AlertRulesService) {}

  @Get()
  findAll(
    @Query('cameraId') cameraId?: string,
    @Query('enabled') enabled?: string,
  ) {
    const enabledBool =
      enabled === undefined ? undefined : enabled === 'true';
    return this.alertRulesService.findAll(cameraId, enabledBool);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.alertRulesService.findOne(id);
  }

  @Post()
  @Roles(Role.ADMIN)
  create(@Body() dto: CreateAlertRuleDto) {
    return this.alertRulesService.create(dto);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateAlertRuleDto) {
    return this.alertRulesService.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  remove(@Param('id') id: string) {
    return this.alertRulesService.remove(id);
  }
}
