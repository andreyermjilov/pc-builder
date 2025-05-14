const express = require('express');
const { google } = require('googleapis');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();

const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:3000';
const spreadsheetId = process.env.SPREADSHEET_ID;
const keyFilePath = process.env.KEY_FILE_PATH;
const port = process.env.SERVER_PORT || 3001;

app.use(cors({ origin: corsOrigin }));

if (!spreadsheetId || !keyFilePath) {
  console.error('SPREADSHEET_ID и KEY_FILE_PATH должны быть установлены в .env');
  process.exit(1);
}

const auth = new google.auth.GoogleAuth({
  keyFile: path.resolve(__dirname, keyFilePath),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });

const categories = [
  'processor', 'graphicsCard', 'ram', 'storage',
  'motherboard', 'case', 'cooler', 'monitor',
  'powerSupply', 'keyboard', 'mouse', 'operatingSystem',
];

// Кэш на 60 секунд
let cachedComponents = null;
let cachedTemplates = null;
let lastFetchTime = 0;
const CACHE_TTL = 60 * 1000;

const componentSchema = {
  processor: row => ({
    name: row[0] || '', price: +row[1] || 0, description: row[2] || '',
    performance: +row[3] || 0, socket: row[4] || '', power: +row[5] || 0
  }),
  graphicsCard: row => ({
    name: row[0] || '', price: +row[1] || 0, description: row[2] || '',
    performance: +row[3] || 0, power: +row[4] || 0
  }),
  ram: row => ({
    name: row[0] || '', price: +row[1] || 0, description: row[2] || '',
    performance: +row[3] || 0
  }),
  storage: row => ({
    name: row[0] || '', price: +row[1] || 0, description: row[2] || '',
    performance: +row[3] || 0
  }),
  motherboard: row => ({
    name: row[0] || '', price: +row[1] || 0, description: row[2] || '',
    performance: +row[3] || 0, socket: row[4] || '', formFactor: row[5] || ''
  }),
  case: row => ({
    name: row[0] || '', price: +row[1] || 0, description: row[2] || '',
    performance: +row[3] || 0, formFactor: row[4] || ''
  }),
  cooler: row => ({
    name: row[0] || '', price: +row[1] || 0, description: row[2] || '',
    performance: +row[3] || 0, socket: row[4] || ''
  }),
  monitor: row => ({
    name: row[0] || '', price: +row[1] || 0, description: row[2] || '',
    performance: +row[3] || 0, resolution: row[4] || ''
  }),
  powerSupply: row => ({
    name: row[0] || '', price: +row[1] || 0, description: row[2] || '',
    performance: +row[3] || 0, wattage: +row[4] || 0
  }),
  keyboard: row => ({
    name: row[0] || '', price: +row[1] || 0, description: row[2] || '',
    performance: +row[3] || 0, type: row[4] || ''
  }),
  mouse: row => ({
    name: row[0] || '', price: +row[1] || 0, description: row[2] || '',
    performance: +row[3] || 0, type: row[4] || ''
  }),
  operatingSystem: row => ({
    name: row[0] || '', price: +row[1] || 0, description: row[2] || '',
    performance: +row[3] || 0, version: row[4] || ''
  }),
};

// Функция для формирования шаблонов
const generateTemplates = (components, activeCategories) => {
  const getCheapest = (category) => components
    .filter(c => c.category === category && c.price > 0)
    .sort((a, b) => a.price - b.price)[0];

  const getMidRange = (category) => {
    const sorted = components
      .filter(c => c.category === category && c.price > 0)
      .sort((a, b) => a.performance - b.performance);
    return sorted[Math.floor(sorted.length / 2)] || sorted[0];
  };

  const getHighPerformance = (category) => components
    .filter(c => c.category === category && c.price > 0)
    .sort((a, b) => b.performance - a.performance)[0];

  const checkCompatibility = (config) => {
    if (config.motherboard && config.processor && config.motherboard.socket !== config.processor.socket) {
      return false;
    }
    if (config.case && config.motherboard && config.case.formFactor && config.motherboard.formFactor) {
      const caseFormFactors = String(config.case.formFactor).split(',').map(f => f.trim().toLowerCase());
      if (!caseFormFactors.includes(String(config.motherboard.formFactor).trim().toLowerCase())) {
        return false;
      }
    }
    if (config.powerSupply && config.processor) {
      const requiredPower = (config.processor.power || 0) + (config.graphicsCard?.power || 0) + (config.cooler?.power || 0) + 100;
      if (config.powerSupply.wattage < requiredPower) {
        return false;
      }
    }
    return true;
  };

  const templates = [
    {
      id: 'office-pc',
      name: 'Офисный ПК',
      description: 'Самый дешёвый вариант для работы с документами и браузером.',
      components: [
        getCheapest('processor'),
        getCheapest('ram'),
        getCheapest('storage'),
        getCheapest('motherboard'),
        getCheapest('case'),
        getCheapest('powerSupply'),
      ].filter(Boolean),
    },
    {
      id: 'budget-gaming',
      name: 'Бюджетный игровой',
      description: 'Для лёгких игр на низких-средних настройках (CS:GO, Dota 2).',
      components: [
        getMidRange('processor'),
        getCheapest('graphicsCard'),
        getMidRange('ram'),
        getMidRange('storage'),
        getMidRange('motherboard'),
        getMidRange('case'),
        getCheapest('cooler'),
        getMidRange('powerSupply'),
      ].filter(Boolean),
    },
    {
      id: 'optimal-gaming',
      name: 'Оптимальный гейминг',
      description: 'Для современных игр на высоких настройках в 1080p.',
      components: [
        getHighPerformance('processor'),
        getHighPerformance('graphicsCard'),
        getHighPerformance('ram'),
        getHighPerformance('storage'),
        getHighPerformance('motherboard'),
        getHighPerformance('case'),
        getHighPerformance('cooler'),
        getHighPerformance('powerSupply'),
      ].filter(Boolean),
    },
  ];

  return templates
    .map(template => ({
      ...template,
      components: template.components.filter(comp => activeCategories.includes(comp.category)),
    }))
    .filter(template => template.components.length > 0 && checkCompatibility({
      ...template.components.reduce((acc, comp) => ({ ...acc, [comp.category]: comp }), {}),
    }));
};

// Эндпоинт для получения компонентов
app.get('/api/components', async (req, res) => {
  const now = Date.now();
  if (cachedComponents && now - lastFetchTime < CACHE_TTL) {
    console.log('📦 Отдаём кэшированные компоненты');
    return res.json(cachedComponents);
  }

  try {
    const authClient = await auth.getClient();
    const sheetsApi = google.sheets({ version: 'v4', auth: authClient });

    const components = [];
    const erroredSheets = [];

    for (const category of categories) {
      const range = `${category}!A2:Z`;
      console.log(`📄 Чтение вкладки: ${category}`);

      try {
        const response = await sheetsApi.spreadsheets.values.get({ spreadsheetId, range });
        const rows = response.data.values || [];

        if (!rows.length) {
          console.warn(`⚠️ Вкладка ${category} пуста.`);
          continue;
        }

        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          try {
            const parser = componentSchema[category];
            if (!parser) continue;

            const component = parser(row);
            component.category = category;

            if (component.name && component.price > 0) {
              components.push(component);
            } else {
              console.warn(`⛔ Пропущен компонент (пустое имя или цена) в ${category} строка ${i + 2}`);
            }
          } catch (parseErr) {
            console.error(`❌ Ошибка разбора строки ${i + 2} в ${category}:`, parseErr.message);
          }
        }
      } catch (err) {
        console.error(`❌ Ошибка чтения вкладки ${category}:`, err.message);
        erroredSheets.push(category);
      }
    }

    console.log(`✅ Всего компонентов: ${components.length}`);
    if (erroredSheets.length) {
      console.warn(`⚠️ Ошибки во вкладках: ${erroredSheets.join(', ')}`);
    }

    // Кэшируем компоненты
    cachedComponents = components;
    lastFetchTime = Date.now();

    res.json(components);
  } catch (err) {
    console.error('❌ Внутренняя ошибка сервера:', err.message);
    res.status(500).json({ error: 'Ошибка при получении компонентов' });
  }
});

// Новый эндпоинт для получения шаблонов
app.get('/api/templates', async (req, res) => {
  const now = Date.now();
  if (cachedTemplates && now - lastFetchTime < CACHE_TTL) {
    console.log('📦 Отдаём кэшированные шаблоны');
    return res.json(cachedTemplates);
  }

  try {
    const authClient = await auth.getClient();
    const sheetsApi = google.sheets({ version: 'v4', auth: authClient });

    const components = [];
    const erroredSheets = [];

    for (const category of categories) {
      const range = `${category}!A2:Z`;
      console.log(`📄 Чтение вкладки для шаблонов: ${category}`);

      try {
        const response = await sheetsApi.spreadsheets.values.get({ spreadsheetId, range });
        const rows = response.data.values || [];

        if (!rows.length) {
          console.warn(`⚠️ Вкладка ${category} пуста.`);
          continue;
        }

        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          try {
            const parser = componentSchema[category];
            if (!parser) continue;

            const component = parser(row);
            component.category = category;

            if (component.name && component.price > 0) {
              components.push(component);
            } else {
              console.warn(`⛔ Пропущен компонент (пустое имя или цена) в ${category} строка ${i + 2}`);
            }
          } catch (parseErr) {
            console.error(`❌ Ошибка разбора строки ${i + 2} в ${category}:`, parseErr.message);
          }
        }
      } catch (err) {
        console.error(`❌ Ошибка чтения вкладки ${category}:`, err.message);
        erroredSheets.push(category);
      }
    }

    if (components.length === 0) {
      console.error('❌ Нет компонентов для формирования шаблонов');
      return res.status(500).json({ error: 'Нет доступных компонентов для шаблонов' });
    }

    // Формируем шаблоны
    const activeCategories = categories.filter(cat => cat !== 'operatingSystem');
    const templates = generateTemplates(components, activeCategories);

    console.log(`✅ Сформировано шаблонов: ${templates.length}`);
    if (erroredSheets.length) {
      console.warn(`⚠️ Ошибки во вкладках: ${erroredSheets.join(', ')}`);
    }

    // Кэшируем шаблоны
    cachedTemplates = templates;
    lastFetchTime = Date.now();

    res.json(templates);
  } catch (err) {
    console.error('❌ Внутренняя ошибка сервера при получении шаблонов:', err.message);
    res.status(500).json({ error: 'Ошибка при получении шаблонов' });
  }
});

app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Сервер работает на http://localhost:${port}`);
});
