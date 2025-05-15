import React, { useEffect, useState, useCallback } from 'react';

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
  const [configurations, setConfigurations] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const normalizeComponent = (item) => ({
    ...item,
    category: item.category?.trim() || '',
    price: Number(item.price) || 0,
    performance: Number(item.performance) || 0,
    socket: item.socket?.trim() || '',
    power: Number(item.power) || 0,
    formFactor: item.formFactor?.trim() || '',
    resolution: item.resolution?.trim() || '',
    wattage: Number(item.wattage) || 0,
    type: item.type?.trim() || '',
    version: item.version?.trim() || '',
  });

  useEffect(() => {
    const fetchComponents = async () => {
      setLoading(true);
      try {
        const response = await fetch(`${API_BASE_URL}/api/components`);
        const data = await response.json();
        const normalized = data.map(normalizeComponent).filter(c => c.name && c.price > 0 && c.category);
        setComponents(normalized);
      } catch (err) {
        setError('Ошибка загрузки: ' + err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchComponents();
  }, []);

  const generateCombinations = useCallback((componentsByCategory, categories) => {
    const results = [];
    const maxCombinations = 1000;

    const checkCompatibility = (category, component, config) => {
      if (category === 'motherboard' && config.processor && component.socket !== config.processor.socket)
        return false;
      if (category === 'ram' && config.motherboard) {
        const ramType = component.description?.toLowerCase();
        const mbDesc = config.motherboard.description?.toLowerCase();
        if (ramType && mbDesc && !mbDesc.includes(ramType)) return false;
      }
      if (category === 'cooler' && config.processor) {
        const sockets = (component.socket || '').split(',').map(s => s.trim());
        if (!sockets.includes(config.processor.socket)) return false;
      }
      if (category === 'case' && config.motherboard) {
        const caseFF = (component.formFactor || '').split(',').map(f => f.trim().toLowerCase());
        const mbFF = config.motherboard.formFactor?.toLowerCase();
        if (!caseFF.includes(mbFF)) return false;
      }
      if (category === 'powerSupply') {
        const totalPower = (config.processor?.power || 0) + (config.graphicsCard?.power || 0) + (config.cooler?.power || 0) + 100;
        if (component.wattage < totalPower) return false;
      }
      return true;
    };

    const build = (config, index) => {
      if (results.length >= maxCombinations) return;
      if (index >= categories.length) {
        results.push(config);
        return;
      }
      const cat = categories[index];
      for (const comp of componentsByCategory[cat] || []) {
        if (!checkCompatibility(cat, comp, config)) continue;
        build({ ...config, [cat]: comp, totalPerformance: (config.totalPerformance || 0) + (comp.performance || 0) }, index + 1);
      }
    };

    build({}, 0);
    return results;
  }, []);

  useEffect(() => {
    if (!components.length) return;

    const categories = Object.keys(categoryTranslations).filter(cat => cat !== 'operatingSystem');
    const grouped = categories.reduce((acc, cat) => {
      acc[cat] = components.filter(c => c.category === cat);
      return acc;
    }, {});
    const configs = generateCombinations(grouped, categories);
    const top = configs.sort((a, b) => b.totalPerformance - a.totalPerformance).slice(0, 5);
    setConfigurations(top);
  }, [components, generateCombinations]);

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-6">
      <div className="max-w-4xl mx-auto bg-white shadow-lg rounded-lg p-6">
        <h1 className="text-3xl font-bold mb-6 text-center text-gray-700">🛠️ Готовые совместимые сборки ПК</h1>

        {loading && <p className="text-blue-600 text-center">Загрузка компонентов...</p>}
        {error && <p className="text-red-600 text-center">{error}</p>}

        {!loading && !error && configurations.map((config, idx) => (
          <div key={idx} className="mb-6 p-4 border rounded bg-gray-50">
            <h2 className="text-xl font-semibold text-blue-700 mb-2">Сборка #{idx + 1}</h2>
            <ul className="space-y-1">
              {Object.keys(categoryTranslations).map(cat => {
                const comp = config[cat];
                return comp ? (
                  <li key={cat}>
                    <strong>{categoryTranslations[cat]}:</strong> {comp.name} ({comp.description})
                  </li>
                ) : null;
              })}
            </ul>
            <p className="text-sm text-gray-600 mt-2">Производительность: {config.totalPerformance}</p>
          </div>
        ))}

        {!loading && !error && configurations.length === 0 && (
          <p className="text-center text-yellow-600">Совместимые сборки не найдены.</p>
        )}
      </div>
    </div>
  );
}

export default PCBuilder;
