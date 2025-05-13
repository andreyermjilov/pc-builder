import React, { useEffect, useState, useCallback } from 'react';

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

const API_BASE_URL = 'https://pc-builder-backend-24zh.onrender.com/api';

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
      acc[key] = true;
      return acc;
    }, {})
  );

  const categories = Object.keys(categoryTranslations); // Все доступные категории

  // **************************************************************************
  // ИСПРАВЛЕНИЕ: Определяем activeCategories здесь, чтобы она была доступна в JSX
  // **************************************************************************
  const activeCategories = categories.filter(category => selectedCategories[category]);

  // Нормализация данных (без изменений)
  const normalizeComponent = (item) => {
    const normalized = {
      ...item,
      category: item.category ? item.category.trim() : '',
      price: Number(item.price) || 0,
      performance: Number(item.performance) || 0,
      socket: item.socket ? String(item.socket).trim() : '',
      power: Number(item.power) || 0,
      formFactor: item.formFactor ? String(item.formFactor).trim() : '',
      resolution: item.resolution ? item.resolution.trim() : '',
      wattage: Number(item.wattage) || 0,
      type: item.type ? item.type.trim() : '',
      version: item.version ? item.version.trim() : '',
    };
    return normalized;
  };

  // Загрузка компонентов с API (без изменений)
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
  };
  
  // generateCombinations (без изменений в этой части для исправления ошибки)
  const generateCombinations = useCallback((componentsByCategory, maxBudget, currentActiveCategories) => { // Переименовал параметр для ясности
    const results = [];
    const maxCombinations = 2000;

    const buildConfig = (currentConfig, categoryIndex, totalPrice, totalPerformance) => {
      if (results.length >= maxCombinations) {
        console.warn('Достигнут лимит комбинаций:', results.length);
        return;
      }

      if (categoryIndex >= currentActiveCategories.length) { // Используем переданный параметр
        if (totalPrice > 0 && totalPrice <= maxBudget + 100000) {
          results.push({ ...currentConfig, totalPrice, totalPerformance });
        }
        return;
      }

      const category = currentActiveCategories[categoryIndex]; // Используем переданный параметр
      const currentCategoryComponents = componentsByCategory[category] || [];

      if (currentCategoryComponents.length === 0) {
          buildConfig(currentConfig, categoryIndex + 1, totalPrice, totalPerformance);
          return;
      }

      currentCategoryComponents.forEach(component => {
        if (totalPrice + component.price > maxBudget + 100000) {
          return;
        }
        
        let isCompatible = true;
        let compatibilityFailureReason = "";

        if ( category === 'motherboard' && currentConfig.processor && selectedCategories.motherboard && selectedCategories.processor && component.socket !== currentConfig.processor.socket ) {
          isCompatible = false;
          compatibilityFailureReason = `Motherboard ${component.name} (socket: ${component.socket}) incompatible with Processor ${currentConfig.processor.name} (socket: ${currentConfig.processor.socket})`;
        }
        if ( category === 'cooler' && currentConfig.processor && selectedCategories.cooler && selectedCategories.processor ) {
          const coolerSockets = String(component.socket).split(',').map(s => s.trim());
          if (!coolerSockets.includes(String(currentConfig.processor.socket))) {
            isCompatible = false;
            compatibilityFailureReason = `Cooler ${component.name} (sockets: ${component.socket}) incompatible with Processor ${currentConfig.processor.name} (socket: ${currentConfig.processor.socket})`;
          }
        }
        if ( category === 'case' && currentConfig.motherboard && selectedCategories.case && selectedCategories.motherboard && component.formFactor && currentConfig.motherboard.formFactor ) {
            const caseFormFactors = String(component.formFactor).split(',').map(f => f.trim().toLowerCase());
            if (!caseFormFactors.includes(String(currentConfig.motherboard.formFactor).trim().toLowerCase())) {
                isCompatible = false;
                compatibilityFailureReason = `Case ${component.name} (form factors: ${component.formFactor}) incompatible with Motherboard ${currentConfig.motherboard.name} (form factor: ${currentConfig.motherboard.formFactor})`;
            }
        }
        if ( category === 'powerSupply' && selectedCategories.powerSupply && currentConfig.processor && selectedCategories.processor && currentConfig.graphicsCard && selectedCategories.graphicsCard ) {
          const requiredPower = (currentConfig.processor.power || 0) + (currentConfig.graphicsCard.power || 0) + 100;
          if (component.wattage < requiredPower) {
            isCompatible = false;
            compatibilityFailureReason = `Power Supply ${component.name} (wattage: ${component.wattage}W) insufficient for estimated ${requiredPower}W (CPU: ${currentConfig.processor.power}W, GPU: ${currentConfig.graphicsCard.power}W)`;
          }
        }
        
        if (!isCompatible) {
          // console.warn(`Skipped combination due to incompatibility: ${compatibilityFailureReason}`);
          return;
        }

        const newPrice = totalPrice + component.price;
        const newPerformance = totalPerformance + (component.performance || 0);

        buildConfig(
          { ...currentConfig, [category]: component },
          categoryIndex + 1,
          newPrice,
          newPerformance
        );
      });
    };

    buildConfig({}, 0, 0, 0);
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
    // **************************************************************************
    // ИСПРАВЛЕНИЕ: Используем activeCategories, определенную на верхнем уровне
    // **************************************************************************
    console.log('Выбранные категории (для фильтрации):', activeCategories);


    if (!components.length) {
      setError('Компоненты не загружены. Проверьте подключение к серверу или обновите страницу.');
      setLoading(false);
      return;
    }

    // const localActiveCategories = categories.filter(category => selectedCategories[category]); // Эта строка больше не нужна здесь, используем activeCategories из замыкания выше
    if (activeCategories.length === 0) { // Используем activeCategories с верхнего уровня
      setError('Выберите хотя бы одну категорию компонентов.');
      setLoading(false);
      return;
    }
    
    // selectedComponents теперь будет использовать activeCategories с верхнего уровня
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
            .join(', ')}. Попробуйте изменить бюджет или выбор категорий.`
        );
        setLoading(false);
        return;
    }

    setTimeout(() => {
        // Передаем activeCategories в generateCombinations
        const allGeneratedConfigs = generateCombinations(selectedComponents, maxBudget, activeCategories); 
        
        const fullConfigs = allGeneratedConfigs.filter(config => config.totalPrice <= maxBudget);
        const tempClosestConfigs = allGeneratedConfigs.filter(
        config => config.totalPrice > maxBudget && config.totalPrice <= maxBudget + 100000
        );

        setConfigurations(
        fullConfigs
            .sort((a, b) => b.totalPerformance - a.totalPerformance || a.totalPrice - b.totalPrice)
            .slice(0, 5)
        );
        setClosestConfigs(
        tempClosestConfigs
            .sort((a, b) => b.totalPerformance - a.totalPerformance || a.totalPrice - b.totalPrice)
            .slice(0, 3)
        );
        setLoading(false);
    }, 500);
  };

  // JSX рендеринг
  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-6">
      <div className="max-w-4xl mx-auto bg-white shadow-lg rounded-lg p-6">
        <h1 className="text-3xl font-bold mb-6 text-center text-gray-700">🛠️ Подбор Конфигурации ПК</h1>

        {/* Выбор категорий (без изменений) */}
        <div className="mb-6 p-4 border border-blue-200 rounded-md bg-blue-50">
          <h3 className="text-lg font-semibold mb-3 text-blue-700">1. Выберите компоненты:</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {categories.map(category => ( // Здесь categories - это все категории для чекбоксов
              <label key={category} className="flex items-center space-x-2 p-2 rounded hover:bg-blue-100 transition-colors cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!selectedCategories[category]}
                  onChange={() => handleCategoryToggle(category)}
                  className="form-checkbox h-5 w-5 text-blue-600 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">{categoryTranslations[category]}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Поле ввода бюджета (без изменений) */}
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
        
        {/* Индикатор загрузки (без изменений) */}
        {loading && (
          <div className="flex justify-center items-center my-8">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            <p className="ml-3 text-blue-600 text-lg">Идет подбор конфигураций...</p>
          </div>
        )}

        {/* Отображение ошибок (без изменений) */}
        {error && (
          <div className="my-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-md text-center">
            <p className="font-semibold">Ошибка!</p>
            <p>{error}</p>
          </div>
        )}
        
        {/* Сообщение "Ничего не найдено" (без изменений) */}
        {!loading && !error && filterClicked && configurations.length === 0 && closestConfigs.length === 0 && (
             <div className="my-6 p-4 bg-yellow-100 border border-yellow-400 text-yellow-700 rounded-md text-center">
                <p className="font-semibold">Ничего не найдено</p>
                <p>По вашему бюджету и выбранным компонентам не удалось составить ни одной конфигурации. Попробуйте изменить бюджет или набор компонентов.</p>
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
                  {/* ************************************************************************** */}
                  {/* ИСПРАВЛЕНИЕ: Используем activeCategories, определенную на верхнем уровне */}
                  {/* ************************************************************************** */}
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
                  Производительность: {config.totalPerformance} (усл. ед.)
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
                 {/* ************************************************************************** */}
                 {/* ИСПРАВЛЕНИЕ: Используем activeCategories, определенную на верхнем уровне */}
                 {/* ************************************************************************** */}
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
                  Производительность: {config.totalPerformance} (усл. ед.)
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











