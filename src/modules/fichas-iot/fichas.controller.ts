import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SupabaseAuthGuard } from '../../common/guards/supabase-auth.guard';
import { CreateFichaDto, FichaPageDto, MetadataDto } from './fichas.dto';
import { FichasService } from './fichas.service';
import { writeExcel, writePdf } from './fichas.export';
type UserRequest = { user: { id: string } };
@ApiTags('Ficha de registro IoT')
@ApiBearerAuth()
@Controller('fichas-iot')
@UseGuards(SupabaseAuthGuard)
export class FichasController {
  constructor(private readonly service: FichasService) {}
  @Get('opciones') options(@Req() req: UserRequest) {
    return this.service.options(req.user.id);
  }
  @Get('contexto/:parcelaId') context(
    @Param('parcelaId', ParseUUIDPipe) id: string,
    @Req() req: UserRequest,
  ) {
    return this.service.context(id, req.user.id);
  }
  @Get() list(@Query() query: FichaPageDto, @Req() req: UserRequest) {
    return this.service.list(req.user.id, query);
  }
  @Post() create(@Body() dto: CreateFichaDto, @Req() req: UserRequest) {
    return this.service.create(dto, req.user.id);
  }
  @Get(':id') view(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: FichaPageDto,
    @Req() req: UserRequest,
  ) {
    return this.service.view(id, req.user.id, query);
  }
  @Patch(':id') update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MetadataDto,
    @Req() req: UserRequest,
  ) {
    return this.service.update(id, dto, req.user.id);
  }
  @Get(':id/pdf') async pdf(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: UserRequest,
    @Res() res: Response,
  ) {
    const { snapshot } = await this.service.load(id, req.user.id);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${snapshot.code}.pdf"`,
      'Cache-Control': 'no-store',
    });
    await writePdf(snapshot, res);
  }
  @Get(':id/excel') async excel(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: UserRequest,
    @Res() res: Response,
  ) {
    const { snapshot } = await this.service.load(id, req.user.id);
    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${snapshot.code}.xlsx"`,
      'Cache-Control': 'no-store',
    });
    await writeExcel(snapshot, res);
  }
}
