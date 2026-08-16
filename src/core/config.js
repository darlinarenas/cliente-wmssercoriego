export const APP_CONFIG = {
  name: 'SercoRiego Lite WMS',
  version: '1.0.0-postgresql',
  storageKey: 'serco_wms_inventory_v1',
  activeSiteId: 'REC',
  apiBaseUrl: window.SERCO_WMS_API_BASE_URL || '/api',
  useApi: true,
};

export const LOCATION_STATUS = ['LIBRE','OCUPADA','PARCIAL','BLOQUEADA','RESERVADA','INHABILITADA'];
export const RACK_STATUS = ['ACTIVO','EN_CONSTRUCCION','INACTIVO'];
