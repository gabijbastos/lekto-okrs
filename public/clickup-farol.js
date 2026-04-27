/**
 * clickup-farol.js
 * Busca os farois atualizados do /api/okrs e aplica no HTML
 * renderizado pelo planejamento estratégico.
 *
 * Como funciona:
 * 1. Faz GET /api/okrs
 * 2. Para cada objetivo/resultado encontrado pelo nome (match exato ou parcial)
 *    atualiza a classe .farol correspondente no DOM
 * 3. Exibe a data/hora da última atualização
 */

(function () {
  'use strict';

  // Aguarda o HTML estar renderizado antes de iniciar
  function iniciarIntegracao() {
    carregarFarois();
  }

  // Normaliza string para comparação tolerante
  function normalizar(str) {
    return (str || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Aplica classe farol num elemento
  function aplicarFarol(el, status, label) {
    if (!el) return;
    // Remove classes anteriores
    el.classList.remove('verde', 'amarelo', 'vermelho', 'cinza', 'concluido');
    el.classList.add(status);

    // Atualiza o texto do label dentro do .farol
    const dot = el.querySelector('.dot');
    el.textContent = '';
    if (dot) {
      el.appendChild(dot);
    } else {
      const novoDot = document.createElement('span');
      novoDot.className = 'dot';
      el.appendChild(novoDot);
    }
    el.appendChild(document.createTextNode(label || capitalize(status)));
  }

  function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  // Encontra elemento .farol-obj dentro de um bloco de objetivo pelo texto
  function encontrarFarolObjetivo(textoObjetivo) {
    const blocos = document.querySelectorAll('.objetivo-bloco');
    for (const bloco of blocos) {
      const objText = bloco.querySelector('.obj-text');
      if (!objText) continue;
      if (normalizar(objText.textContent).includes(normalizar(textoObjetivo).slice(0, 40))) {
        return bloco.querySelector('.farol-obj .farol');
      }
    }
    return null;
  }

  // Encontra elementos .farol dentro dos resultados pelo texto
  function encontrarFarolResultado(textoResultado) {
    const resultados = document.querySelectorAll('.resultado');
    for (const r of resultados) {
      const txt = r.querySelector('.resultado-texto');
      if (!txt) continue;
      if (normalizar(txt.textContent).includes(normalizar(textoResultado).slice(0, 40))) {
        return r.querySelector('.farol');
      }
    }
    return null;
  }

  // Exibe badge de status da integração no topo da página
  function exibirBadgeStatus(atualizadoEm, totalAtualizacoes) {
    const existente = document.getElementById('clickup-badge');
    if (existente) existente.remove();

    const badge = document.createElement('div');
    badge.id = 'clickup-badge';

    const data = new Date(atualizadoEm);
    const dataFormatada = data.toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });

    badge.innerHTML = `
      <span class="badge-dot"></span>
      <span>Farois atualizados via ClickUp · ${dataFormatada} · ${totalAtualizacoes} atualizações</span>
    `;

    badge.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 999;
      background: #1F2937;
      color: #E5E7EB;
      font-family: 'Mulish', system-ui, sans-serif;
      font-size: 12px;
      font-weight: 600;
      padding: 8px 16px;
      border-radius: 999px;
      display: flex;
      align-items: center;
      gap: 8px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.25);
      letter-spacing: 0.01em;
      opacity: 0;
      transform: translateY(8px);
      transition: all 0.4s ease;
    `;

    const dot = badge.querySelector('.badge-dot');
    dot.style.cssText = `
      width: 8px; height: 8px; border-radius: 50%;
      background: #10B981; flex-shrink: 0;
      box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.3);
    `;

    document.body.appendChild(badge);

    // Anima entrada
    requestAnimationFrame(() => {
      badge.style.opacity = '1';
      badge.style.transform = 'translateY(0)';
    });

    // Remove após 8 segundos
    setTimeout(() => {
      badge.style.opacity = '0';
      badge.style.transform = 'translateY(8px)';
      setTimeout(() => badge.remove(), 400);
    }, 8000);
  }

  // Exibe badge de erro
  function exibirBadgeErro(msg) {
    const badge = document.createElement('div');
    badge.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 999;
      background: #7F1D1D;
      color: #FCA5A5;
      font-family: 'Mulish', system-ui, sans-serif;
      font-size: 12px;
      font-weight: 600;
      padding: 8px 16px;
      border-radius: 999px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.25);
    `;
    badge.textContent = `⚠ Farol ClickUp indisponível: ${msg}`;
    document.body.appendChild(badge);
    setTimeout(() => badge.remove(), 6000);
  }

  // Função principal
  async function carregarFarois() {
    try {
      const res = await fetch('/api/okrs');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      let totalAtualizacoes = 0;

      for (const tema of (data.temas || [])) {
        for (const obj of (tema.objetivos || [])) {

          // Atualiza farol do objetivo
          const farolObj = encontrarFarolObjetivo(obj.objetivo);
          if (farolObj) {
            aplicarFarol(farolObj, obj.status, obj.statusLabel);
            totalAtualizacoes++;
          }

          // Atualiza farol de cada resultado-chave
          for (const r of (obj.resultados || [])) {
            const farolR = encontrarFarolResultado(r.texto);
            if (farolR) {
              aplicarFarol(farolR, r.status, r.statusLabel);
              totalAtualizacoes++;
            }
          }
        }
      }

      exibirBadgeStatus(data.atualizadoEm, totalAtualizacoes);
      console.log(`[Lekto OKR] ${totalAtualizacoes} farois atualizados do ClickUp.`);

    } catch (err) {
      console.warn('[Lekto OKR] Erro ao carregar farois do ClickUp:', err.message);
      exibirBadgeErro(err.message);
    }
  }

  // Inicia após o DOM estar pronto
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciarIntegracao);
  } else {
    // Espera um tick para o JS do HTML renderizar os elementos
    setTimeout(iniciarIntegracao, 800);
  }

  // Atualiza automaticamente a cada 15 minutos
  setInterval(carregarFarois, 15 * 60 * 1000);

})();
