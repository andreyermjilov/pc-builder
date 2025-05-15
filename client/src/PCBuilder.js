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
  const [incompatibleBuilds, setIncompatibleBuilds] = useState([]);
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
          socket: comp.socket?.trim().toLowerCase() || '',
          power: Number(comp.power) || 0,
          formFactor: comp.formFactor?.trim().toLowerCase() || '',
          resolution: comp.resolution?.trim() || '',
          wattage: Number(comp.wattage) || 0,
          type: comp.type?.trim().toLowerCase() || '',
          version: comp.version?.trim() || '',
          frequency: Number(comp.frequency) || 0,
          cores: Number(comp.cores) || 0,
          memory: Number(comp.memory) || 0,
          ramType: comp.ramType?.trim().toLowerCase() || '',
          capacity: Number(comp.capacity) || 0,
          interface: comp.interface?.trim().toLowerCase() || '',
          supportedFormFactors: comp.supportedFormFactors?.toLowerCase() || '',
          supportedInterfaces: comp.supportedInterfaces?.toLowerCase() || '',
          pcieVersion: comp.pcieVersion?.toLowerCase() || '',
        }));

        setComponents(normalized);
        generateBuilds(normalized);
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

  const generateBuilds = (components) => {
    const grouped = groupByCategory(components);
    const compatible = [];
    const incompatible = [];

    for (const cpu of grouped.processor) {
      const motherboards = grouped.motherboard.filter(mb => mb.socket === cpu.socket);
      for (const mb of motherboards) {
        const ramList = grouped.ram.filter(r => r.ramType === mb.ramType);
        const storageList = grouped.storage.filter(s => mb.supportedInterfaces.includes(s.interface));
        const gpuList = grouped.graphicsCard.filter(gpu => mb.pcieVersion.includes(gpu.pcieVersion));
        const coolerList = grouped.cooler.filter(cooler => cooler.socket.split(',').map(s => s.trim().toLowerCase()).includes(cpu.socket));
        const caseList = grouped.case.filter(c => c.supportedFormFactors.includes(mb.formFactor));
        const totalPower = cpu.power;

        for (const ram of ramList) {
          for (const storage of storageList) {
            for (const gpu of gpuList) {
              const requiredPower = totalPower + gpu.power + 100;
              const psus = grouped.powerSupply.filter(psu => psu.wattage >= requiredPower);

              for (const psu of psus) {
                for (const pcCase of caseList) {
                  for (const cooler of coolerList) {
                    const build = {
                      processor: cpu,
                      motherboard: mb,
                      ram,
                      storage,
                      graphicsCard: gpu,
                      powerSupply: psu,
                      case: pcCase,
                      cooler,
                    };

                    const totalPrice = Object.values(build).reduce((sum, comp) => sum + comp.price, 0);
                    const result = { ...build, totalPrice };

                    // Совместима?
                    const issues = getCompatibilityIssues(build);
                    if (issues.length === 0) {
                      compatible.push(result);
                    } else {
                      incompatible.push({ ...result, issues });
                    }
                  }
                }
              }
            }
          }
        }
      }
    }

    setCompatibleBuilds(compatible);
    setIncompatibleBuilds(incompatible);
  };

  const getCompatibilityIssues = (build) => {
    const issues = [];

    if (build.processor.socket !== build.motherboard.socket) {
      issues.push('Несовпадение сокета CPU и материнской платы');
    }
    if (build.motherboard.ramType !== build.ram.ramType) {
      issues.push('RAM не поддерживается материнской платой');
    }
    if (!build.motherboard.supportedInterfaces.includes(build.storage.interface)) {
      issues.push('Накопитель не поддерживается платой');
    }
    if (!build.motherboard.pcieVersion.includes(build.graphicsCard.pcieVersion)) {
      issues.push('PCIe версии не совпадают (видео ↔ плата)');
    }
    if (!build.case.supportedFormFactors.includes(build.motherboard.formFactor)) {
      issues.push('Форм-фактор платы не поддерживается корпусом');
    }
    const coolerSockets = build.cooler.socket.split(',').map(s => s.trim().toLowerCase());
    if (!coolerSockets.includes(build.processor.socket)) {
      issues.push('Кулер не поддерживает сокет процессора');
    }
    const requiredPower = build.processor.power + (build.graphicsCard?.power || 0) + 100;
    if (build.powerSupply.wattage < requiredPower) {
      issues.push('Недостаточная мощность блока питания');
    }

    return issues;
  };
  return (
    <div className="max-w-5xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6 text-center">🖥️ Совместимые сборки ПК</h1>

      {loading && <p className="text-center">Загрузка компонентов...</p>}
      {error && <p className="text-center text-red-600">{error}</p>}

      {!loading && compatibleBuilds.length === 0 && incompatibleBuilds.length === 0 && (
        <p className="text-center text-gray-600">Нет подходящих конфигураций</p>
      )}

      {compatibleBuilds.length > 0 && (
        <>
          <h2 className="text-2xl font-semibold mb-4 text-green-700">✅ Совместимые сборки:</h2>
          {compatibleBuilds.map((build, i) => (
            <div key={i} className="mb-8 p-4 border border-green-300 rounded-lg bg-green-50">
              <h3 className="text-xl font-bold text-green-800 mb-3">Сборка #{i + 1}</h3>
              <ul className="space-y-1 text-gray-800 text-sm">
                {Object.entries(build).map(([cat, comp]) => {
                  if (cat === 'totalPrice') return null;
                  return (
                    <li key={cat}>
                      <strong>{categoryTranslations[cat] || cat}:</strong> {comp.name} — {comp.price.toLocaleString()} ₸
                    </li>
                  );
                })}
              </ul>
              <p className="mt-3 font-bold text-green-900">Общая стоимость: {build.totalPrice.toLocaleString()} ₸</p>
            </div>
          ))}
        </>
      )}

      {incompatibleBuilds.length > 0 && (
        <>
          <h2 className="text-2xl font-semibold mb-4 text-red-700">❌ Несовместимые сборки (с причинами):</h2>
          {incompatibleBuilds.map((build, i) => (
            <div key={i} className="mb-8 p-4 border border-red-300 rounded-lg bg-red-50">
              <h3 className="text-xl font-bold text-red-800 mb-2">Сборка #{i + 1}</h3>
              <ul className="space-y-1 text-gray-800 text-sm">
                {Object.entries(build).map(([cat, comp]) => {
                  if (cat === 'totalPrice' || cat === 'issues') return null;
                  return (
                    <li key={cat}>
                      <strong>{categoryTranslations[cat] || cat}:</strong> {comp.name} — {comp.price.toLocaleString()} ₸
                    </li>
                  );
                })}
              </ul>
              <p className="mt-2 font-semibold text-red-900">Причины несовместимости:</p>
              <ul className="list-disc list-inside text-red-800 text-sm">
                {build.issues.map((issue, idx) => (
                  <li key={idx}>{issue}</li>
                ))}
              </ul>
              <p className="mt-3 font-bold text-red-900">Общая стоимость: {build.totalPrice.toLocaleString()} ₸</p>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
