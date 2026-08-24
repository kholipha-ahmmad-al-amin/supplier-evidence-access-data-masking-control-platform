import { randomUUID } from 'node:crypto';

const transitions = {
  classify: { role: 'data_steward', from: 'submitted', to: 'classified', reference: 'classificationVerificationReference' },
  validate: { role: 'masking_qa_analyst', from: 'classified', to: 'validated', reference: 'formatValidationReference' },
  authorize: { role: 'data_sharing_authority', from: 'validated', to: 'authorized', reference: 'sharingAuthorizationReference' },
  seal: { role: 'delivery_controller', from: 'authorized', to: 'sealed', reference: 'releaseSealReference' }
};

function requiredText(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} is required`);
  return value.trim();
}

function maskingMethod(value) {
  const method = requiredText(value, 'masking method');
  if (!['partial_redaction', 'format_preserving', 'nullification'].includes(method)) throw new Error('masking method is invalid');
  return method;
}

function fieldCount(value) {
  if (!Number.isInteger(value) || value < 1 || value > 50) throw new Error('masked field count must be an integer from 1 through 50');
  return value;
}

const copy = (value) => JSON.parse(JSON.stringify(value));

export class DataMaskingControlService {
  constructor(store, clock = () => new Date().toISOString()) { this.store = store; this.clock = clock; }
  list() { return this.store.read().plans.map(copy); }
  submit(input, actor) {
    if (actor?.role !== 'evidence_owner') throw new Error('actor role evidence_owner is required');
    const occurredAt = this.clock();
    const plan = {
      id: randomUUID(),
      supplier: requiredText(input?.supplier, 'supplier'),
      evidenceReference: requiredText(input?.evidenceReference, 'evidence reference'),
      maskingMethod: maskingMethod(input?.maskingMethod),
      maskedFieldCount: fieldCount(input?.maskedFieldCount),
      status: 'submitted',
      createdAt: occurredAt,
      updatedAt: occurredAt,
      auditEvents: [{ type: 'masking_plan_submitted', actorId: requiredText(actor.id, 'actor id'), occurredAt }]
    };
    const document = this.store.read();
    document.plans.push(plan);
    this.store.write(document);
    return copy(plan);
  }
  transition(id, action, input, actor) {
    const rule = transitions[action];
    if (!rule) throw new Error('unsupported masking action');
    if (actor?.role !== rule.role) throw new Error(`actor role ${rule.role} is required`);
    const document = this.store.read();
    const plan = document.plans.find((entry) => entry.id === id);
    if (!plan) throw new Error('masking plan not found');
    if (plan.status !== rule.from) throw new Error(`cannot ${action} a plan in ${plan.status} status`);
    const occurredAt = this.clock();
    plan.status = rule.to;
    plan.updatedAt = occurredAt;
    plan[rule.reference] = requiredText(input?.[rule.reference], rule.reference);
    plan.auditEvents.push({ type: `masking_plan_${rule.to}`, actorId: requiredText(actor.id, 'actor id'), occurredAt });
    this.store.write(document);
    return copy(plan);
  }
}
