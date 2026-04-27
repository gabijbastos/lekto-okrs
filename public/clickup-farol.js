/**
 * clickup-farol.js — v2
 * Match por similaridade de texto (Jaccard) para casar tasks do ClickUp
 * com os elementos do HTML mesmo quando os textos diferem levemente.
 */

(function () {
  'use strict';

  function norm(str) {
    return (str || '')
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function similaridade(a, b) {
    const wa = new Set(norm(a).split(' ').filter(w => w.length > 3));
    const wb = new Set(norm(b).split(' ').filter(w => w.length > 3));
    if (wa.size === 0 || wb.size === 0) return 0;
    const intersecao = [...wa].filter(w => wb.has(w)).length;
    const uniao = new Set([...wa, ...wb]).size;
    return intersecao / uniao;
  }

  function melhorMatch(textoHTML, tasks, threshold) {
    threshold = threshold || 0.35;
    let melhor = null;
    let melhorScore = 0;
    for (var i = 0; i < tasks.length; i++) {
      var score = similaridade(textoHTML, tasks[i].nome);
      if (score > melhorScore) {
        melhorScore = score;
        melhor = tasks[i];
      }
    }
    return melhorScore >= threshold ? melhor : null;
  }

  function aplicarFarol(el, status, statusLabel) {
    if (!el) return false;
    el.classList.remove('verde', 'amarelo', 'vermelho', 'cinza', 'concluido');
    el.classList.add(status);
    var dot = el.querySelector('.dot');
    if (!dot) { dot = document.createElement('span'); dot.className = 'dot'; }
    el.textContent = '';
    el.appendChild(dot);
    el.appendChild(document.createTextNode(statusLabel || capitalize(status)));
    return true;
  }

  function capitalize(s) {
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
  }

  function exibirBadge(msg, cor) {
    var b = document.createElement('div');
    b.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:9999;background:' + (cor || '#1F2937') + ';color:#E5E7EB;font-family:Mulish,system-ui,sans-serif;font-size:12px;font-weight:600;padding:8px 16px;border-radius:999px;display:flex;align-items:center;gap:8px;box-shadow:0 4px 16px rgba(0,0,0,0.25);opacity:0;transform:translateY(8px);transition:all 0.4s ease;';
    b.innerHTML = '<span style="width:8px;height:8px;border-radius:50%;background:#10B981;flex-shrink:0"></span>' + msg;
    document.body.appendChild(b);
    requestAnimationFrame(function() { b.style.opacity = '1'; b.style.transform = 'translateY(0)'; });
    setTimeout(function() { b.style.opacity = '0'; b.style.transform = 'translateY(8px)'; setTimeout(function() { b.remove(); }, 400); }, 8000);
  }

  function carregarFarois() {
    fetch('/api/okrs')
      .then(function(res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function(data) {
        if (data.error) throw new Error(data.error);

        var tasks = Object.values(data.tasks || {});
        var objetivos = tasks.filter(function(t) { return t.tipo === 'Objetivo'; });
        var resultados = tasks.filter(function(t) { return t.tipo === 'Resultado-chave'; });
        var atualizados = 0;

        document.querySelectorAll('.objetivo-bloco').forEach(function(bloco) {
          var objTextEl = bloco.querySelector('.obj-text');
          if (!objTextEl) return;

          var match = melhorMatch(objTextEl.textContent, objetivos);
          if (match) {
            var farolEl = bloco.querySelector('.farol-obj .farol');
            if (aplicarFarol(farolEl, match.status, match.statusLabel)) atualizados++;
          }

          bloco.querySelectorAll('.resultado').forEach(function(rEl) {
            var rTextoEl = rEl.querySelector('.resultado-texto');
            if (!rTextoEl) return;
            var rMatch = melhorMatch(rTextoEl.textContent, resultados);
            if (rMatch) {
              var farolEl = rEl.querySelector('.farol');
              if (aplicarFarol(farolEl, rMatch.status, rMatch.statusLabel)) atualizados++;
            }
          });
        });

        var dataFmt = new Date(data.atualizadoEm).toLocaleString('pt-BR', {
          day: '2-digit', month: '2-digit', year: 'numeric',
          hour: '2-digit', minute: '2-digit'
        });
        exibirBadge('Farois atualizados via ClickUp · ' + dataFmt + ' · ' + atualizados + ' itens');
        console.log('[Lekto OKR] ' + atualizados + ' farois atualizados.');
      })
      .catch(function(err) {
        console.warn('[Lekto OKR] Erro:', err.message);
        exibirBadge('Farol indisponivel: ' + err.message, '#7F1D1D');
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { setTimeout(carregarFarois, 1000); });
  } else {
    setTimeout(carregarFarois, 2500);
  }

  setInterval(carregarFarois, 15 * 60 * 1000);

})();
