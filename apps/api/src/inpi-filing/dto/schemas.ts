import { z } from 'zod';

export const contractFilingSchema = z.object({
  certificateId: z.string().uuid(),
});
export type ContractFilingDto = z.infer<typeof contractFilingSchema>;

const holderSchema = z.object({
  type: z.enum(['pf', 'pj']),
  docNumber: z.string().min(11).max(20),
  name: z.string().min(1).max(200),
});

const authorSchema = z.object({
  name: z.string().min(1).max(200),
  cpf: z.string().min(11).max(14),
});

export const submitDataSchema = z.object({
  holder: holderSchema,
  authors: z.array(authorSchema).max(50),
});
export type SubmitDataDto = z.infer<typeof submitDataSchema>;

export const confirmPoaSchema = z.object({
  declaredSignerDocType: z.enum(['e-cpf', 'e-cnpj']),
  declaredSignerDocNumber: z.string().min(11).max(20),
});
export type ConfirmPoaDto = z.infer<typeof confirmPoaSchema>;

export const updateChecklistSchema = z.object({
  dvSigned: z.boolean().optional(),
  doubleChecked: z.boolean().optional(),
  doubleCheckedBy: z.string().max(200).optional(),
});
export type UpdateChecklistDto = z.infer<typeof updateChecklistSchema>;

export const protocolSchema = z.object({
  gruNumber: z.string().min(1).max(60),
  inpiProcessNumber: z.string().min(1).max(60),
});
export type ProtocolDto = z.infer<typeof protocolSchema>;

export const rpiEventSchema = z.object({
  note: z.string().min(1).max(2000),
});
export type RpiEventDto = z.infer<typeof rpiEventSchema>;

export const rejectSchema = z.object({
  reason: z.string().min(1).max(2000),
});
export type RejectDto = z.infer<typeof rejectSchema>;

export const listQueueSchema = z.object({
  status: z
    .enum(['draft', 'awaiting_poa', 'awaiting_payment', 'in_review', 'filed', 'granted', 'rejected', 'revoked'])
    .optional(),
});
export type ListQueueDto = z.infer<typeof listQueueSchema>;
