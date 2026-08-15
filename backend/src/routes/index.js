import { Router } from 'express';

export const apiRouter = Router();

apiRouter.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'SercoRiego Lite WMS API', persistence: 'pending' });
});

apiRouter.get('/', (_req, res) => {
  res.json({ message: 'API preparada. La maqueta continúa usando LocalStorage hasta activar la base de datos.' });
});
