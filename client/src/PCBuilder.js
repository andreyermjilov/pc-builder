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
  const [budget, setBudget] = useState('');
  const [configurations, setConfigurations] = useState([]);
  const [error, setError] = useState(null);

  const categories = Object.keys(categoryTranslations);

  const normalizeComponent = (item) => {
    const category = item.category?.trim();
    const component = {
      ...item,
      category,
      price: Number(item.price) || 0,
      socket: item.socket?.trim() || '',
      power: Number(item.power) || 0,
      formFactor: item.formFactor?.trim().toLowerCase() || '',
      resolution: item.resolution?.trim() || '',
      wattage: Number(item.wattage) || 0,
      type: item.type?.trim() || '',
      version: item.version?.trim() || '',
      frequency: Number(item.frequency) || 0,
      cores: Number(item.cores) || 0,
      memory: Number(item.memory) || 0,
      capacity: Number(item.capacity) || 0,
    };

    // Вычисление score вместо performance
    switch (category) {
      case 'processor':
        component.score = component.frequency * 10 + component.cores * 5;
        break;
      case 'graphicsCard':
        component.score = component.memory * 10;
        break;
      case 'ram':
        component.score = component.frequency / 100 + component.capacity;
        break;
      default:
        component.score = 1;
    }

    return component;
  };

  const fetchComponents = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/components`);
      const data = await res.json();
      if (!Array.isArray(data)) throw new Error('Неверный формат данных');
      const normalized = data.map(normalizeComponent);
      setComponents(normalized);
    } catch (err) {
      setError('Ошибка загрузки компонентов');
    }
  };

  useEffect(() => {
    fetchComponents();
  }, []);

  const isCompatible = (config, component, category) => {
    switch (category) {
      case 'motherboard':
        return !config.processor || config.processor.socket === component.socket;
      case 'cooler':
        if (!config.processor) return true;
        return component.socket?.split(',').map(s => s.trim()).includes(config.processor.socket);
      case 'case':
        if (!config.motherboard) return true;
        return component.formFactor.includes(config.motherboard.formFactor);
      case 'powerSupply':
        const requiredPower = (config.processor?.power || 0) + (config.graphicsCard?.power || 0) + 100;
        return component.wattage >= requiredPower;
      default:
        return true;
    }
  };

  const generateConfigurations = useCallback((maxBudget) => {
    const categories = [
      'processor', 'motherboard', 'ram', 'storage',
      'case', 'cooler', 'monitor', 'powerSupply',
      'keyboard', 'mouse'
    ];

    const configs = [];

    const build = (current, index, price, score) => {
      if (index === categories.length) {
        if (price <= maxBudget) {
          configs.push({ ...current, totalPrice: price, totalScore: score });
        }
        return;
      }

      const category = categories[index];
      const items = components.filter(c => c.category === category);
      for (const item of items) {
        if (!isCompatible(current, item, category)) continue;
        build({ ...current, [category]: item }, index + 1, price + item.price, score + item.score);
      }

      // Видеокарта — добавляем только если у процессора нет встроенной графики
      if (category === 'powerSupply' && current.processor && !current.processor.integratedGraphics) {
        const gpus = components.filter(c => c.category === 'graphicsCard');
        for (const gpu of gpus) {
          if (!isCompatible(current, gpu, 'graphicsCard')) continue;
          build({ ...current, graphicsCard: gpu }, index + 1, price + gpu.price, score + gpu.score);
        }
      } else {
        build(current, index + 1, price, score);
      }
    };

    build({}, 0, 0, 0);

    return configs.sort((a, b) => a.totalPrice - b.totalPrice);
  }, [components]);

  const handleGenerate = () => {
    setError(null);
    const max = parseInt(budget);
    if (isNaN(max) || max <= 0) {
      setError('Введите корректный бюджет');
      return;
    }
    const configs = generateConfigurations(max);
    if (configs.length === 0) {
      setError('Не удалось собрать конфигурации');
    } else {
      setConfigurations(configs.slice(0, 5));
    }
  };

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">🖥️ Подбор ПК</h1>
      <input
        type="number"
        placeholder="Введите бюджет"
        value={budget}
        onChange={e => setBudget(e.target.value)}
        className="border px-3 py-1 rounded mr-2"
      />
      <button onClick={handleGenerate} className="bg-blue-600 text-white px-4 py-1 rounded">Подобрать</button>

      {error && <p className="text-red-500 mt-4">{error}</p>}

      <div className="mt-6 space-y-4">
        {configurations.map((cfg, i) => (
          <div key={i} className="p-4 border rounded shadow">
            <h2 className="font-bold text-lg mb-2">Сборка #{i + 1}</h2>
            {categories.map(cat => (
              cfg[cat] && (
                <p key={cat}><strong>{categoryTranslations[cat]}:</strong> {cfg[cat].name}</p>
              )
            ))}
            <p className="mt-2"><strong>💰 Стоимость:</strong> {cfg.totalPrice.toLocaleString()} ₸</p>
            <p><strong>⚡ Score:</strong> {cfg.totalScore}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default PCBuilder;
