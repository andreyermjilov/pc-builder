import React, { useState, useEffect, useCallback } from 'react';
import './PCBuilder.css';

const PCBuilder = () => {
  const [componentsByCategory, setComponentsByCategory] = useState({});
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
  const [budget, setBudget] = useState('');
  const [configurations, setConfigurations] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // Функция для вычисления производительности компонента
  const calculateComponentScore = (component) => {
    let score = 0;
    switch (component.category) {
      case 'processor':
        score = component.frequency * 10 + component.cores * 5;
        break;
      case 'graphicsCard':
        score = component.memory * 10 + (parseFloat(component.pcieVersion) || 3.0) * 5;
        break;
      case 'ram':
        score = component.frequency / 100 + component.capacity * 2;
        break;
      case 'storage':
        score = component.interface === 'M.2 NVMe' ? 20 : 10;
        break;
      case 'monitor':
        if (component.resolution === '3840x2160') score = 30;
        else if (component.resolution === '2560x1440') score = 20;
        else score = 10;
        break;
      case 'powerSupply':
        score = component.wattage / 50;
        break;
      case 'keyboard':
      case 'mouse':
        score = component.type === 'Gaming' ? 5 : 2;
        break;
      default:
        score = 0;
    }
    console.log(`Score для ${component.category} (${component.name}): ${score}`);
    return score;
  };

  // Проверка совместимости компонентов
  const checkCompatibility = (category, component, currentConfig) => {
    const reasons = [];

    // Проверка совместимости процессора и материнской платы
    if (category === 'motherboard' && currentConfig.processor && selectedCategories.motherboard && selectedCategories.processor) {
      if (component.socket !== currentConfig.processor.socket) {
        reasons.push(`Материнская плата ${component.name} (сокет: ${component.socket}) несовместима с процессором ${currentConfig.processor.name} (сокет: ${currentConfig.processor.socket})`);
        return { isCompatible: false, reasons };
      }
    }

    // Проверка совместимости RAM и материнской платы
    if (category === 'ram' && currentConfig.motherboard && selectedCategories.ram && selectedCategories.motherboard) {
      if (component.ramType !== currentConfig.motherboard.ramType) {
        reasons.push(`Оперативная память ${component.name} (тип: ${component.ramType}) несовместима с материнской платой ${currentConfig.motherboard.name} (тип: ${currentConfig.motherboard.ramType})`);
        return { isCompatible: false, reasons };
      }
    }

    // Проверка совместимости накопителя и материнской платы
    if (category === 'storage' && currentConfig.motherboard && selectedCategories.storage && selectedCategories.motherboard) {
      const supportedInterfaces = currentConfig.motherboard.supportedInterfaces.split(',').map(i => i.trim());
      if (!supportedInterfaces.includes(component.interface)) {
        reasons.push(`Накопитель ${component.name} (интерфейс: ${component.interface}) несовместим с материнской платой ${currentConfig.motherboard.name} (поддерживаемые интерфейсы: ${currentConfig.motherboard.supportedInterfaces})`);
        return { isCompatible: false, reasons };
      }
    }

    // Проверка совместимости видеокарты и материнской платы
    if (category === 'graphicsCard' && currentConfig.motherboard && selectedCategories.graphicsCard && selectedCategories.motherboard) {
      const motherboardPcieVersions = currentConfig.motherboard.pcieVersion.split(',').map(v => v.trim());
      if (!motherboardPcieVersions.some(version => parseFloat(version) >= parseFloat(component.pcieVersion))) {
        reasons.push(`Видеокарта ${component.name} (PCIe: ${component.pcieVersion}) несовместима с материнской платой ${currentConfig.motherboard.name} (PCIe: ${currentConfig.motherboard.pcieVersion})`);
        return { isCompatible: false, reasons };
      }
    }

    // Проверка совместимости кулера и процессора
    if (category === 'cooler' && currentConfig.processor && selectedCategories.cooler && selectedCategories.processor) {
      const coolerSockets = component.socket.split(',').map(s => s.trim());
      if (!coolerSockets.includes(currentConfig.processor.socket)) {
        reasons.push(`Кулер ${component.name} (сокеты: ${component.socket}) несовместим с процессором ${currentConfig.processor.name} (сокет: ${currentConfig.processor.socket})`);
        return { isCompatible: false, reasons };
      }
    }

    // Проверка совместимости корпуса и материнской платы
    if (category === 'case' && currentConfig.motherboard && selectedCategories.case && selectedCategories.motherboard) {
      const supportedFormFactors = component.supportedFormFactors.split(',').map(f => f.trim());
      if (!supportedFormFactors.includes(currentConfig.motherboard.formFactor)) {
        reasons.push(`Корпус ${component.name} (поддерживаемые форм-факторы: ${component.supportedFormFactors}) несовместим с материнской платой ${currentConfig.motherboard.name} (форм-фактор: ${currentConfig.motherboard.formFactor})`);
        return { isCompatible: false, reasons };
      }
    }

    // Проверка мощности блока питания
    if (category === 'powerSupply' && (currentConfig.processor || currentConfig.graphicsCard) && selectedCategories.powerSupply) {
      const totalPower = (currentConfig.processor?.power || 0) + (currentConfig.graphicsCard?.power || 0) + 50; // +50 Вт для остальных компонентов
      if (component.wattage < totalPower * 1.5) {
        reasons.push(`Блок питания ${component.name} (мощность: ${component.wattage} Вт) недостаточен для процессора ${currentConfig.processor?.name || 'N/A'} (мощность: ${currentConfig.processor?.power || 0} Вт) и видеокарты ${currentConfig.graphicsCard?.name || 'N/A'} (мощность: ${currentConfig.graphicsCard?.power || 0} Вт). Требуется минимум ${Math.ceil(totalPower * 1.5)} Вт.`);
        return { isCompatible: false, reasons };
      }
    }

    return { isCompatible: true, reasons };
  };

  // Генерация комбинаций конфигураций
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
      if (totalPrice > maxBudget) {
        return;
      }
      if (categoryIndex >= currentActiveCategories.length) {
        if (totalPrice > 0 && totalPrice <= maxBudget) {
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

          const newPrice = totalPrice + Number(component.price);
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

    return results.sort((a, b) => b.totalScore - a.totalScore).slice(0, 5);
  }, [selectedCategories]);

  // Генерация шаблонов
  const generateTemplates = useCallback(() => {
    const templates = [];
    const activeCategories = Object.keys(selectedCategories).filter(
      (category) => selectedCategories[category]
    );

    // Офисный ПК (без видеокарты, процессор с frequency < 4.0)
    const officeConfig = generateCombinations(
      {
        ...componentsByCategory,
        graphicsCard: [], // Исключаем видеокарту
        monitor: [], // Исключаем монитор
        keyboard: [], // Исключаем клавиатуру
        mouse: [], // Исключаем мышь
        processor: componentsByCategory.processor?.filter(p => p.frequency < 4.0) || []
      },
      200000,
      activeCategories.filter(c => !['graphicsCard', 'monitor', 'keyboard', 'mouse'].includes(c))
    ).sort((a, b) => b.totalScore - a.totalScore)[0];

    if (officeConfig && officeConfig.totalScore >= 50) {
      templates.push({ name: 'Офисный ПК', config: officeConfig });
    }

    // Бюджетный игровой (с видеокартой)
    const budgetGamingConfig = generateCombinations(
      componentsByCategory,
      300000,
      activeCategories
    ).sort((a, b) => b.totalScore - a.totalScore)[0];

    if (budgetGamingConfig && budgetGamingConfig.totalScore >= 100) {
      templates.push({ name: 'Бюджетный игровой', config: budgetGamingConfig });
    }

    // Оптимальный гейминг (процессор с frequency >= 4.5, cores >= 6)
    const optimalGamingConfig = generateCombinations(
      {
        ...componentsByCategory,
        processor: componentsByCategory.processor?.filter(p => p.frequency >= 4.5 && p.cores >= 6) || []
      },
      500000,
      activeCategories
    ).sort((a, b) => b.totalScore - a.totalScore)[0];

    if (optimalGamingConfig && optimalGamingConfig.totalScore >= 150) {
      templates.push({ name: 'Оптимальный гейминг', config: optimalGamingConfig });
    }

    console.log('Сгенерированы шаблоны:', templates);
    return templates;
  }, [componentsByCategory, generateCombinations, selectedCategories]);

  // Загрузка компонентов
  useEffect(() => {
    const fetchComponents = async () => {
      setIsLoading(true);
      try {
        const response = await fetch('https://pc-builder-backend-24zh.onrender.com/api/components');
        if (!response.ok) {
          throw new Error(`Ошибка HTTP: ${response.status}`);
        }
        const rawComponents = await response.json();
        console.log('Загруженные компоненты (raw):', rawComponents);

        const normalizedComponents = rawComponents.map(component => ({
          ...component,
          price: Number(component.price) || 0,
          frequency: Number(component.frequency) || 0,
          cores: Number(component.cores) || 0,
          power: Number(component.power) || 0,
          memory: Number(component.memory) || 0,
          capacity: Number(component.capacity) || 0,
          wattage: Number(component.wattage) || 0,
        }));

        const componentsByCategory = normalizedComponents.reduce((acc, component) => {
          if (!acc[component.category]) {
            acc[component.category] = [];
          }
          acc[component.category].push(component);
          return acc;
        }, {});

        console.log('Нормализованные и отфильтрованные компоненты:', componentsByCategory);
        setComponentsByCategory(componentsByCategory);
        setError(null);
      } catch (error) {
        console.error('Ошибка загрузки компонентов:', error);
        setError('Не удалось загрузить компоненты. Пожалуйста, попробуйте позже.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchComponents();
  }, []);

  // Генерация шаблонов при загрузке компонентов
  useEffect(() => {
    if (Object.keys(componentsByCategory).length > 0) {
      const templates = generateTemplates();
      setTemplates(templates);
    }
  }, [componentsByCategory, generateTemplates]);

  // Обработчик изменения категорий
  const handleCategoryChange = (category) => {
    setSelectedCategories((prev) => ({
      ...prev,
      [category]: !prev[category],
    }));
  };

  // Обработчик изменения бюджета
  const handleBudgetChange = (e) => {
    const value = e.target.value;
    if (value === '' || (!isNaN(value) && Number(value) >= 0)) {
      setBudget(value);
    }
  };

  // Обработчик подбора конфигураций
  const handleBuildPC = () => {
    setError(null);
    setConfigurations([]);

    const maxBudget = budget ? Number(budget) : Infinity;
    const activeCategories = Object.keys(selectedCategories).filter(
      (category) => selectedCategories[category]
    );

    if (activeCategories.length === 0) {
      setError('Выберите хотя бы одну категорию компонентов.');
      return;
    }

    try {
      const generatedConfigs = generateCombinations(componentsByCategory, maxBudget, activeCategories);
      if (generatedConfigs.length === 0) {
        setError('Не удалось найти подходящие конфигурации для заданного бюджета и категорий.');
      } else {
        setConfigurations(generatedConfigs);
      }
    } catch (error) {
      console.error('Ошибка при генерации конфигураций:', error);
      setError('Произошла ошибка при генерации конфигураций.');
    }
  };

  // Рендеринг компонента
  return (
    <div className="pc-builder">
      <h1>PC Builder</h1>

      <div className="categories">
        <h2>Выберите категории компонентов:</h2>
        {Object.keys(selectedCategories).map((category) => (
          <label key={category}>
            <input
              type="checkbox"
              checked={selectedCategories[category]}
              onChange={() => handleCategoryChange(category)}
            />
            {category.charAt(0).toUpperCase() + category.slice(1)}
          </label>
        ))}
      </div>

      <div className="budget">
        <h2>Укажите бюджет (₸):</h2>
        <input
          type="text"
          value={budget}
          onChange={handleBudgetChange}
          placeholder="Введите бюджет (например, 300000)"
        />
      </div>

      <button onClick={handleBuildPC} disabled={isLoading}>
        {isLoading ? 'Загрузка...' : 'Подобрать конфигурации'}
      </button>

      {error && <div className="error">{error}</div>}

      <div className="templates">
        <h2>Шаблоны конфигураций</h2>
        {templates.length > 0 ? (
          templates.map((template, index) => (
            <div key={index} className="template">
              <h3>{template.name}</h3>
              <ul>
                {Object.entries(template.config).map(([category, component]) => (
                  component && component.name ? (
                    <li key={category}>
                      {category.charAt(0).toUpperCase() + category.slice(1)}: {component.name} ({component.price} ₸)
                    </li>
                  ) : null
                ))}
              </ul>
              <p>Общая стоимость: {template.config.totalPrice} ₸</p>
              <p>Производительность: {template.config.totalScore} усл. ед.</p>
            </div>
          ))
        ) : (
          <p>Шаблоны не найдены.</p>
        )}
      </div>

      <div className="configurations">
        <h2>Найденные конфигурации</h2>
        {configurations.length > 0 ? (
          configurations.map((config, index) => (
            <div key={index} className="configuration">
              <h3>Сборка #{index + 1}</h3>
              <ul>
                {Object.entries(config).map(([category, component]) => (
                  component && component.name ? (
                    <li key={category}>
                      {category.charAt(0).toUpperCase() + category.slice(1)}: {component.name} ({component.price} ₸)
                    </li>
                  ) : null
                ))}
              </ul>
              <p>Общая стоимость: {config.totalPrice} ₸</p>
              <p>Производительность: {config.totalScore} усл. ед.</p>
            </div>
          ))
        ) : (
          <p>Конфигурации не найдены.</p>
        )}
      </div>
    </div>
  );
};

export default PCBuilder;
