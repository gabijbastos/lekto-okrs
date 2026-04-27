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
    var wa = norm(a).split(' ').filter(function(w) { return w.length > 3; });
    var wb = norm(b).split(' ').filter(function(w) { return w.length > 3; });
    var setA = {}, setB = {};
    wa.forEach(function(w) { setA[w] = true; });
    wb.forEach(function(w) { setB[w] = true; });
    if (wa.length === 0 || wb.length === 0) return 0;
    var inter = wa.filter(function(w) { return setB[w]; }).length;
    var uniao = Object.keys(Object.assign({}, setA, setB)).length;
    return inter / uniao;
  }

  function melhorMatch(textoHTML, tasks, threshold) {
    threshold = threshold || 0.3;
    var melhor = null;
    var melhorScore = 0;
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
    var label = statusLabel || (status.charAt(0).toUpperCase() + status.slice(1));
    el.appendChild(document.createTextNode(label));
    return true;
  }

  function exibirBadge(msg, cor) {
    var b = document.createElement('div');
    b.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:9999;background:' + (cor || '#1F2937') + ';color:#E5E7EB;font-family:Mulish,system-ui,sans-serif;font-size:12px;font-weight:600;padding:8px 16px;border-radius:999px;display:flex;align-items:center;gap:8px;box-shadow:0 4px 16px rgba(0,0,0,0.25);opacity:0;transform:translateY(8px);transition:all 0.4s ease;';
    b.innerHTML = '<span style="width:8px;height:8px;border-radius:50%;background:#10B981;flex-shrink:0"></span>' + msg;
    document.body.appendChild(b);
    requestAnimationFrame(function() { b.style.opacity = '1'; b.style.transform = 'translateY(0)'; });
    setTimeout(function() {
      b.style.opacity = '0'; b.style.transform = 'translateY(8px)';
      setTimeout(function() { b.remove(); }, 400);
    }, 8000);
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

        // Objetivos = sem parentId, Resultados = com parentId
        var objetivos = tasks.filter(function(t) { return !t.parentId; });
        var resultados = tasks.filter(function(t) { return !!t.parentId; });

        var atualizados = 0;

        document.querySelectorAll('.objetivo-bloco').forEach(function(bloco) {
          var objTextEl = bloco.querySelector('.obj-text');
          if (!objTextEl) return;

          var match = melhorMatch(objTextEl.textContent, objetivos);
          if (match && match.status !== 'cinza') {
            var farolEl = bloco.querySelector('.farol-obj .farol');
            if (aplicarFarol(farolEl, match.status, match.statusLabel)) atualizados++;
          }

          bloco.querySelectorAll('.resultado').forEach(function(rEl) {
            var rTextoEl = rEl.querySelector('.resultado-texto');
            if (!rTextoEl) return;
            var rMatch = melhorMatch(rTextoEl.textContent, resultados);
            if (rMatch && rMatch.status !== 'cinza') {
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
        console.log('[Lekto OKR] ' + atualizados + ' farois atualizados. Objetivos: ' + objetivos.length + ', Resultados: ' + resultados.length);
      })
      .catch(function(err) {
        console.warn('[Lekto OKR] Erro:', err.message);
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { setTimeout(carregarFarois, 2500); });
  } else {
    setTimeout(carregarFarois, 2500);
  }

  setInterval(carregarFarois, 15 * 60 * 1000);
})();
