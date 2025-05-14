import React, { useEffect, useState, useCallback, useMemo } from 'react';

// Объект с переводами категорий на русский язык
const categoryTranslations = {
  processor: 'Процессор',
  graphicsCard: 'Видеокарта',
  ram: 'Оперативная память',
  storage: 'Накопитель',
  motherboard: 'Материнская плата',
  case: 'Корпус',
  cooler: 'Кулер',
  monitor: 'Монитор',
  powerSupply: 'Блок питания',
  keyboard: 'Клавиатура',
  mouse: 'Мышь',
  operatingSystem: 'Операционная система',
};

const API_BASE_URL = 'https://pc-builder-backend-24zh.onrender.com';

function PCBuilder() {
  const [components, setComponents] = useState([]);
  const [budget, setBudget] = useState('');
  const [configurations, setConfigurations] = useState([]);
  const [closestConfigs, setClosestConfigs] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [filterClicked, setFilterClicked] = useState(false);

  const [selectedCategories, setSelectedCategories] = useState(
    Object.keys(categoryTranslations).reduce((acc, key) => {
      acc[key] = key !== 'operatingSystem'; // Исключаем операционную систему
      return acc;
    }, {})
  );

  const categories = Object.keys(categoryTranslations);
  const activeCategories = categories.filter(category => selectedCategories[category] && category !== 'operatingSystem');

  // Нормализация данных
  const normalizeComponent = (item) => {
    const normalized = {
      ...item,
      category: item.category ? item.category.trim() : '',
      price: Number(item.price) || 0,
      socket: item.socket ? String(item.socket).trim() : '',
      power: Number(item.power) || 0,
      formFactor: item.formFactor ? String(item.formFactor).trim() : '',
      resolution: item.resolution ? item.resolution.trim() : '',
      wattage: Number(item.wattage) || 0,
      type: item.type ? item.type.trim() : '',
      version: item.version ? item.version.trim() : '',
      frequency: Number(item.frequency) || 0,
      cores: Number(item.cores) || 0,
      ramType: item.ramType ? String(item.ramType).trim() : '',
      supportedInterfaces: item.supportedInterfaces ? String(item.supportedInterfaces).trim() : '',
      pcieVersion: item.pcieVersion ? String(item.pcieVersion).trim() : '',
      interface: item.interface ? String(item.interface).trim() : '',
      memory: Number(item.memory) || 0,
      capacity: Number(item.capacity) || 0,
      supportedFormFactors: item.supportedFormFactors ? String(item.supportedFormFactors).trim() : item.formFactor || '',
    };
    return normalized;
  };

  // Вычисление score для компонента
  const calculateComponentScore = (component) => {
    if (component.category === 'processor') return (Number(component.frequency) || 0) * 10 + (Number(component.cores) || 0) * 5;
    if (component.category === 'graphicsCard') return (Number(component.memory) || 0) * 10;
    if (component.category === 'ram') return (Number(component.frequency) || 0) / 100 + (Number(component.capacity) || 0);
    return 1;
  };

  // Вычисление score для конфигурации
  const calculateConfigScore = (config) => {
    let score = 0;
    if (config.processor) score += (Number(config.processor.frequency) || 0) * 10 + (Number(config.processor.cores) || 0) * 5;
    if (config.graphicsCard) score += (Number(config.graphicsCard.memory) || 0) * 10;
    if (config.ram) score += (Number(config.ram.frequency) || 0) / 100 + (Number(config.ram.capacity) || 0);
    return score;
  };

  // Загрузка компонентов с API
  useEffect(() => {
    const API_URL = `${API_BASE_URL}/api/components`;
    const fetchComponents = async (attempt = 1, maxAttempts = 5) => {
      setLoading(true);
      setError(null);
      try {
        console.log(`Попытка загрузки компонентов (${attempt}/${maxAttempts}) с ${API_URL}...`);
        const response = await fetch(API_URL, {
          signal: AbortSignal.timeout(15000),
        });
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: `HTTP ошибка: ${response.status} ${response.statusText}` }));
          throw new Error(errorData.error || `HTTP ошибка: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        console.log('Загруженные компоненты (raw):', data);
        if (!Array.isArray(data) || data.length === 0) {
          setError('Нет доступных компонентов с сервера. Проверьте данные в Google Sheets или настройки сервера.');
          setComponents([]);
          return;
        }
        const normalizedData = data
          .map(normalizeComponent)
          .filter(item => item.category && item.price > 0 && item.name);
        console.log('Нормализованные и отфильтрованные компоненты:', normalizedData);
        
        if (normalizedData.length === 0) {
          setError('После нормализации компоненты отсутствуют. Проверьте формат данных в Google Sheets или логи сервера.');
          setComponents([]);
          return;
        }
        setComponents(normalizedData);
      } catch (err) {
        console.error('Ошибка загрузки:', err.message);
        if (attempt < maxAttempts && err.name !== 'AbortError') {
          console.log(`Повторная попытка ${attempt + 1}/${maxAttempts} через 3 секунды...`);
          setTimeout(() => fetchComponents(attempt + 1, maxAttempts), 3000);
        } else {
          setError(`Ошибка загрузки данных: ${err.message}. Проверьте подключение к серверу по ${API_URL} и его логи.`);
          setComponents([]);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchComponents();
  }, []);

  const handleCategoryToggle = (category) => {
    setSelectedCategories(prev => ({
      ...prev,
      [category]: !prev[category],
    }));
    setFilterClicked(false);
  };

  // Проверка совместимости
  const checkCompatibility = (category, component, currentConfig) => {
    const reasons = [];
    if (category === 'motherboard' && currentConfig.processor && selectedCategories.motherboard && selectedCategories.processor) {
      if (component.socket !== currentConfig.processor.socket) {
        reasons.push(`Материнская плата ${component.name} (сокет: ${component.socket}) несовместима с процессором ${currentConfig.processor.name} (сокет: ${currentConfig.processor.socket})`);
        return { isCompatible: false, reasons };
      }
    }
    if (category === 'ram' && currentConfig.motherboard && selectedCategories.ram && selectedCategories.motherboard) {
      if (!component.ramType || !currentConfig.motherboard.ramType || component.ramType !== currentConfig.motherboard.ramType) {
        reasons.push(`Оперативная память ${component.name} (тип: ${component.ramType || 'неизвестно'}) несовместима с материнской платой ${currentConfig.motherboard.name} (тип: ${currentConfig.motherboard.ramType || 'неизвестно'})`);
        return { isCompatible: false, reasons };
      }
    }
    if (category === 'storage' && currentConfig.motherboard && selectedCategories.storage && selectedCategories.motherboard) {
      if (!component.interface || !currentConfig.motherboard.supportedInterfaces) {
        reasons.push(`Накопитель ${component.name} не имеет интерфейса или материнская плата ${currentConfig.motherboard.name} не имеет поддерживаемых интерфейсов`);
        return { isCompatible: false, reasons };
      }
      const supported = currentConfig.motherboard.supportedInterfaces.split(',').map(s => s.trim());
      if (!supported.includes(component.interface)) {
        reasons.push(`Накопитель ${component.name} (интерфейс: ${component.interface}) несовместим с материнской платой ${currentConfig.motherboard.name} (поддерживаемые: ${supported.join(', ')})`);
        return { isCompatible: false, reasons };
      }
    }
    if (category === 'graphicsCard' && currentConfig.motherboard && selectedCategories.graphicsCard && selectedCategories.motherboard && component.pcieVersion && currentConfig.motherboard.pcieVersion) {
      if (parseFloat(component.pcieVersion) > parseFloat(currentConfig.motherboard.pcieVersion)) {
        reasons.push(`Видеокарта ${component.name} (PCIe: ${component.pcieVersion}) требует более новую версию PCIe, чем материнская плата ${currentConfig.motherboard.name} (PCIe: ${currentConfig.motherboard.pcieVersion})`);
        return { isCompatible: false, reasons };
      }
    }
    if (category === 'cooler' && currentConfig.processor && selectedCategories.cooler && selectedCategories.processor) {
      const coolerSockets = String(component.socket).split(',').map(s => s.trim());
      if (!coolerSockets.includes(currentConfig.processor.socket)) {
        reasons.push(`Кулер ${component.name} (сокеты: ${component.socket}) несовместим с процессором ${currentConfig.processor.name} (сокет: ${currentConfig.processor.socket})`);
        return { isCompatible: false, reasons };
      }
    }
    if (category === 'powerSupply' && selectedCategories.powerSupply && currentConfig.processor && selectedCategories.processor) {
      const requiredPower = (Number(currentConfig.processor.power) || 0) + (Number(currentConfig.graphicsCard?.power) || 0) + 100;
      if (Number(component.wattage) < requiredPower) {
        reasons.push(`Блок питания ${component.name} (мощность: ${component.wattage}W) недостаточен для требуемых ${requiredPower}W (CPU: ${currentConfig.processor.power}W, GPU: ${currentConfig.graphicsCard?.power || 0}W)`);
        return { isCompatible: false, reasons };
      }
    }
    if (category === 'case' && currentConfig.motherboard && selectedCategories.case && selectedCategories.motherboard) {
      const caseFormFactors = String(component.supportedFormFactors || component.formFactor).split(',').map(f => f.trim().toLowerCase());
      if (!caseFormFactors.includes(String(currentConfig.motherboard.formFactor).trim().toLowerCase())) {
        reasons.push(`Корпус ${component.name} (поддерживаемые форм-факторы: ${component.supportedFormFactors || component.formFactor}) несовместим с материнской платой ${currentConfig.motherboard.name} (форм-фактор: ${currentConfig.motherboard.formFactor})`);
        return { isCompatible: false, reasons };
      }
    }
    return { isCompatible: true, reasons };
  };

  // Формирование шаблонов
  const predefinedTemplates = useMemo(() => {
    if (!components.length) return [];

    const getCheapest = (category) => components
      .filter(c => c.category === category && c.price > 0)
      .sort((a, b) => a.price - b.price)[0];

    const getMidRange = (category) => {
      const sorted = components
        .filter(c => {
          if (category === 'processor' && selectedCategories.graphicsCard) {
            return (Number(c.frequency) || 0) >= 4.0 && (Number(c.cores) || 0) >= 4;
          }
          return c.category === category && c.price > 0;
        })
        .sort((a, b) => {
          const scoreA = calculateComponentScore(a);
          const scoreB = calculateComponentScore(b);
          return (scoreB / (Number(b.price) || 1)) - (scoreA / (Number(a.price) || 1));
        });
      return sorted[Math.floor(sorted.length / 2)] || sorted[0];
    };

    const getHighPerformance = (category) => {
      const sorted = components
        .filter(c => {
          if (category === 'processor' && selectedCategories.graphicsCard) {
            return (Number(c.frequency) || 0) >= 4.0 && (Number(c.cores) || 0) >= 4;
          }
          return c.category === category && c.price > 0;
        })
        .sort((a, b) => calculateComponentScore(b) - calculateComponentScore(a));
      return sorted[0];
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
      .filter(template => {
        const config = template.components.reduce((acc, comp) => ({ ...acc, [comp.category]: comp }), {});
        return template.components.length > 0 && Object.entries(config).every(([cat, comp]) => 
          comp && checkCompatibility(cat, comp, config).isCompatible
        );
      });
  }, [components, activeCategories, selectedCategories]);

  // Генерация комбинаций
  const generateCombinations = useCallback((componentsByCategory, maxBudget, currentActiveCategories) => {
    console.log('Бюджет:', maxBudget);
    console.log('Доступные процессоры:', componentsByCategory.processor?.map(p => ({
      name: p.name,
      price: p.price,
      socket: p.socket,
      frequency: p.frequency,
      cores: p.cores,
      score: calculateComponentScore(p)
    })) || []);
    console.log('Доступные материнские платы:', componentsByCategory.motherboard?.map(m => ({
      name: m.name,
      price: m.price,
      socket: m.socket,
      ramType: m.ramType,
      supportedInterfaces: m.supportedInterfaces,
      pcieVersion: m.pcieVersion
    })) || []);

    const results = [];
    const maxCombinations = 10000;

    const buildConfig = (currentConfig, categoryIndex, totalPrice, totalScore) => {
      if (results.length >= maxCombinations) {
        console.warn('Достигнут лимит комбинаций:', results.length);
        return;
      }
      if (totalPrice > maxBudget + 100000) {
        return;
      }
      if (categoryIndex >= currentActiveCategories.length) {
        if (totalPrice > 0 && totalPrice <= maxBudget + 100000 && totalScore >= (selectedCategories.graphicsCard ? 100 : 50)) {
          results.push({ ...currentConfig, totalPrice, totalScore });
        }
        return;
      }

      const category = currentActiveCategories[categoryIndex];
      const currentCategoryComponents = componentsByCategory[category] || [];

      if (currentCategoryComponents.length === 0) {
        buildConfig(currentConfig, categoryIndex + 1, totalPrice, totalScore);
        return;
      }

      currentCategoryComponents
        .filter(component => {
          if (category === 'processor' && selectedCategories.graphicsCard) {
            return (Number(component.frequency) || 0) >= 4.0 && (Number(component.cores) || 0) >= 4;
          }
          return true;
        })
        .sort((a, b) => {
          const scoreA = calculateComponentScore(a);
          const scoreB = calculateComponentScore(b);
          return (scoreB / (Number(b.price) || 1)) - (scoreA / (Number(a.price) || 1));
        })
        .forEach(component => {
          const { isCompatible, reasons } = checkCompatibility(category, component, currentConfig);
          if (!isCompatible) {
            console.log(`Исключён ${category}: ${component.name} (${component.price} ₸) из-за:`, reasons);
            return;
          }

          const newPrice = totalPrice + component.price;
          const newScore = totalScore + calculateComponentScore(component);

          buildConfig(
            { ...currentConfig, [category]: component },
            categoryIndex + 1,
            newPrice,
            newScore
          );
        });
    };

    buildConfig({}, 0, 0, 0);
    console.log(`Сгенерировано ${results.length} конфигураций`);
    return results;
  }, [selectedCategories]);

  const handleFilter = () => {
    setFilterClicked(true);
    const maxBudget = parseInt(budget);
    if (isNaN(maxBudget) || maxBudget <= 0) {
      setError('Пожалуйста, введите корректный положительный бюджет.');
      setConfigurations([]);
      setClosestConfigs([]);
      return;
    }
    setError(null);
    setLoading(true);
    setConfigurations([]);
    setClosestConfigs([]);

    console.log('Все компоненты перед фильтрацией:', components);
    console.log('Бюджет:', maxBudget);
    console.log('Выбранные категории (для фильтрации):', activeCategories);

    if (!components.length) {
      setError('Компоненты не загружены. Проверьте подключение к серверу или обновите страницу.');
      setLoading(false);
      return;
    }

    if (activeCategories.length === 0) {
      setError('Выберите хотя бы одну категорию компонентов.');
      setLoading(false);
      return;
    }

    const selectedComponents = activeCategories.reduce((acc, category) => {
      acc[category] = components.filter(item => {
        return item.category === category && item.price > 0;
      });
      if (acc[category].length === 0) {
        console.warn(`Нет компонентов для категории ${category} после первичной фильтрации.`);
      }
      return acc;
    }, {});

    const hasAnyComponentsForActiveCategories = activeCategories.some(category => selectedComponents[category] && selectedComponents[category].length > 0);
    if (!hasAnyComponentsForActiveCategories && activeCategories.length > 0) {
      const emptyActiveCategories = activeCategories.filter(cat => !selectedComponents[cat] || selectedComponents[cat].length === 0);
      setError(
        `Не удалось найти компоненты для выбранных категорий: ${emptyActiveCategories
          .map(cat => categoryTranslations[cat])
          .join(', ')}. Попробуйте изменить выбор категорий.`
      );
      setLoading(false);
      return;
    }

    setTimeout(() => {
      const allGeneratedConfigs = generateCombinations(selectedComponents, maxBudget, activeCategories);
      
      const fullConfigs = allGeneratedConfigs.filter(config => config.totalPrice <= maxBudget);
      const tempClosestConfigs = allGeneratedConfigs.filter(
        config => config.totalPrice > maxBudget && config.totalPrice <= maxBudget + 100000
      );

      setConfigurations(
        fullConfigs
          .sort((a, b) => b.totalScore - a.totalScore || a.totalPrice - b.totalPrice)
          .slice(0, 5)
      );
      setClosestConfigs(
        tempClosestConfigs
          .sort((a, b) => b.totalScore - a.totalScore || a.totalPrice - b.totalPrice)
          .slice(0, 3)
      );
      setLoading(false);
    }, 500);
  };

  // Вычисление статистики шаблона
  const calculateTemplateStats = (template) => {
    const totalPrice = template.components.reduce((sum, comp) => sum + (comp.price || 0), 0);
    const totalScore = template.components.reduce((sum, comp) => sum + calculateComponentScore(comp), 0);
    return { totalPrice, totalScore };
  };

  // JSX рендеринг
  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-6">
      <div className="max-w-4xl mx-auto bg-white shadow-lg rounded-lg p-6">
        <h1 className="text-3xl font-bold mb-6 text-center text-gray-700">🛠️ Подбор Конфигурации ПК</h1>

        {/* Выбор категорий */}
        <div className="mb-6 p-4 border border-blue-200 rounded-md bg-blue-50">
          <h3 className="text-lg font-semibold mb-3 text-blue-700">1. Выберите компоненты:</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {categories.map(category => (
              <label
                key={category}
                className={`flex items-center space-x-2 p-2 rounded transition-colors cursor-pointer ${
                  !components.some(item => item.category === category) ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-100'
                }`}
                title={!components.some(item => item.category === category) ? 'Компоненты для этой категории недоступны' : ''}
              >
                <input
                  type="checkbox"
                  checked={!!selectedCategories[category]}
                  onChange={() => handleCategoryToggle(category)}
                  disabled={!components.some(item => item.category === category)}
                  className="form-checkbox h-5 w-5 text-blue-600 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">{categoryTranslations[category]}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Поле ввода бюджета */}
        <div className="mb-6 p-4 border border-green-200 rounded-md bg-green-50">
          <h3 className="text-lg font-semibold mb-3 text-green-700">2. Укажите бюджет:</h3>
          <div className="flex flex-col sm:flex-row items-center space-y-3 sm:space-y-0 sm:space-x-4">
            <input
              type="number"
              placeholder="Бюджет в тенге (например, 300000)"
              value={budget}
              onChange={e => {
                setBudget(e.target.value);
                setFilterClicked(false);
              }}
              className="border border-gray-300 rounded px-4 py-2 w-full focus:ring-green-500 focus:border-green-500"
              min="0"
            />
            <button
              onClick={handleFilter}
              className="w-full sm:w-auto bg-green-600 text-white px-8 py-2.5 rounded-md hover:bg-green-700 transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50 font-semibold"
              disabled={loading}
            >
              {loading ? 'Подбираем...' : 'Подобрать'}
            </button>
          </div>
        </div>

        {/* Индикатор загрузки */}
        {loading && (
          <div className="flex justify-center items-center my-8">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            <p className="ml-3 text-blue-600 text-lg">Идет подбор конфигураций...</p>
          </div>
        )}

        {/* Отображение ошибок */}
        {error && (
          <div className="my-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-md text-center">
            <p className="font-semibold">Ошибка!</p>
            <p>{error}</p>
          </div>
        )}

        {/* Сообщение "Ничего не найдено" */}
        {!loading && !error && filterClicked && configurations.length === 0 && closestConfigs.length === 0 && (
          <div className="my-6 p-4 bg-yellow-100 border border-yellow-400 text-yellow-700 rounded-md text-center">
            <p className="font-semibold">Ничего не найдено</p>
            <p>По вашему бюджету и выбранным компонентам не удалось составить ни одной конфигурации. Попробуйте изменить бюджет или набор компонентов.</p>
          </div>
        )}

        {/* Предопределённые шаблоны */}
        {!loading && !error && !filterClicked && !budget && predefinedTemplates.length > 0 && (
          <div className="mt-8">
            <h2 className="text-2xl font-bold mb-4 text-gray-700">📋 Готовые сборки для ваших задач:</h2>
            {predefinedTemplates.map((template, index) => {
              const { totalPrice, totalScore } = calculateTemplateStats(template);
              return (
                <div
                  key={`template-${index}`}
                  className="mb-6 p-4 border border-purple-200 rounded-lg bg-purple-50 shadow hover:shadow-md transition-shadow"
                >
                  <h3 className="text-xl font-semibold text-purple-600 mb-2">{template.name}</h3>
                  <p className="text-sm text-gray-600 mb-3">{template.description}</p>
                  <ul className="space-y-1">
                    {activeCategories.map((category, i) => {
                      const component = template.components.find(comp => comp.category === category);
                      return component ? (
                        <li key={`${category}-${i}-template`} className="text-sm">
                          <strong className="text-gray-600">{categoryTranslations[category]}:</strong> {component.name}{' '}
                          {component.description && <span className="italic text-gray-500">({component.description})</span>}
                        </li>
                      ) : null;
                    })}
                  </ul>
                  <p className="font-bold text-md mt-3 text-green-600">
                    Общая стоимость: {totalPrice.toLocaleString()} ₸
                  </p>
                  <p className="text-sm text-gray-500">
                    Производительность: {totalScore} (усл. ед.)
                  </p>
                </div>
              );
            })}
          </div>
        )}

        {/* Полные конфигурации */}
        {configurations.length > 0 && (
          <div className="mt-8">
            <h2 className="text-2xl font-bold mb-4 text-gray-700">✅ Конфигурации по вашему бюджету:</h2>
            {configurations.map((config, index) => (
              <div key={`config-${index}`} className="mb-6 p-4 border border-gray-200 rounded-lg shadow hover:shadow-md transition-shadow">
                <h3 className="text-xl font-semibold text-blue-600 mb-2">Сборка #{index + 1}</h3>
                <ul className="space-y-1">
                  {activeCategories.map((category, i) => {
                    const component = config[category];
                    return component ? (
                      <li key={`${category}-${i}`} className="text-sm">
                        <strong className="text-gray-600">{categoryTranslations[category]}:</strong> {component.name}{' '}
                        {component.description && <span className="italic text-gray-500">({component.description})</span>}
                      </li>
                    ) : null;
                  })}
                </ul>
                <p className="font-bold text-md mt-3 text-green-600">
                  Общая стоимость: {config.totalPrice.toLocaleString()} ₸
                </p>
                <p className="text-sm text-gray-500">
                  Производительность: {config.totalScore} (усл. ед.)
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Конфигурации, превышающие бюджет */}
        {closestConfigs.length > 0 && (
          <div className="mt-8">
            <h2 className="text-2xl font-bold mb-4 text-gray-700">💡 Близкие конфигурации (чуть дороже):</h2>
            {closestConfigs.map((config, index) => (
              <div key={`closest-${index}`} className="mb-6 p-4 border border-yellow-200 rounded-lg bg-yellow-50 shadow hover:shadow-md transition-shadow">
                <h3 className="text-xl font-semibold text-orange-600 mb-2">Сборка #{index + 1} (альтернатива)</h3>
                <ul className="space-y-1">
                  {activeCategories.map((category, i) => {
                    const component = config[category];
                    return component ? (
                      <li key={`${category}-${i}-closest`} className="text-sm">
                        <strong className="text-gray-600">{categoryTranslations[category]}:</strong> {component.name}{' '}
                        {component.description && <span className="italic text-gray-500">({component.description})</span>}
                      </li>
                    ) : null;
                  })}
                </ul>
                <p className="font-bold text-md mt-3 text-red-600">
                  Общая стоимость: {config.totalPrice.toLocaleString()} ₸
                </p>
                <p className="text-sm text-gray-500">
                  Производительность: {config.totalScore} (усл. ед.)
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default PCBuilder;
