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
  const token = localStorage.getItem('token');
  if (!token) {
    return;
  }
  try {
    const [
      users, kpi, topF, topP, reports, fertRef, pestRef, docs, sc, audit, notif, calc, mapDistricts
    ] = await Promise.all([
      authApi.getUsers().catch(() => ({ data: [] })),
      dashboardApi.getKPI().catch(() => ({ data: {} })),
      dashboardApi.getTopFertilizers().catch(() => ({ data: [] })),
      dashboardApi.getTopPesticides().catch(() => ({ data: [] })),
      reportsApi.getReports().catch(() => ({ data: [] })),
      referencesApi.getFertilizers().catch(() => ({ data: [] })),
      referencesApi.getPesticides().catch(() => ({ data: [] })),
      documentsApi.getDocuments().catch(() => ({ data: [] })),
      supplyChainApi.getSupplyChain().catch(() => ({ data: [] })),
      auditApi.getAuditLog().catch(() => ({ data: [] })),
      notificationsApi.getNotifications().catch(() => ({ data: [] })),
      calculatorApi.getCalcNorms().catch(() => ({ data: [] })),
      dashboardApi.getMapDistricts().catch(() => ({ data: [] }))
    ]);

    MOCK_USERS.length = 0;
    MOCK_USERS.push(...(users.data || []));

    if (kpi.data && Object.keys(kpi.data).length) {
      Object.assign(MOCK_KPI, kpi.data);
    }

    MOCK_TOP_FERTILIZERS.length = 0;
    MOCK_TOP_FERTILIZERS.push(...(topF.data || []));

    MOCK_TOP_PESTICIDES.length = 0;
    MOCK_TOP_PESTICIDES.push(...(topP.data || []));

    MOCK_REPORTS.length = 0;
    MOCK_REPORTS.push(...(reports.data || []));

    MOCK_FERTILIZERS_REF.length = 0;
    MOCK_FERTILIZERS_REF.push(...(fertRef.data || []));

    MOCK_PESTICIDES_REF.length = 0;
    MOCK_PESTICIDES_REF.push(...(pestRef.data || []));

    MOCK_DOCUMENTS.length = 0;
    MOCK_DOCUMENTS.push(...(docs.data || []));

    MOCK_SUPPLY_CHAIN.length = 0;
    MOCK_SUPPLY_CHAIN.push(...(sc.data || []));

    MOCK_AUDIT_LOG.length = 0;
    MOCK_AUDIT_LOG.push(...(audit.data || []));

    MOCK_NOTIFICATIONS.length = 0;
    MOCK_NOTIFICATIONS.push(...(notif.data || []));
    
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
    Object.assign(CALC_NORMS, calcNormsObj);
    
    MOCK_MAP_DISTRICTS.length = 0;
    MOCK_MAP_DISTRICTS.push(...(mapDistricts.data || []));
  } catch (error) {
    console.error("Failed to load data from json-server", error);
  }
};
