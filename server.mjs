import express from 'express';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DataMaskingControlService } from './domain.mjs';
import { AtomicJsonStore } from './store.mjs';

const directory = fileURLToPath(new URL('.', import.meta.url));
const service = new DataMaskingControlService(new AtomicJsonStore(join(directory, 'data', 'masking-plans.json')));
const app = express();
app.use(express.json());

function actor(request) { return { id: request.get('x-actor-id'), role: request.get('x-actor-role') }; }
function respond(response, operation, successStatus = 200) {
  try { response.status(successStatus).json({ plan: operation() }); }
  catch (error) { response.status(422).json({ error: error.message }); }
}

app.get('/health', (_request, response) => response.json({ status: 'ok' }));
app.get('/v1/plans', (_request, response) => response.json({ plans: service.list() }));
app.post('/v1/plans', (request, response) => respond(response, () => service.submit(request.body, actor(request)), 201));
for (const action of ['classify', 'validate', 'authorize', 'seal']) {
  app.post(`/v1/plans/:id/${action}`, (request, response) => respond(response, () => service.transition(request.params.id, action, request.body, actor(request))));
}

app.listen(Number(process.env.PORT || 65531), '0.0.0.0');
