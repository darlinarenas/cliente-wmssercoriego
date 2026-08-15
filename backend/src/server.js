import { app } from './app.js';
import { env } from './config/env.js';

app.listen(env.port, () => {
  console.log(`SercoRiego Lite WMS API escuchando en puerto ${env.port}`);
});
