import { dashboardApi } from '../api/dashboard';
import { reportsApi } from '../api/reports';
import { referencesApi } from '../api/references';
import { documentsApi, supplyChainApi, calculatorApi, authApi, auditApi, notificationsApi } from '../api';

export let MOCK_USERS = [];
export let MOCK_KPI = { landArea: '', sownArea: '', harvest: '', fertilizers: '', pesticides: '', subsidies: '' };
export let MOCK_TOP_FERTILIZERS = [];
export let MOCK_TOP_PESTICIDES = [];
export let MOCK_REPORTS = [];
export let MOCK_FERTILIZERS_REF = [];
export let MOCK_PESTICIDES_REF = [];
export let MOCK_DOCUMENTS = [];
export let MOCK_SUPPLY_CHAIN = [];
export let MOCK_AUDIT_LOG = [];
export let MOCK_NOTIFICATIONS = [];
export let CALC_NORMS = {};
export let MOCK_MAP_DISTRICTS = [];

export const initAPI = async () => {
  try {
    const [
      users, kpi, topF, topP, reports, fertRef, pestRef, docs, sc, audit, notif, calc, mapDistricts
    ] = await Promise.all([
      authApi.getUsers(),
      dashboardApi.getKPI(),
      dashboardApi.getTopFertilizers(),
      dashboardApi.getTopPesticides(),
      reportsApi.getReports(),
      referencesApi.getFertilizers(),
      referencesApi.getPesticides(),
      documentsApi.getDocuments(),
      supplyChainApi.getSupplyChain(),
      auditApi.getAuditLog(),
      notificationsApi.getNotifications(),
      calculatorApi.getCalcNorms(),
      dashboardApi.getMapDistricts()
    ]);

    MOCK_USERS = users.data || [];
    MOCK_KPI = kpi.data && Object.keys(kpi.data).length ? kpi.data : { landArea: '', sownArea: '', harvest: '', fertilizers: '', pesticides: '', subsidies: '' };
    MOCK_TOP_FERTILIZERS = topF.data || [];
    MOCK_TOP_PESTICIDES = topP.data || [];
    MOCK_REPORTS = reports.data || [];
    MOCK_FERTILIZERS_REF = fertRef.data || [];
    MOCK_PESTICIDES_REF = pestRef.data || [];
    MOCK_DOCUMENTS = docs.data || [];
    MOCK_SUPPLY_CHAIN = sc.data || [];
    MOCK_AUDIT_LOG = audit.data || [];
    MOCK_NOTIFICATIONS = notif.data || [];
    
    const calcNormsObj = {};
    (calc.data || []).forEach(item => {
      calcNormsObj[item.id] = {
        fertilizer: item.fertilizer,
        fertNorm: item.fertNorm,
        pesticide: item.pesticide,
        pestNorm: item.pestNorm,
        pricePerHa: item.pricePerHa
      };
    });
    CALC_NORMS = calcNormsObj;
    
    MOCK_MAP_DISTRICTS = mapDistricts.data || [];
  } catch (error) {
    console.error("Failed to load data from json-server", error);
  }
};
