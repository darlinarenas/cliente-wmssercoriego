import { APP_CONFIG } from '../core/config.js';
import { LocalStorageRepository } from './storage.js';
import { ApiRepository } from './api.js';
export const repository = APP_CONFIG.useApi ? new ApiRepository() : new LocalStorageRepository();
