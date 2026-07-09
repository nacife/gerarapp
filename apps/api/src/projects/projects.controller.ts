import { Body, Controller, Get, HttpCode, Param, Post, Put, Query } from '@nestjs/common';
import { CurrentUser, RequireScope, type AuthenticatedUser } from '../common/decorators';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { paginationSchema, type Paginated, type PaginationDto } from '../common/pagination';
import { ContentMapService } from './content-map.service';
import { ProjectsService } from './projects.service';
import { SourceFilesService } from './source-files.service';
import {
  createProjectSchema,
  initiateUploadSchema,
  updateContentMapSchema,
  type CreateProjectDto,
  type InitiateUploadDto,
  type UpdateContentMapDto,
} from './dto/schemas';
import type { ContentMapRecord, ProjectRecord } from './ports';

function projectView(p: ProjectRecord) {
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    status: p.status,
    accessMode: p.accessMode,
    createdAt: p.createdAt,
  };
}

function mapView(m: ContentMapRecord) {
  return {
    id: m.id,
    revision: m.revision,
    tree: m.tree,
    structureConfidence: m.structureConfidence,
    approvedAt: m.approvedAt,
  };
}

@Controller('projects')
export class ProjectsController {
  constructor(
    private readonly projects: ProjectsService,
    private readonly sourceFiles: SourceFilesService,
    private readonly contentMaps: ContentMapService,
  ) {}

  @Post()
  @HttpCode(201)
  @RequireScope('projects:write')
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createProjectSchema)) dto: CreateProjectDto,
  ) {
    return projectView(await this.projects.create(user.id, dto.title));
  }

  @Get()
  @RequireScope('projects:read')
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(paginationSchema)) pagination: PaginationDto,
  ): Promise<Paginated<ReturnType<typeof projectView>>> {
    const all = await this.projects.list(user.id);
    const total = all.length;
    const items = all.slice(pagination.offset, pagination.offset + pagination.limit).map(projectView);
    return { items, total, offset: pagination.offset, limit: pagination.limit };
  }

  @Get(':id')
  @RequireScope('projects:read')
  async get(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return projectView(await this.projects.get(id, user.id));
  }

  @Post(':id/source-files')
  @HttpCode(201)
  @RequireScope('content:write')
  async initiateUpload(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(initiateUploadSchema)) dto: InitiateUploadDto,
  ) {
    return this.sourceFiles.initiateUpload(id, user.id, dto);
  }

  @Get(':id/content-map')
  @RequireScope('content:read')
  async getContentMap(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return mapView(await this.contentMaps.get(id, user.id));
  }

  @Put(':id/content-map')
  @RequireScope('content:write')
  async updateContentMap(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateContentMapSchema)) dto: UpdateContentMapDto,
  ) {
    return mapView(await this.contentMaps.update(id, user.id, dto.tree));
  }

  @Post(':id/content-map/approve')
  @HttpCode(200)
  @RequireScope('content:write')
  async approveContentMap(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    const approved = await this.contentMaps.approve(id, user.id);
    return { approved: true, approvedAt: approved.approvedAt };
  }
}
