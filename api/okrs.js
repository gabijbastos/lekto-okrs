const CLICKUP_API = 'https://api.clickup.com/api/v2';

function normalizarFarol(valor) {
  if (!valor) return 'cinza';
  const v = valor.toLowerCase();
  if (v.includes('verde')) return 'verde';
  if (v.includes('amarelo')) return 'amarelo';
  if (v.includes('vermelho')) return 'vermelho';
  if (v.includes('conclu')) return 'concluido';
  return 'cinza';
}

function labelFarol(valor) {
  if (!valor) return '';
  if (valor.toLowerCase().includes('verde')) return 'Verde';
  if (valor.toLowerCase().includes('amarelo')) return 'Amarelo';
  if (valor.toLowerCase().includes('vermelho')) return 'Vermelho';
  if (valor.toLowerCase().includes('conclu')) return 'Concluido';
  return valor;
}

function getCampo(task, nomeCampo) {
  const campos = task.custom_fields || [];
  const campo = campos.find(c => c.name.toLowerCase().trim() === nomeCampo.toLowerCase().trim());
  if (!campo || campo.value === null || campo.value === undefined) return null;
  if (campo.type === 'drop_down') {
    const opcoes = campo.type_config && campo.type_config.options ? campo.type_config.options : [];
    const sel = opcoes.find(o => o.orderindex === campo.value);
    return sel ? sel.name : null;
  }
  if (campo.type === 'labels') {
    if (Array.isArray(campo.value) && campo.value.length > 0) {
      const opcoes = campo.type_config && campo.type_config.options ? campo.type_config.options : [];
      return campo.value.map(function(idx) {
        const opt = opcoes.find(o => o.id === idx || o.orderindex === idx);
        return opt ? (opt.label || opt.name) : String(idx);
      }).join(', ');
    }
    return null;
  }
  if (typeof campo.value === 'string') return campo.value;
  return null;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const CLICKUP_API_KEY = process.env.CLICKUP_API_KEY;
  const CLICKUP_LIST_ID = process.env.CLICKUP_LIST_ID;

  if (!CLICKUP_API_KEY || !CLICKUP_LIST_ID) {
    return res.status(500).json({ error: 'Variaveis de ambiente nao configuradas.' });
  }

  try {
    let allTasks = [];
    let page = 0;
    let hasMore = true;

    while (hasMore) {
      const url = CLICKUP_API + '/list/' + CLICKUP_LIST_ID + '/task?include_closed=true&subtasks=true&page=' + page;
      const response = await fetch(url, {
        headers: { Authorization: CLICKUP_API_KEY, 'Content-Type': 'application/json' },
      });
      if (!response.ok) {
        const txt = await response.text();
        throw new Error('ClickUp API ' + response.status + ': ' + txt);
      }
      const data = await response.json();
      allTasks = allTasks.concat(data.tasks || []);
      hasMore = data.tasks && data.tasks.length === 100;
      page++;
    }

    const farolPorId = {};
    for (const task of allTasks) {
      const farolValor = getCampo(task, 'Farol');
      const tipoValor = getCampo(task, 'Tipo de tarefa');
      const temaValor = getCampo(task, 'Tema Estrategico');
      farolPorId[task.id] = {
        id: task.id,
        nome: task.name,
        status: normalizarFarol(farolValor),
        statusLabel: labelFarol(farolValor),
        tipo: tipoValor || '',
        tema: temaValor || '',
        parentId: task.parent || null,
      };
    }

    return res.status(200).json({ atualizadoEm: new Date().toISOString(), tasks: farolPorId });
  } catch (err) {
    console.error('Erro:', err);
    return res.status(500).json({ error: err.message });
  }
};
