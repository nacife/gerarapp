import { Body, Controller, Get, HttpCode, Param, Patch, Post, UseInterceptors } from '@nestjs/common';
import { CurrentUser, type AuthenticatedUser } from '../common/decorators';
import { IdempotencyInterceptor } from '../common/idempotency.interceptor';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { FilingService } from './filing.service';
import {
  confirmPoaSchema,
  contractFilingSchema,
  submitDataSchema,
  type ConfirmPoaDto,
  type ContractFilingDto,
  type SubmitDataDto,
} from './dto/schemas';

/** Registro Assistido — lado do criador (RF-17, §3.2 passos 1-5, revogação §3.3). */
@Controller('inpi/filings')
export class FilingController {
  constructor(private readonly filing: FilingService) {}

  @Get('pricing')
  pricing(@CurrentUser() _user: AuthenticatedUser) {
    return this.filing.pricing();
  }

  @Get()
  listMine(@CurrentUser() user: AuthenticatedUser) {
    return this.filing.listMine(user.id);
  }

  @Post()
  @HttpCode(201)
  @UseInterceptors(IdempotencyInterceptor)
  async contract(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(contractFilingSchema)) dto: ContractFilingDto,
  ) {
    return this.filing.contract(dto.certificateId, user.id);
  }

  @Get(':id')
  getTimeline(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.filing.getTimeline(id, user.id);
  }

  @Patch(':id/data')
  submitData(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(submitDataSchema)) dto: SubmitDataDto,
  ) {
    return this.filing.submitData(id, user.id, dto);
  }

  @Post(':id/poa/upload-url')
  @HttpCode(200)
  poaUploadUrl(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.filing.poaUploadUrl(id, user.id);
  }

  @Post(':id/poa/confirm')
  @HttpCode(200)
  @UseInterceptors(IdempotencyInterceptor)
  confirmPoa(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(confirmPoaSchema)) dto: ConfirmPoaDto,
  ) {
    return this.filing.confirmPoa(id, user.id, dto.declaredSignerDocType, dto.declaredSignerDocNumber);
  }

  @Post(':id/payment')
  @HttpCode(200)
  @UseInterceptors(IdempotencyInterceptor)
  confirmPayment(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.filing.confirmPayment(id, user.id);
  }

  @Post(':id/revoke')
  @HttpCode(200)
  revoke(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.filing.revoke(id, user.id);
  }
}
