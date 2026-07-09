import type { FilingStatus } from './domain/state';

export type { FilingStatus };

export interface HolderInfo {
  type: 'pf' | 'pj';
  docNumber: string;
  name: string;
}

export interface AuthorInfo {
  name: string;
  cpf: string;
}

export interface OperatorChecklist {
  dvSigned: boolean;
  doubleChecked: boolean;
  doubleCheckedBy?: string;
}

export interface FilingRow {
  id: string;
  inpiCertificateId: string | null;
  customerUserId: string;
  mode: 'self_service' | 'assisted';
  status: FilingStatus;
  holder: HolderInfo | null;
  authors: AuthorInfo[] | null;
  poaPdfS3Key: string | null;
  gruNumber: string | null;
  inpiProcessNumber: string | null;
  certificateS3Key: string | null;
  feeCentsService: number | null;
  feeCentsGru: number | null;
  operatorChecklist: OperatorChecklist | null;
  assignedOperator: string | null;
  filedAt: Date | null;
  grantedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  projectId: string;
  projectTitle: string;
  projectSlug: string;
  versionNumber: number;
  customerName: string;
  customerEmail: string;
}

export interface FilingPatch {
  status?: FilingStatus;
  holder?: HolderInfo;
  authors?: AuthorInfo[];
  poaPdfS3Key?: string;
  gruNumber?: string;
  inpiProcessNumber?: string;
  certificateS3Key?: string;
  feeCentsService?: number;
  feeCentsGru?: number;
  operatorChecklist?: OperatorChecklist;
  assignedOperator?: string;
  filedAt?: Date;
  grantedAt?: Date;
}

export interface FilingRepository {
  create(input: { inpiCertificateId: string; customerUserId: string }): Promise<FilingRow>;
  findById(id: string): Promise<FilingRow | null>;
  update(id: string, patch: FilingPatch): Promise<FilingRow>;
  listForCustomer(customerUserId: string): Promise<FilingRow[]>;
  listForQueue(status?: FilingStatus): Promise<FilingRow[]>;
}

export type FilingEventKind = 'created' | 'poa_signed' | 'gru_paid' | 'filed' | 'rpi_dispatch' | 'granted' | 'note';

export interface FilingEventRow {
  id: string;
  kind: FilingEventKind;
  detail: unknown;
  occurredAt: Date;
}

export interface FilingEventRepository {
  record(filingId: string, kind: FilingEventKind, detail?: unknown): Promise<void>;
  listForFiling(filingId: string): Promise<FilingEventRow[]>;
}

export interface FilingCertificateInfo {
  certificateId: string;
  projectId: string;
  ownerUserId: string;
  ownerName: string;
  ownerEmail: string;
  versionNumber: number;
  title: string;
  slug: string;
}

/** Só o suficiente do RF-16 para validar posse e pré-preencher o formulário (RF-17). */
export interface FilingCertificateRepository {
  getForOwner(certificateId: string, ownerUserId: string): Promise<FilingCertificateInfo | null>;
  getById(certificateId: string): Promise<FilingCertificateInfo | null>;
}

export interface FilingStorage {
  /** URL pré-assinada para enviar um PDF direto ao objeto (procuração ou certificado — mesmo padrão do M2). */
  presignPut(key: string, contentType: string): Promise<string>;
  download(key: string): Promise<Buffer>;
  presignGet(key: string): Promise<string>;
}
