import React, { useEffect, useState } from 'react';

const API_URL = 'https://pc-builder-backend-24zh.onrender.com/api/components';

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
};

export default function PCBuilder() {
  const [components, setComponents] = useState([]);
  const [compatibleBuilds, setCompatibleBuilds] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const categories = Object.keys(categoryTranslations);

  useEffect(() => {
    const fetchComponents = async () => {
      try {
        const response = await fetch(API_URL);
        const data = await response.json();

        const normalized = data.map(comp => ({
          ...comp,
          category: comp.category.trim(),
          price: Number(comp.price) || 0,
          score: Number(comp.score) || 0,
          socket: comp.socket?.trim() || '',
          power: Number(comp.power) || 0,
          formFactor: comp.formFactor?.trim() || '',
          resolution: comp.resolution?.trim() || '',
          wattage: Number(comp.wattage) || 0,
          type: comp.type?.trim() || '',
          version: comp.version?.trim() || '',
          frequency: Number(comp.frequency) || 0,
          cores: Number(comp.cores) || 0,
          memory: Number(comp.memory) || 0,
          ramType: comp.ramType?.trim() || '',
          capacity: Number(comp.capacity) || 0,
          interface: comp.interface?.trim() || '',
          supportedFormFactors: comp.supportedFormFactors?.trim() || '',
          supportedInterfaces: comp.supportedInterfaces?.trim() || '',
          pcieVersion: comp.pcieVersion?.trim() || '',
        }));

        setComponents(normalized);
        generateCompatibleBuilds(normalized);
      } catch (err) {
        console.error('Ошибка загрузки:', err);
        setError('Не удалось загрузить компоненты.');
      } finally {
        setLoading(false);
      }
    };

    fetchComponents();
  }, []);

  const groupByCategory = (items) => {
    return categories.reduce((acc, cat) => {
      acc[cat] = items.filter(item => item.category === cat);
      return acc;
    }, {});
  };

  const generateCompatibleBuilds = (components) => {
    const grouped = groupByCategory(components);
    const builds = [];

    for (const processor of grouped.processor) {
      const compatibleMotherboards = grouped.motherboard.filter(mb => mb.socket === processor.socket);
      for (const motherboard of compatibleMotherboards) {
        const compatibleRAM = grouped.ram.filter(ram => ram.ramType === motherboard.ramType);
        const compatibleCoolers = grouped.cooler.filter(cooler => cooler.socket.split(',').map(s => s.trim()).includes(processor.socket));
        const compatibleCases = grouped.case.filter(c => c.supportedFormFactors.split(',').map(f => f.trim().toLowerCase()).includes(motherboard.formFactor.toLowerCase()));
        const compatibleStorage = grouped.storage.filter(s => motherboard.supportedInterfaces.split(',').map(i => i.trim().toLowerCase()).includes(s.interface.toLowerCase()));
        const compatibleGPUs = grouped.graphicsCard.filter(gpu => motherboard.pcieVersion.split(',').map(v => v.trim().toLowerCase()).includes(gpu.pcieVersion.toLowerCase()));

        const requiredPower = (processor.power || 0);

        for (const ram of compatibleRAM) {
          for (const storage of compatibleStorage) {
            for (const gpu of compatibleGPUs) {
              const totalPower = requiredPower + (gpu.power || 0) + 100;
              const compatiblePSUs = grouped.powerSupply.filter(psu => psu.wattage >= totalPower);
              for (const psu of compatiblePSUs) {
                for (const caseItem of compatibleCases) {
                  for (const cooler of compatibleCoolers) {
                    const build = {
                      processor,
                      motherboard,
                      ram,
                      storage,
                      graphicsCard: gpu,
                      powerSupply: psu,
                      case: caseItem,
                      cooler,
                      totalPrice:
                        processor.price + motherboard.price + ram.price +
                        storage.price + gpu.price + psu.price +
                        caseItem.price + cooler.price,
                    };
                    builds.push(build);
                  }
                }
              }
            }
          }
        }
      }
    }

    setCompatibleBuilds(builds);
  };

  return (
    <div className="max-w-5xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6 text-center">🖥️ Совместимые сборки ПК</h1>

      {loading && <p className="text-center">Загрузка компонентов...</p>}
      {error && <p className="text-center text-red-600">{error}</p>}

      {!loading && compatibleBuilds.length === 0 && <p className="text-center text-gray-600">Нет подходящих конфигураций</p>}

      {compatibleBuilds.map((build, i) => (
        <div key={i} className="mb-8 p-4 border border-gray-300 rounded-lg shadow-sm bg-white">
          <h2 className="text-xl font-bold text-blue-600 mb-4">Сборка #{i + 1}</h2>
          <ul className="space-y-1 text-sm text-gray-800">
            {categories.map(cat => (
              build[cat] ? (
                <li key={cat}>
                  <strong>{categoryTranslations[cat]}:</strong> {build[cat].name}
                </li>
              ) : null
            ))}
          </ul>
          <p className="mt-3 font-bold text-green-700">💰 Стоимость: {build.totalPrice.toLocaleString()} ₸</p>
        </div>
      ))}
    </div>
  );
}

