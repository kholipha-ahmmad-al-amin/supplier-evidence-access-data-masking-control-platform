import { describe, expect, it } from 'vitest';
import { DataMaskingControlService } from '../domain.mjs';

function memoryStore() {
  let document = { plans: [] };
  return { read: () => JSON.parse(JSON.stringify(document)), write: (next) => { document = JSON.parse(JSON.stringify(next)); } };
}

describe('DataMaskingControlService', () => {
  it('seals a masking plan after all distinct approvals', () => {
    const service = new DataMaskingControlService(memoryStore());
    const plan = service.submit({ supplier: 'Masked Supplier Ltd', evidenceReference: 'EVD-792', maskingMethod: 'format_preserving', maskedFieldCount: 4 }, { id: 'owner', role: 'evidence_owner' });
    service.transition(plan.id, 'classify', { classificationVerificationReference: 'CLS-792' }, { id: 'steward', role: 'data_steward' });
    service.transition(plan.id, 'validate', { formatValidationReference: 'FMT-792' }, { id: 'qa', role: 'masking_qa_analyst' });
    service.transition(plan.id, 'authorize', { sharingAuthorizationReference: 'SHA-792' }, { id: 'authority', role: 'data_sharing_authority' });
    expect(service.transition(plan.id, 'seal', { releaseSealReference: 'RSL-792' }, { id: 'controller', role: 'delivery_controller' }).status).toBe('sealed');
  });
  it('rejects excessive field counts without persisting a plan', () => {
    const service = new DataMaskingControlService(memoryStore());
    expect(() => service.submit({ supplier: 'Masked Supplier Ltd', evidenceReference: 'EVD-792', maskingMethod: 'partial_redaction', maskedFieldCount: 51 }, { id: 'owner', role: 'evidence_owner' })).toThrow('masked field count');
    expect(service.list()).toHaveLength(0);
  });
});
