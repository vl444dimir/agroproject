import backendClient from './backendClient';

/**
 * API для универсального импорта данных из Excel.
 *
 * Эндпоинты:
 *   GET  /import/metadata/:entity   — метаданные полей сущности
 *   POST /import/analyze/:entity    — «сухой запуск» (анализ + поиск дубликатов)
 *   POST /import/execute/:entity    — финальный импорт с разрешениями конфликтов
 */
export const importApi = {

  /** Получить список доступных для импорта сущностей */
  getEntities: () =>
    backendClient.get('/import/entities').catch(() => ({
      data: [
        { value: 'product', label: 'Продукты' },
        { value: 'category', label: 'Категории' },
        { value: 'culture', label: 'Культуры' },
        { value: 'district', label: 'Районы' },
        { value: 'fertilizer', label: 'Удобрения' },
        { value: 'pesticide', label: 'Пестициды' },
        { value: 'report', label: 'Отчёты и аналитика' },
        { value: 'document', label: 'Документы' },
        { value: 'supplyChain', label: 'Цепочки поставок' },
      ],
    })),

  /** Получить метаданные полей для выбранной сущности */
  getMetadata: (entityName) =>
    backendClient.get(`/import/metadata/${entityName}`),

  /**
   * Отправить файл + маппинг на анализ (сухой запуск).
   * Возвращает отчёт: total, ready, duplicates, errors, conflicts[].
   */
  analyze: (entityName, file, mapping, strategy) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('mapping', JSON.stringify(mapping));
    formData.append('strategy', strategy);
    return backendClient.post(`/import/analyze/${entityName}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60000,
    });
  },

  /**
   * Выполнить финальный импорт.
   * @param {string} entityName
   * @param {File}   file
   * @param {Object} mapping          — { dbField: excelColumn }
   * @param {string} strategy         — SKIP | UPDATE | REPLACE
   * @param {Array}  resolutions      — решения по конфликтным строкам
   */
  execute: (entityName, file, mapping, strategy, resolutions) => {
    const formData = new FormData();
    formData.append('file', file);
    
    const requestPayload = {
      mapping: mapping,
      strategy: strategy === 'REPLACE' ? 'REPLACE_ALL' : strategy,
      rowDecisions: resolutions
    };
    formData.append('request', JSON.stringify(requestPayload));

    return backendClient.post(`/import/execute/${entityName}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000,
    });
  },
};
