import React, { useState, useEffect, useMemo, useCallback } from 'react';

const PCBuilder = () => {
  const [components, setComponents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [budget, setBudget] = useState('');
  const [selectedCategories, setSelectedCategories] = useState({
    processor: true,
    graphicsCard: true,
    ram: true,
    storage: true,
    motherboard: true,
    case: true,
    cooler: true,
    monitor: true,
    powerSupply: true,
    keyboard: true,
    mouse: true,
    operatingSystem: false,
  });
  const [combinations, setCombinations] = useState([]);
  const [filterClicked, setFilterClicked] = useState(false);

  const activeCategories = Object.keys(selectedCategories).filter(category => selectedCategories[category]);

  // Функция для вычисления score
  const calculateScore = (component) => {
    if (component.category === 'processor') {
      const frequency = +component.frequency || 0;
      const cores = +component.cores || 0;
      return frequency * 10 + cores * 5;
    } else if (component.category === 'graphicsCard') {
      const memory = +component.memory || 0;
      return memory * 10;
    } else if (component.category === 'ram') {
      const frequency = +component.frequency || 0;
      const capacity = +component.capacity || 0;
      return frequency / 100 + capacity;
    } else {
      return 1;
    }
  };

  const fetchComponents = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/components');
      if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
      const data = await response.json();
      console.log('Загруженные компоненты:', data);

      const normalizedData = data.map(item => {
        const normalized = {
          ...item,
          price: +item.price || 0,
          socket: item.socket ? String(item.socket).trim() : null,
          power: item.power ? +item.power : 0,
          frequency: item.frequency ? +item.frequency : 0,
          cores: item.cores ? +item.cores : 0,
          memory: item.memory ? +item.memory : 0,
          ramType: item.ramType ? String(item.ramType).trim() : null,
          capacity: item.capacity ? +item.capacity : 0,
          interface: item.interface ? String(item.interface).trim() : null,
          formFactor: item.formFactor ? String(item.formFactor).trim() : null,
          supportedInterfaces: item.supportedInterfaces ? String(item.supportedInterfaces).trim() : null,
          pcieVersion: item.pcieVersion ? String(item.pcieVersion).trim() : null,
          supportedFormFactors: item.supportedFormFactors ? String(item.supportedFormFactors).trim() : null,
          wattage: item.wattage ? +item.wattage : 0,
          resolution: item.resolution ? String(item.resolution).trim() : null,
          type: item.type ? String(item.type).trim() : null,
          version: item.version ? String(item.version).trim() : null,
        };
        // Пересчитываем score
        normalized.score = calculateScore(normalized);
        return normalized;
      });

      const filteredData = normalizedData.filter(item => activeCategories.includes(item.category));
      console.log('Нормализованные компоненты:', filteredData);

      setComponents(filteredData);
      setError(null);
    } catch (err) {
      console.error('Ошибка загрузки:', err);
      setError('Не удалось загрузить компоненты.');
      console.log('Ошибка загрузки компонентов!');
    } finally {
      setLoading(false);
    }
  }, [activeCategories]);

  useEffect(() => {
    fetchComponents();
  }, [fetchComponents]);

  const checkCompatibility = (category, component, currentConfig) => {
    if (category === 'motherboard' && currentConfig.processor) {
      if (component.socket !== currentConfig.processor.socket) {
        return { isCompatible: false, reason: `Несовместимый сокет материнской платы: ${component.socket} ≠ ${currentConfig.processor.socket}` };
      }
    }
    if (category === 'cooler' && currentConfig.processor) {
      const coolerSockets = String(component.socket || '').split(',').map(s => s.trim());
      if (!coolerSockets.includes(String(currentConfig.processor.socket))) {
        return { isCompatible: false, reason: `Кулер не поддерживает сокет процессора: ${currentConfig.processor.socket}` };
      }
    }
    if (category === 'case' && currentConfig.motherboard && component.supportedFormFactors && currentConfig.motherboard.formFactor) {
      const caseFormFactors = String(component.supportedFormFactors).split(',').map(f => f.trim().toLowerCase());
      if (!caseFormFactors.includes(String(currentConfig.motherboard.formFactor).trim().toLowerCase())) {
        return { isCompatible: false, reason: `Корпус не поддерживает форм-фактор материнской платы: ${currentConfig.motherboard.formFactor}` };
      }
    }
    if (category === 'powerSupply' && currentConfig.processor) {
      const requiredPower = ((currentConfig.processor.power || 0) + (currentConfig.graphicsCard?.power || 0) + 100) * 1.2;
      if (component.wattage < requiredPower) {
        return { isCompatible: false, reason: `Недостаточная мощность блока питания: ${component.wattage}W < ${requiredPower}W` };
      }
    }
    if (category === 'ram' && currentConfig.motherboard) {
      if (!component.ramType || !currentConfig.motherboard.ramType || component.ramType !== currentConfig.motherboard.ramType) {
        return { isCompatible: false, reason: `Тип RAM несовместим с материнской платой: ${component.ramType || 'none'} ≠ ${currentConfig.motherboard.ramType || 'none'}` };
      }
    }
    if (category === 'storage' && currentConfig.motherboard && component.interface && currentConfig.motherboard.supportedInterfaces) {
      const supportedInterfaces = String(currentConfig.motherboard.supportedInterfaces).split(',').map(i => i.trim().toLowerCase());
      if (!supportedInterfaces.includes(String(component.interface).trim().toLowerCase())) {
        return { isCompatible: false, reason: `Интерфейс накопителя не поддерживается: ${component.interface}` };
      }
    }
    if (category === 'graphicsCard' && currentConfig.motherboard && component.pcieVersion && currentConfig.motherboard.pcieVersion) {
      const motherboardPcieVersions = String(currentConfig.motherboard.pcieVersion).split(',').map(v => v.trim().toLowerCase());
      if (!motherboardPcieVersions.includes(String(component.pcieVersion).trim().toLowerCase())) {
        return { isCompatible: false, reason: `PCIe версии несовместимы: ${component.pcieVersion} ≠ ${currentConfig.motherboard.pcieVersion}` };
      }
    }
    return { isCompatible: true, reason: '' };
  };

  const generateCombinations = useCallback(() => {
    if (!components.length) return [];

    const results = [];
    const maxCombinations = 2000;

    const componentsByCategory = activeCategories.reduce((acc, category) => {
      acc[category] = components.filter(c => c.category === category);
      return acc;
    }, {});

    const generate = (currentConfig, categoriesToFill, index) => {
      if (results.length >= maxCombinations) return;

      if (index >= categoriesToFill.length) {
        const totalPrice = Object.values(currentConfig).reduce((sum, c) => sum + (c?.price || 0), 0);
        const totalScore = Object.values(currentConfig).reduce((sum, c) => sum + (c?.score || 0), 0);
        results.push({ ...currentConfig, totalPrice, totalScore });
        return;
      }

      const category = categoriesToFill[index];
      const candidates = componentsByCategory[category] || [];

      for (const component of candidates) {
        const compatibility = checkCompatibility(category, component, currentConfig);
        if (compatibility.isCompatible) {
          currentConfig[category] = component;
          generate(currentConfig, categoriesToFill, index + 1);
          currentConfig[category] = null;
        } else {
          console.log(`Исключён: ${component.name} (${category}): ${compatibility.reason}`);
        }
      }

      generate(currentConfig, categoriesToFill, index + 1);
    };

    generate({}, activeCategories, 0);

    results.sort((a, b) => {
      const diversityA = Object.values(a).filter(c => c).length;
      const diversityB = Object.values(b).filter(c => c).length;
      return b.totalScore - a.totalScore || diversityA - diversityB || a.totalPrice - b.totalPrice;
    });

    console.log('Комбинации:', results);
    return results.slice(0, 10);
  }, [components, activeCategories]);

  useEffect(() => {
    if (!loading && !error && components.length > 0) {
      const newCombinations = generateCombinations();
      setCombinations(newCombinations);
    }
  }, [loading, error, components, generateCombinations]);

  const getCheapest = (category) => {
    const categoryComponents = components.filter(c => c.category === category);
    return categoryComponents.length > 0
      ? categoryComponents.reduce((min, curr) => (curr.price < min.price ? curr : min), categoryComponents[0])
      : null;
  };

  const predefinedTemplates = useMemo(() => {
    if (!components.length) {
      console.log('Компоненты не загружены');
      return [];
    }
    console.log('Генерация шаблонов...');

    const templates = [
      {
        id: 'gaming-pc',
        name: 'Игровой ПК',
        description: 'Для современных игр',
        components: [
          components.find(c => c.category === 'processor' && c.score >= 100),
          components.find(c => c.category === 'graphicsCard' && c.memory >= 8),
          getCheapest('ram'),
          getCheapest('storage'),
          getCheapest('motherboard'),
          getCheapest('case'),
          getCheapest('cooler'),
          getCheapest('powerSupply'),
          getCheapest('monitor'),
          getCheapest('keyboard'),
          getCheapest('mouse'),
        ].filter(Boolean),
      },
      {
        id: 'office-pc',
        name: 'Офисный ПК',
        description: 'Для работы',
        components: [
          components.find(c => c.category === 'processor' && c.score <= 60),
          getCheapest('ram'),
          getCheapest('storage'),
          getCheapest('motherboard'),
          getCheapest('case'),
          getCheapest('cooler'),
          getCheapest('powerSupply'),
          getCheapest('monitor'),
          getCheapest('keyboard'),
          getCheapest('mouse'),
        ].filter(Boolean),
      },
      {
        id: 'budget-pc',
        name: 'Бюджетный ПК',
        description: 'Максимальная экономия',
        components: [
          getCheapest('processor'),
          getCheapest('ram'),
          getCheapest('storage'),
          getCheapest('motherboard'),
          getCheapest('case'),
          getCheapest('cooler'),
          getCheapest('powerSupply'),
          getCheapest('monitor'),
          getCheapest('keyboard'),
          getCheapest('mouse'),
        ].filter(Boolean),
      },
    ];

    const filteredTemplates = templates
      .map(template => ({
        ...template,
        components: template.components.filter(comp => activeCategories.includes(comp.category)),
      }))
      .filter(template => {
        const config = template.components.reduce((acc, comp) => ({ ...acc, [comp.category]: comp }), {});
        const isValid = template.components.length > 0 && Object.keys(config).every(category => {
          const compatibility = checkCompatibility(category, config[category], config);
          if (!compatibility.isCompatible) {
            console.log(`Шаблон ${template.name} исключён: ${compatibility.reason}`);
          }
          return compatibility.isCompatible;
        });
        return isValid;
      });

    console.log('Шаблоны:', filteredTemplates);
    return filteredTemplates;
  }, [components, activeCategories]);

  const handleFilter = () => {
    setFilterClicked(true);
    const newCombinations = generateCombinations();
    setCombinations(newCombinations);
    console.log('Конфигурации обновлены!');
  };

  const handleCategoryToggle = (category) => {
    setSelectedCategories(prev => ({
      ...prev,
      [category]: !prev[category],
    }));
  };

  const handleReset = () => {
    setBudget('');
    setFilterClicked(false);
    setSelectedCategories({
      processor: true,
      graphicsCard: true,
      ram: true,
      storage: true,
      motherboard: true,
      case: true,
      cooler: true,
      monitor: true,
      powerSupply: true,
      keyboard: true,
      mouse: true,
      operatingSystem: false,
    });
    setCombinations([]);
    console.log('Фильтры сброшены!');
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'KZT' }).format(price);
  };

  const budgetValue = parseFloat(budget) || Infinity;
  const withinBudget = combinations.filter(c => c.totalPrice <= budgetValue);
  const overBudget = combinations.filter(c => c.totalPrice > budgetValue);

  return (
    <div className="container mx-auto p-4 max-w-7xl">
      <h1 className="text-3xl font-bold mb-6 text-center text-gray-800">Сборщик ПК</h1>

      <div className="mb-6 p-4 bg-white rounded-lg shadow-md">
        <div className="flex flex-col sm:flex-row gap-4 mb-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Бюджет (₸)</label>
            <input
              type="number"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              placeholder="Введите бюджет"
              className="w-full p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-end gap-2">
            <button
              onClick={handleFilter}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
            >
              Подобрать
            </button>
            <button
              onClick={handleReset}
              className="px-4 py-2 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400 transition"
            >
              Сбросить
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {Object.keys(selectedCategories).map(category => (
            <div key={category} className="inline-flex items-center bg-gray-100 rounded-full px-3 py-1">
              <input
                type="checkbox"
                checked={selectedCategories[category]}
                onChange={() => handleCategoryToggle(category)}
                className="form-checkbox h-5 w-5 text-blue-600"
              />
              <span className="ml-2 text-sm text-gray-700 capitalize">{category}</span>
              {selectedCategories[category] && (
                <span
                  onClick={() => handleCategoryToggle(category)}
                  className="ml-2 text-gray-500 cursor-pointer hover:text-gray-700"
                >
                  ×
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {loading && <p className="text-center text-gray-600">Загрузка компонентов...</p>}
      {error && <p className="text-center text-red-600">{error}</p>}

      {console.log('Состояние шаблонов:', { loading, error, filterClicked, budget, templateCount: predefinedTemplates.length })}
      {!loading && !error && predefinedTemplates.length > 0 && (
        <div className="mt-8">
          <h2 className="text-2xl font-bold mb-4 text-gray-700">📋 Готовые сборки:</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {predefinedTemplates.map(template => (
              <div key={template.id} className="p-4 bg-white rounded-lg shadow-md">
                <h3 className="text-xl font-semibold text-gray-800">{template.name}</h3>
                <p className="text-gray-600 mb-4">{template.description}</p>
                <ul className="list-disc pl-5 mb-4">
                  {template.components.map(comp => (
                    <li key={comp.name} className="text-gray-700">
                      {comp.category}: {comp.name} ({formatPrice(comp.price)})
                    </li>
                  ))}
                </ul>
                <p className="text-lg font-bold text-gray-800">
                  Итого: {formatPrice(template.components.reduce((sum, c) => sum + c.price, 0))}
                </p>
                <p className="text-gray-600">
                  Производительность: {template.components.reduce((sum, c) => sum + (c.score || 0), 0).toFixed(2)} усл. ед.
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && !error && combinations.length > 0 && (
        <div className="mt-8">
          <h2 className="text-2xl font-bold mb-4 text-gray-700">Найденные конфигурации:</h2>
          {withinBudget.length > 0 && (
            <div>
              <h3 className="text-xl font-semibold mb-2 text-gray-700">В рамках бюджета:</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {withinBudget.map((config, index) => (
                  <div key={index} className="p-4 bg-white rounded-lg shadow-md">
                    <h4 className="text-lg font-semibold text-gray-800">Сборка #{index + 1}</h4>
                    <ul className="list-disc pl-5 mb-4">
                      {Object.entries(config).map(([category, comp]) => (
                        comp && category !== 'totalPrice' && category !== 'totalScore' && (
                          <li key={category} className="text-gray-700">
                            {category}: {comp.name} ({formatPrice(comp.price)})
                          </li>
                        )
                      ))}
                    </ul>
                    <p className="text-lg font-bold text-gray-800">Итого: {formatPrice(config.totalPrice)}</p>
                    <p className="text-gray-600">Производительность: {config.totalScore.toFixed(2)} усл. ед.</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          {overBudget.length > 0 && (
            <div className="mt-6">
              <h3 className="text-xl font-semibold mb-2 text-gray-700">Альтернативы (превышают бюджет):</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {overBudget.map((config, index) => (
                  <div key={index} className="p-4 bg-white rounded-lg shadow-md">
                    <h4 className="text-lg font-semibold text-gray-800">Сборка #{index + 1} (альтернатива)</h4>
                    <ul className="list-disc pl-5 mb-4">
                      {Object.entries(config).map(([category, comp]) => (
                        comp && category !== 'totalPrice' && category !== 'totalScore' && (
                          <li key={category} className="text-gray-700">
                            {category}: {comp.name} ({formatPrice(comp.price)})
                          </li>
                        )
                      ))}
                    </ul>
                    <p className="text-lg font-bold text-gray-800">Итого: {formatPrice(config.totalPrice)}</p>
                    <p className="text-gray-600">Производительность: {config.totalScore.toFixed(2)} усл. ед.</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {!loading && !error && combinations.length === 0 && filterClicked && (
        <p className="text-center text-gray-600">Не удалось найти конфигурации с заданными параметрами.</p>
      )}
    </div>
  );
};

export default PCBuilder;
