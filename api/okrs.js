/**
 * Vercel Serverless Function — /api/okrs
 * Busca tasks da lista "Farol estratégico" no ClickUp e retorna
 * os OKRs com status de farol para o frontend.
 *
 * Variáveis de ambiente necessárias no Vercel:
 *   CLICKUP_API_KEY  — Personal token do ClickUp (pk_XXXXXX)
 *   CLICKUP_LIST_ID  — ID da lista "Farol estratégico"
 */

const CLICKUP_API = 'https://api.clickup.com/api/v2';

// Normaliza o valor do farol para a classe CSS
function normalizarFarol(valor) {
  if (!valor) return 'cinza';
  const v = valor.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (v === 'verde') return 'verde';
  if (v === 'amarelo') return 'amarelo';
  if (v === 'vermelho') return 'vermelho';
  if (v === 'concluido' || v === 'concluído') return 'concluido';
  return 'cinza';
}

// Extrai o valor de um campo personalizado pelo nome
function getCampo(task, nomeCampo) {
  const campos = task.custom_fields || [];
  const campo = campos.find(
    c => c.name.toLowerCase() === nomeCampo.toLowerCase()
  );
  if (!campo) return null;

  // Campo dropdown/label
  if (campo.type === 'drop_down' || campo.type === 'labels') {
    const opcoes = campo.type_config?.options || [];
    const opcaoSelecionada = opcoes.find(o => o.orderindex === campo.value);
    return opcaoSelecionada?.name || null;
  }

  // Campo texto
  if (typeof campo.value === 'string') return campo.value;

  return null;
}

export default async function handler(req, res) {
  // CORS — permite o frontend consumir a API
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600'); // cache 5 min

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { CLICKUP_API_KEY, CLICKUP_LIST_ID } = process.env;

  if (!CLICKUP_API_KEY || !CLICKUP_LIST_ID) {
    return res.status(500).json({
      error: 'Variáveis de ambiente CLICKUP_API_KEY e CLICKUP_LIST_ID não configuradas.'
    });
  }

  try {
    // Busca todas as tasks da lista (com campos personalizados)
    let allTasks = [];
    let page = 0;
    let hasMore = true;

    while (hasMore) {
      const url = `${CLICKUP_API}/list/${CLICKUP_LIST_ID}/task?` +
        new URLSearchParams({
          include_closed: 'true',
          custom_fields: 'true',
          page: String(page),
          subtasks: 'true',
        });

      const response = await fetch(url, {
        headers: {
          Authorization: CLICKUP_API_KEY,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`ClickUp API error ${response.status}: ${errText}`);
      }

      const data = await response.json();
      allTasks = allTasks.concat(data.tasks || []);

      // ClickUp pagina em grupos de 100
      hasMore = data.tasks?.length === 100;
      page++;
    }

    // Separa objetivos e resultados-chave pelo campo "Tipo de tarefa"
    const objetivos = allTasks.filter(t => {
      const tipo = getCampo(t, 'Tipo de tarefa');
      return tipo?.toLowerCase() === 'objetivo';
    });

    const resultados = allTasks.filter(t => {
      const tipo = getCampo(t, 'Tipo de tarefa');
      return tipo?.toLowerCase() === 'resultado-chave';
    });

    // Agrupa resultados pelo parent (task pai = objetivo)
    const resultadosPorParent = {};
    for (const r of resultados) {
      const parentId = r.parent || r.id; // fallback
      if (!resultadosPorParent[parentId]) {
        resultadosPorParent[parentId] = [];
      }

      const farolValor = getCampo(r, 'Farol');
      resultadosPorParent[parentId].push({
        id: r.id,
        texto: r.name,
        status: normalizarFarol(farolValor),
        statusLabel: farolValor || '—',
        responsavel: r.assignees?.map(a => a.username || a.email).join(', ') || '—',
        url: r.url,
      });
    }

    // Agrupa objetivos por tema estratégico
    const temasPorNome = {};
    for (const obj of objetivos) {
      const tema = getCampo(obj, 'Tema Estratégico') || 'Sem tema';
      if (!temasPorNome[tema]) temasPorNome[tema] = [];

      const farolValor = getCampo(obj, 'Farol');
      temasPorNome[tema].push({
        id: obj.id,
        objetivo: obj.name,
        status: normalizarFarol(farolValor),
        statusLabel: farolValor || '—',
        resultados: resultadosPorParent[obj.id] || [],
        url: obj.url,
      });
    }

    // Monta a resposta final
    const payload = {
      atualizadoEm: new Date().toISOString(),
      temas: Object.entries(temasPorNome).map(([nome, objs]) => ({
        nome,
        objetivos: objs,
      })),
    };

    return res.status(200).json(payload);

  } catch (err) {
    console.error('Erro ao buscar ClickUp:', err);
    return res.status(500).json({ error: err.message });
  }
}
