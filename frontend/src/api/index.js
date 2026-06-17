import backendClient from './backendClient';

export const documentsApi = {
  getDocuments: () => Promise.resolve({
    data: [
      {
        id: "1",
        name: "Счёт-фактура_Компания7_2024_01.xlsx",
        date: "2024-01-15",
        status: "verified",
        alert: false
      },
      {
        id: "2",
        name: "Счёт-фактура_Компания8_2024_02.xlsx",
        date: "2024-02-08",
        status: "discrepancy",
        alert: true
      },
      {
        id: "3",
        name: "Счёт-фактура_Компания3_2024_03.xlsx",
        date: "2024-03-22",
        status: "verified",
        alert: false
      },
      {
        id: "4",
        name: "Счёт-фактура_Компания9_2024_04.xlsx",
        date: "2024-04-10",
        status: "pending",
        alert: false
      }
    ]
  }),
};

export const supplyChainApi = {
  getSupplyChain: () => backendClient.get('/supplyChain').catch(() => ({ data: [] })),
};

export const calculatorApi = {
  getCalcNorms: () => backendClient.get('/calcNorms').catch(() => ({ data: [] })),
};

export const authApi = {
  getUsers: () => Promise.resolve({ data: [] }),
};

export const auditApi = {
  getAuditLog: () => backendClient.get('/auditLog').catch(() => ({ data: [] })),
  createAuditLog: (logEntry) => backendClient.post('/auditLog', logEntry).catch(() => ({ data: {} })),
};

export const notificationsApi = {
  getNotifications: () => Promise.resolve({
    data: [
      {
        id: "1",
        type: "warning",
        text: "Превышен объём поставки удобрений в регионе: Регион 1",
        read: false
      },
      {
        id: "2",
        type: "success",
        text: "Отчёт за 2024 год успешно сформирован",
        read: false
      },
      {
        id: "3",
        type: "error",
        text: "Выявлена счёт-фактура без фактической поставки: Компания 7",
        read: false
      },
      {
        id: "4",
        type: "info",
        text: "Обновлены нормы применения удобрений на 2025 год",
        read: true
      },
      {
        id: "5",
        type: "warning",
        text: "Истекает срок действия лицензии пестицида Пестицид 1",
        read: true
      }
    ]
  }),
};
