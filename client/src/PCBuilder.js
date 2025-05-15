import React, { useEffect, useState, useCallback, useMemo } from 'react';

// Переводы категорий
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
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [filterClicked, setFilterClicked] = useState(false);

  // Категории и выбранные категории (операционную систему исключаем)
  const [selectedCategories, setSelectedCategories] = useState(
    Object.keys(categoryTranslations).reduce((acc, key) => {
      acc[key] = key !== 'operatingSystem';
      return acc;
    }, {})
  );

  const categories = Object.keys(categoryTranslations);
  const activeCategories = categories.filter(cat => selectedCategories[cat] && cat !== 'operatingSystem');

  // Нормализация данных компонента
  const normalizeComponent = (item) => ({
    ...item,
    category: item.category ? item.category.trim() : '',
    price: Number(item.price) || 0,
    score: Number(item.score) || 0,
    socket: item.socket ? String(item.socket).trim() : '',
    power: Number(item.power) || 0,
    formFactor: item.formFactor ? String(item.formFactor).trim() : '',
    resolution: item.resolution ? item.resolution.trim() : '',
    wattage: Number(item.wattage) || 0,
    type: item.type ? item.type.trim() : '',
    version: item.version ? item.version.trim() : '',
    frequency: Number(item.frequency) || 0,
    cores: Number(item.cores) || 0,
    memory: Number(item.memory) || 0,
    ramType: item.ramType ? String(item.ramType).trim() : '',
    capacity: Number(item.capacity) || 0,
    interface: item.interface ? String(item.interface).trim() : '',
    supportedFormFactors: item.supportedFormFactors ? String(item.supportedFormFactors).trim() : '',
    supportedInterfaces: item.supportedInterfaces ? String(item.supportedInterfaces).trim() : '',
    pcieVersion: item.pcieVersion ? String(item.pcieVersion).trim() : '',
  });

  // Загрузка компонентов с API с повторными попытками
  useEffect(() => {
    const API_URL = `${API_BASE_URL}/api/components`;
    const fetchComponents = async (attempt = 1, maxAttempts = 5) => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(API_URL, { signal: AbortSignal.timeout(15000) });
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: `HTTP ошибка: ${response.status}` }));
          throw new Error(errorData.error || `HTTP ошибка: ${response.status}`);
        }
        const data = await response.json();
        if (!Array.isArray(data) || data.length === 0) {
          setError('Нет доступных компонентов с сервера. Проверьте данные или настройки сервера.');
          setComponents([]);
          return;
        }
        const normalizedData = data
          .map(normalizeComponent)
          .filter(item => item.category && item.price > 0 && item.name);
        if (normalizedData.length === 0) {
          setError('После нормализации компоненты отсутствуют. Проверьте формат данных.');
          setComponents([]);
          return;
        }
        setComponents(normalizedData);
      } catch (err) {
        if (attempt < maxAttempts && err.name !== 'AbortError') {
          setTimeout(() => fetchComponents(attempt + 1, maxAttempts), 3000);
        } else {
          setError(`Ошибка загрузки данных: ${err.message}`);
          setComponents([]);
        }
      } finally {
        setLoading(false);
      }
    };
    fetchComponents();
  }, []);

  const handleCategoryToggle = (category) => {
    setSelectedCategories(prev => ({ ...prev, [category]: !prev[category] }));
    setFilterClicked(false);
  };

  // Шаблонные конфигурации
  const predefinedTemplates = useMemo(() => {
    if (!components.length) return [];

    const getCheapest = (category) => components
      .filter(c => c.category === category && c.price > 0)
      .sort((a, b) => a.price - b.price)[0];

    const getMidRange = (category) => {
      const sorted = components
        .filter(c => c.category === category && c.price > 0)
        .sort((a, b) => a.score - b.score);
      return sorted[Math.floor(sorted.length / 2)] || sorted[0];
    };

    const getHighPerformance = (category) => components
      .filter(c => c.category === category && c.price > 0)
      .sort((a, b) => b.score - a.score)[0];

    // Проверка совместимости
    const checkCompatibility = (config) => {
      if (config.motherboard && config.processor && config.motherboard.socket !== config.processor.socket) return false;
      if (config.case && config.motherboard && config.case.supportedFormFactors && config.motherboard.formFactor) {
        const caseForms = config.case.supportedFormFactors.split(',').map(f => f.trim().toLowerCase());
        if (!caseForms.includes(config.motherboard.formFactor.toLowerCase())) return false;
      }
      if (config.powerSupply && config.processor) {
        const requiredPower = (config.processor.power || 0) + (config.graphicsCard?.power || 0) + (config.cooler?.power || 0) + 100;
        if (config.powerSupply.wattage < requiredPower) return false;
      }
      if (config.motherboard && config.ram && config.motherboard.ramType && config.ram.ramType) {
        if (config.motherboard.ramType !== config.ram.ramType) return false;
      }
      if (config.motherboard && config.storage && config.motherboard.supportedInterfaces && config.storage.interface) {
        const supported = config.motherboard.supportedInterfaces.split(',').map(i => i.trim().toLowerCase());
        if (!supported.includes(config.storage.interface.toLowerCase())) return false;
      }
      if (config.motherboard && config.graphicsCard && config.motherboard.pcieVersion && config.graphicsCard.pcieVersion) {
        const moboPcie = config.motherboard.pcieVersion.split(',').map(v => v.trim().toLowerCase());
        if (!moboPcie.includes(config.graphicsCard.pcieVersion.toLowerCase())) return false;
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
        description: 'Для лёгких игр на низких-средних настройках.',
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
        components: template.components.filter(c => activeCategories.includes(c.category)),
      }))
      .filter(template => template.components.length > 0 && checkCompatibility(template.components.reduce((acc, c) => ({ ...acc, [c.category]: c }), {})));
  }, [components, activeCategories]);

  // Генерация конфигураций по бюджету с проверкой совместимости
  const generateConfigurations = useCallback(() => {
    if (!components.length || !budget) return [];

    const budgetNumber = Number(budget);
    if (isNaN(budgetNumber) || budgetNumber <= 0) return [];

    // Фильтруем компоненты по выбранным категориям
    const filteredComponents = components.filter(c => activeCategories.includes(c.category));

    // Разделяем компоненты по категориям
    const grouped = {};
    activeCategories.forEach(cat => {
      grouped[cat] = filteredComponents.filter(c => c.category === cat).sort((a, b) => a.price - b.price);
    });

    // Проверка совместимости между двумя компонентами (например, процессор и материнская плата)
    const isCompatible = (compA, compB) => {
      if (!compA || !compB) return true;
      if (compA.category === 'processor' && compB.category === 'motherboard') {
        return compA.socket === compB.socket;
      }
      if (compA.category === 'motherboard' && compB.category === 'processor') {
        return compA.socket === compB.socket;
      }
      if (compA.category === 'ram' && compB.category === 'motherboard') {
        return compA.ramType === compB.ramType;
      }
      if (compA.category === 'motherboard' && compB.category === 'ram') {
        return compA.ramType === compB.ramType;
      }
      if (compA.category === 'storage' && compB.category === 'motherboard') {
        if (!compB.supportedInterfaces) return true;
        const supported = compB.supportedInterfaces.split(',').map(i => i.trim().toLowerCase());
        return supported.includes(compA.interface.toLowerCase());
      }
      if (compA.category === 'motherboard' && compB.category === 'storage') {
        if (!compA.supportedInterfaces) return true;
        const supported = compA.supportedInterfaces.split(',').map(i => i.trim().toLowerCase());
        return supported.includes(compB.interface.toLowerCase());
      }
      if (compA.category === 'graphicsCard' && compB.category === 'motherboard') {
        if (!compB.pcieVersion) return true;
        const supported = compB.pcieVersion.split(',').map(v => v.trim().toLowerCase());
        return supported.includes(compA.pcieVersion.toLowerCase());
      }
      if (compA.category === 'motherboard' && compB.category === 'graphicsCard') {
        if (!compA.pcieVersion) return true;
        const supported = compA.pcieVersion.split(',').map(v => v.trim().toLowerCase());
        return supported.includes(compB.pcieVersion.toLowerCase());
      }
      if (compA.category === 'cooler' && compB.category === 'processor') {
        return compA.socket === compB.socket;
      }
      if (compA.category === 'processor' && compB.category === 'cooler') {
        return compA.socket === compB.socket;
      }
      if (compA.category === 'case' && compB.category === 'motherboard') {
        if (!compA.supportedFormFactors) return true;
        const supported = compA.supportedFormFactors.split(',').map(f => f.trim().toLowerCase());
        return supported.includes(compB.formFactor.toLowerCase());
      }
      if (compA.category === 'motherboard' && compB.category === 'case') {
        if (!compB.supportedFormFactors) return true;
        const supported = compB.supportedFormFactors.split(',').map(f => f.trim().toLowerCase());
        return supported.includes(compA.formFactor.toLowerCase());
      }
      return true;
    };

    // Ищем все варианты с комбинацией (очень простая рекурсия с ограничением)
    const results = [];

    const categoriesToCombine = activeCategories;

    const helper = (index = 0, currentConfig = [], currentPrice = 0) => {
      if (index === categoriesToCombine.length) {
        if (currentPrice <= budgetNumber) {
          // Проверка совместимости всех пар
          const allCompatible = currentConfig.every((compA, i) =>
            currentConfig.every((compB, j) => {
              if (i === j) return true;
              return isCompatible(compA, compB);
            })
          );
          if (allCompatible) {
            results.push({ components: currentConfig, totalPrice: currentPrice });
          }
        }
        return;
      }

      const category = categoriesToCombine[index];
      const comps = grouped[category] || [];

      for (const comp of comps) {
        if (currentPrice + comp.price > budgetNumber) continue;
        helper(index + 1, [...currentConfig, comp], currentPrice + comp.price);
        if (results.length >= 20) break; // Ограничение на 20 вариантов
      }
    };

    helper();

    // Сортируем по цене по возрастанию
    return results.sort((a, b) => a.totalPrice - b.totalPrice).slice(0, 20);
  }, [components, budget, activeCategories]);

  useEffect(() => {
    if (filterClicked && budget) {
      const configs = generateConfigurations();
      setConfigurations(configs);
    } else {
      setConfigurations([]);
    }
  }, [filterClicked, budget, generateConfigurations]);

  return (
    <div className="pc-builder">
      <h1>Сборка компьютера</h1>

      <div className="filters">
        <h2>Выберите категории компонентов</h2>
        <div className="category-list">
          {categories.map(cat => (
            <label key={cat} style={{ marginRight: 10 }}>
              <input
                type="checkbox"
                checked={selectedCategories[cat]}
                disabled={cat === 'operatingSystem'}
                onChange={() => handleCategoryToggle(cat)}
              />
              {categoryTranslations[cat]}
            </label>
          ))}
        </div>

        <div style={{ marginTop: 20 }}>
          <label>
            Бюджет (в тенге):{' '}
            <input
              type="number"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              placeholder="Введите бюджет"
            />
          </label>
          <button
            onClick={() => setFilterClicked(true)}
            disabled={!budget || loading}
            style={{ marginLeft: 10 }}
          >
            Подобрать конфигурации
          </button>
        </div>
      </div>

      {loading && <p>Загрузка компонентов...</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}

      {/* Показываем шаблонные конфигурации, если не было клика по фильтру */}
      {!filterClicked && budget === '' && (
        <div className="templates" style={{ marginTop: 30 }}>
          <h2>Готовые шаблоны конфигураций</h2>
          {predefinedTemplates.length === 0 && <p>Шаблоны пока не доступны.</p>}
          {predefinedTemplates.map(template => (
            <div key={template.id} className="template" style={{ border: '1px solid #ccc', marginBottom: 20, padding: 10 }}>
              <h3>{template.name}</h3>
              <p>{template.description}</p>
              <ul>
                {template.components.map(comp => (
                  <li key={comp.id}>
                    {comp.name} — {comp.price.toLocaleString()} тг
                  </li>
                ))}
              </ul>
              <p><b>Итого:</b> {template.components.reduce((sum, c) => sum + c.price, 0).toLocaleString()} тг</p>
            </div>
          ))}
        </div>
      )}

      {/* Показываем результаты подбора по бюджету */}
      {filterClicked && budget && (
        <div className="results" style={{ marginTop: 30 }}>
          <h2>Подобранные конфигурации</h2>
          {configurations.length === 0 && !loading && <p>Конфигурации не найдены под указанный бюджет.</p>}
          {configurations.map((conf, idx) => (
            <div key={idx} style={{ border: '1px solid #999', marginBottom: 20, padding: 10 }}>
              <h3>Конфигурация #{idx + 1} — {conf.totalPrice.toLocaleString()} тг</h3>
              <ul>
                {conf.components.map(comp => (
                  <li key={comp.id}>
                    {categoryTranslations[comp.category]}: {comp.name} — {comp.price.toLocaleString()} тг
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default PCBuilder;
