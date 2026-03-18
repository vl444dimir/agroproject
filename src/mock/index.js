export const MOCK_USERS = [
  { id: 1, login: 'admin', password: 'admin123', role: 'admin', name: 'Администратор' },
  { id: 2, login: 'employee', password: 'emp123', role: 'employee', name: 'Сотрудник Иванов А.' },
  { id: 3, login: 'user', password: 'user123', role: 'user', name: 'Пользователь Петров Б.' }
];

export const MOCK_KPI = {
  landArea: '2 400 000',
  harvest: '18.3',
  fertilizers: '45 200',
  subsidies: '2 100 000 000'
};

export const MOCK_TOP_FERTILIZERS = [
  { name: 'Аммиачная селитра', volume: 12400 },
  { name: 'Карбамид', volume: 9800 },
  { name: 'Суперфосфат', volume: 8100 },
  { name: 'Калий хлористый', volume: 7200 },
  { name: 'Диаммофос', volume: 6500 },
  { name: 'Нитроаммофоска', volume: 5900 },
  { name: 'Аммофос', volume: 5100 },
  { name: 'Сульфат аммония', volume: 4300 },
  { name: 'Кальциевая селитра', volume: 3800 },
  { name: 'Мочевина', volume: 3200 }
];

export const MOCK_TOP_PESTICIDES = [
  { name: 'Раундап', volume: 8900 },
  { name: 'Децис', volume: 7400 },
  { name: 'Би-58', volume: 6800 },
  { name: 'Каратэ', volume: 5600 },
  { name: 'Фастак', volume: 4900 },
  { name: 'Актара', volume: 4200 },
  { name: 'Конфидор', volume: 3800 },
  { name: 'Топаз', volume: 3100 },
  { name: 'Фундазол', volume: 2700 },
  { name: 'Байлетон', volume: 2300 }
];

export const MOCK_REPORTS = [
  { id:1, district:'Акмолинская', crop:'Пшеница', area:45000, harvest:22.1, fertilizers:1200, pesticides:890, year:2024 },
  { id:2, district:'Костанайская', crop:'Ячмень', area:38000, harvest:19.4, fertilizers:980, pesticides:720, year:2024 },
  { id:3, district:'Северо-Казахстанская', crop:'Пшеница', area:52000, harvest:24.3, fertilizers:1450, pesticides:1100, year:2024 },
  { id:4, district:'Павлодарская', crop:'Подсолнечник', area:28000, harvest:16.8, fertilizers:750, pesticides:580, year:2024 },
  { id:5, district:'Карагандинская', crop:'Кукуруза', area:19000, harvest:31.2, fertilizers:620, pesticides:430, year:2024 },
  { id:6, district:'Акмолинская', crop:'Рапс', area:15000, harvest:14.5, fertilizers:480, pesticides:390, year:2023 },
  { id:7, district:'Костанайская', crop:'Пшеница', area:41000, harvest:20.8, fertilizers:1100, pesticides:850, year:2023 },
  { id:8, district:'Северо-Казахстанская', crop:'Ячмень', area:35000, harvest:18.9, fertilizers:920, pesticides:680, year:2023 },
  { id:9, district:'Павлодарская', crop:'Пшеница', area:48000, harvest:21.5, fertilizers:1280, pesticides:960, year:2022 },
  { id:10, district:'Карагандинская', crop:'Подсолнечник', area:22000, harvest:15.3, fertilizers:680, pesticides:510, year:2022 }
];

export const MOCK_FERTILIZERS_REF = [
  { id:1, name:'Аммиачная селитра', composition:'N 34%', norm:'150-200 кг/га', price:180000, manufacturer:'КазАзот' },
  { id:2, name:'Карбамид', composition:'N 46%', norm:'100-150 кг/га', price:210000, manufacturer:'КарбоХим' },
  { id:3, name:'Суперфосфат', composition:'P2O5 20%', norm:'200-300 кг/га', price:145000, manufacturer:'ФосАгро' },
  { id:4, name:'Калий хлористый', composition:'K2O 60%', norm:'80-120 кг/га', price:165000, manufacturer:'Уралкалий' },
  { id:5, name:'Диаммофос', composition:'N 18%, P2O5 46%', norm:'100-150 кг/га', price:230000, manufacturer:'ЕвроХим' }
];

export const MOCK_PESTICIDES_REF = [
  { id:1, name:'Раундап', composition:'Глифосат 360 г/л', norm:'2-4 л/га', price:3200, manufacturer:'Монсанто' },
  { id:2, name:'Децис', composition:'Дельтаметрин 25 г/л', norm:'0.3-0.5 л/га', price:8900, manufacturer:'Байер' },
  { id:3, name:'Би-58', composition:'Диметоат 400 г/л', norm:'0.5-1.0 л/га', price:4100, manufacturer:'БАСФ' },
  { id:4, name:'Каратэ', composition:'Лямбда-цигалотрин 50 г/л', norm:'0.2-0.4 л/га', price:7600, manufacturer:'Сингента' },
  { id:5, name:'Актара', composition:'Тиаметоксам 250 г/л', norm:'0.1-0.2 л/га', price:12400, manufacturer:'Сингента' }
];

export const MOCK_DOCUMENTS = [
  { id:1, name:'Счёт-фактура_АгроСевер_2024_01.xlsx', date:'2024-01-15', status:'verified', alert: false },
  { id:2, name:'Счёт-фактура_КазУдобрения_2024_02.xlsx', date:'2024-02-08', status:'discrepancy', alert: true },
  { id:3, name:'Счёт-фактура_ФосАгро_2024_03.xlsx', date:'2024-03-22', status:'verified', alert: false },
  { id:4, name:'Счёт-фактура_АгроХим_2024_04.xlsx', date:'2024-04-10', status:'pending', alert: false }
];

export const MOCK_SUPPLY_CHAIN = [
  { supplier:'ТОО КазАзот', intermediary1:'ТОО АгроТрейд', intermediary2:'ИП Сейткали', buyer:'СПК Акмола', markupTotal: 42 },
  { supplier:'АО ФосАгро-КЗ', intermediary1:'ТОО ХимПром', intermediary2: null, buyer:'ТОО АгроСевер', markupTotal: 28 }
];

export let MOCK_AUDIT_LOG = [
  { id:1, datetime:'2024-12-01 09:14', user:'admin', role:'Администратор', action:'Вход в систему', ip:'192.168.1.10', status:'success' },
  { id:2, datetime:'2024-12-01 09:22', user:'employee', role:'Сотрудник', action:'Просмотр отчёта 2024', ip:'192.168.1.14', status:'success' },
  { id:3, datetime:'2024-12-01 10:05', user:'user', role:'Пользователь', action:'Расчёт калькулятора', ip:'192.168.1.21', status:'success' },
  { id:4, datetime:'2024-12-01 11:30', user:'unknown', role:'—', action:'Попытка входа', ip:'185.220.101.5', status:'failed' },
  { id:5, datetime:'2024-12-01 12:15', user:'admin', role:'Администратор', action:'Редактирование справочника', ip:'192.168.1.10', status:'success' },
  { id:6, datetime:'2024-12-02 08:45', user:'employee', role:'Сотрудник', action:'Загрузка счёт-фактуры', ip:'192.168.1.14', status:'success' },
  { id:7, datetime:'2024-12-02 09:30', user:'employee', role:'Сотрудник', action:'Генерация AI анализа', ip:'192.168.1.14', status:'success' },
  { id:8, datetime:'2024-12-02 10:12', user:'user', role:'Пользователь', action:'Экспорт отчёта PDF', ip:'192.168.1.33', status:'success' },
  { id:9, datetime:'2024-12-02 11:00', user:'admin', role:'Администратор', action:'Удаление записи справочника', ip:'192.168.1.10', status:'success' },
  { id:10, datetime:'2024-12-02 14:22', user:'unknown', role:'—', action:'Попытка входа', ip:'91.108.4.12', status:'failed' },
  { id:11, datetime:'2024-12-03 09:05', user:'employee', role:'Сотрудник', action:'Просмотр карты регионов', ip:'192.168.1.14', status:'success' },
  { id:12, datetime:'2024-12-03 10:40', user:'user', role:'Пользователь', action:'Поиск альтернатив пестицидов', ip:'192.168.1.21', status:'success' },
  { id:13, datetime:'2024-12-03 13:15', user:'admin', role:'Администратор', action:'Просмотр журнала аудита', ip:'192.168.1.10', status:'success' },
  { id:14, datetime:'2024-12-04 08:30', user:'employee', role:'Сотрудник', action:'Анализ эффективности удобрений', ip:'192.168.1.14', status:'success' },
  { id:15, datetime:'2024-12-04 15:00', user:'user', role:'Пользователь', action:'Выход из системы', ip:'192.168.1.21', status:'success' }
];

export let MOCK_NOTIFICATIONS = [
  { id:1, type:'warning', text:'Превышен объём поставки удобрений в Акмолинской области', read: false },
  { id:2, type:'success', text:'Отчёт за 2024 год успешно сформирован', read: false },
  { id:3, type:'error', text:'Выявлена счёт-фактура без фактической поставки: ТОО Агро-Север', read: false },
  { id:4, type:'info', text:'Обновлены нормы применения удобрений на 2025 год', read: true },
  { id:5, type:'warning', text:'Истекает срок действия лицензии пестицида Раундап', read: true }
];

export const CALC_NORMS = {
  'Пшеница':      { fertilizer:'Аммиачная селитра', fertNorm:160, pesticide:'Децис',   pestNorm:0.4, pricePerHa:12400 },
  'Ячмень':       { fertilizer:'Карбамид',          fertNorm:130, pesticide:'Каратэ',  pestNorm:0.3, pricePerHa:10800 },
  'Подсолнечник': { fertilizer:'Диаммофос',         fertNorm:140, pesticide:'Актара',  pestNorm:0.15,pricePerHa:14200 },
  'Кукуруза':     { fertilizer:'Нитроаммофоска',    fertNorm:200, pesticide:'Би-58',   pestNorm:0.7, pricePerHa:16500 },
  'Рапс':         { fertilizer:'Суперфосфат',       fertNorm:250, pesticide:'Фастак',  pestNorm:0.25,pricePerHa:11900 }
};

export const MOCK_MAP_DISTRICTS = [
  {
    name: 'Акмолинская область',
    topCrop: 'Пшеница',
    area: '450 000 га',
    coordinates: [[51.5, 68.5],[52.5, 68.5],[52.5, 71.0],[51.5, 71.0]]
  },
  {
    name: 'Костанайская область',
    topCrop: 'Пшеница',
    area: '520 000 га',
    coordinates: [[52.0, 62.0],[53.5, 62.0],[53.5, 65.5],[52.0, 65.5]]
  },
  {
    name: 'Северо-Казахстанская область',
    topCrop: 'Ячмень',
    area: '380 000 га',
    coordinates: [[53.5, 67.0],[54.8, 67.0],[54.8, 70.0],[53.5, 70.0]]
  }
];
