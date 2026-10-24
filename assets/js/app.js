// Portal Costa Júnior — módulo Novos Negócios: funil de compradores de terrenos.
(function () {
  "use strict";

  const S = window.Store;

  // ---------- listas fixas ----------
  const ETAPAS = [
    { id: "novo", nome: "Novo contato" },
    { id: "conversa", nome: "Em conversa" },
    { id: "qualificado", nome: "Qualificado" },
    { id: "visita", nome: "Visita agendada" },
    { id: "proposta", nome: "Proposta" },
    { id: "negociacao", nome: "Negociação" },
    { id: "ganho", nome: "Vendido" },
    { id: "perdido", nome: "Perdido" },
  ];
  const RANK = Object.fromEntries(ETAPAS.map((e, i) => [e.id, i]));

  const CANAIS = [
    "Facebook (grupo)", "Facebook Marketplace", "OLX", "VivaReal", "Zap Imóveis", "Imovelweb",
    "Chaves na Mão", "Instagram", "Indicação", "Corretor parceiro", "Placa no terreno", "Outro",
  ].map((n) => ({ id: n, nome: n }));

  const OBJETIVOS = ["Morar", "Construir para renda", "Investir", "Revender", "Não informado"].map((n) => ({ id: n, nome: n }));
  const PAGAMENTOS = ["À vista", "Financiamento bancário", "Parcelado direto", "Entrada + parcelas", "Permuta", "Não informado"].map((n) => ({ id: n, nome: n }));
  const PRAZOS = ["Imediato", "Até 3 meses", "3 a 6 meses", "Mais de 6 meses", "Não informado"].map((n) => ({ id: n, nome: n }));
  const TEMPERATURAS = [
    { id: "quente", nome: "Quente" },
    { id: "morno", nome: "Morno" },
    { id: "frio", nome: "Frio" },
  ];
  const MOTIVOS_PERDA = [
    "Preço", "Localização", "Tamanho do lote", "Sem crédito / financiamento", "Comprou outro imóvel",
    "Desistiu da compra", "Parou de responder", "Outro",
  ].map((n) => ({ id: n, nome: n }));
  const STATUS_TERRENO = [
    { id: "disponivel", nome: "Disponível" },
    { id: "reservado", nome: "Reservado" },
    { id: "vendido", nome: "Vendido" },
  ];
  const DOCUMENTACAO = ["Escritura registrada", "Contrato de compra e venda", "Em regularização", "Outro"].map((n) => ({ id: n, nome: n }));
  const TIPOS_INTERACAO = ["Mensagem no anúncio", "WhatsApp", "Ligação", "Visita", "Proposta", "Nota"];

  // Placeholders: [nome] [terreno] [metragem] [valor] [condicoes] [dia]
  const MENSAGENS = [
    { titulo: "Resposta imediata", quando: "Assim que o interessado chamar no anúncio, grupo ou Direct.",
      texto: "Oi, [nome]! Obrigado pelo contato 😊 O terreno ainda está disponível. Você procura para morar, construir ou investir?" },
    { titulo: "Entender o perfil", quando: "Logo depois da primeira resposta. Faça uma pergunta por vez.",
      texto: "Qual tamanho de terreno você procura, mais ou menos?\nPensa em pagar à vista ou parcelado?\nPara quando seria a compra?" },
    { titulo: "Levar para o WhatsApp", quando: "Só para quem demonstrou interesse. Marque a autorização no cadastro.",
      texto: "Posso te mandar fotos, vídeo e a localização pelo WhatsApp? Fica mais fácil. Qual o seu número?" },
    { titulo: "Apresentar o terreno", quando: "Depois de entender o que a pessoa procura.",
      texto: "Tenho uma opção que encaixa bem: [terreno], com [metragem], por [valor] ([condicoes]). Fica em Mairinque, perto do Catarina Fashion Outlet, do Catarina Aeroporto Executivo e da região do futuro Cacau Park. Te mando fotos e a localização?" },
    { titulo: "Convite para visita", quando: "Quando o interessado está qualificado.",
      texto: "Que tal conhecer o terreno pessoalmente? Tenho horário em [dia]. Qual fica melhor para você?" },
    { titulo: "Retorno (2 dias sem resposta)", quando: "Use uma vez. Se não responder de novo, mova para Perdido > Parou de responder.",
      texto: "Oi, [nome]! Conseguiu ver as informações? A região está bem procurada por causa dos investimentos que estão chegando. Posso reservar uma visita para você?" },
    { titulo: "Objeção: preço", quando: "Quando disserem que está caro.",
      texto: "Entendo! Vale considerar o potencial de valorização da região, com o Cacau Park e o crescimento entre Sorocaba e Itu. Também temos [condicoes]. Quer que eu faça uma simulação para você?" },
    { titulo: "Depois da visita", quando: "No mesmo dia ou no dia seguinte à visita.",
      texto: "Oi, [nome]! Obrigado pela visita de hoje. O que achou do terreno? Se fizer sentido, já consigo te passar a proposta com as condições de pagamento." },
  ];

  // ---------- estado ----------
  const state = {
    leads: [],
    terrenos: [],
    loaded: false,
    loading: false,
    loadError: "",
    f: { q: "", etapa: "", canal: "", temp: "", terreno: "" },
  };

  // ---------- utilidades ----------
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  function uid() {
    return window.crypto && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
  }
  function todayISO() {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 10);
  }
  const moneyFmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
  const numFmt = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });
  const hasNum = (v) => v !== null && v !== undefined && v !== "" && !isNaN(Number(v));
  const fmtMoney = (v) => (hasNum(v) ? moneyFmt.format(Number(v)) : "—");
  const fmtNum = (v) => (hasNum(v) ? numFmt.format(Number(v)) : "");
  function fmtDate(iso) {
    if (!iso) return "—";
    const [y, m, d] = iso.slice(0, 10).split("-");
    return `${d}/${m}/${y}`;
  }
  function fmtDateTime(iso) {
    return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  }
  // Aceita "350.000", "350.000,50", "350000" e "1.234,5"
  function parseNum(raw) {
    let s = String(raw || "").trim().replace(/[R$\s]/g, "");
    if (!s) return null;
    if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
    else if ((s.match(/\./g) || []).length > 1 || /\.\d{3}$/.test(s)) s = s.replace(/\./g, "");
    const n = Number(s);
    return isNaN(n) ? NaN : n;
  }
  const nome = (list, id) => (list.find((x) => x.id === id) || {}).nome || id || "—";
  const pct = (a, b) => (b ? Math.round((a / b) * 100) + "%" : "—");

  function terrenoById(id) {
    return state.terrenos.find((t) => t.id === id);
  }
  function terrenoLabel(id) {
    const t = terrenoById(id);
    if (!t) return "—";
    return t.localizacao ? `${t.codigo} · ${t.localizacao}` : t.codigo;
  }
  function phoneDigits(p) {
    let d = String(p || "").replace(/\D/g, "");
    if (!d) return "";
    if (d.length <= 11) d = "55" + d;
    return d;
  }
  const isAtivo = (l) => l.etapa !== "ganho" && l.etapa !== "perdido";

  function followStatus(l) {
    if (!isAtivo(l) || !l.proximoPassoData) return null;
    const t = todayISO();
    if (l.proximoPassoData < t) return "late";
    if (l.proximoPassoData === t) return "today";
    return "future";
  }
  function followTag(l) {
    const s = followStatus(l);
    if (s === "late") return `<span class="tag late">⚠ Atrasado · ${fmtDate(l.proximoPassoData)}</span>`;
    if (s === "today") return `<span class="tag today">● Hoje</span>`;
    if (s === "future") return `<span class="tag">◷ ${fmtDate(l.proximoPassoData)}</span>`;
    return "";
  }
  function tempTag(t) {
    if (!t) return "";
    const icon = { quente: "▲", morno: "■", frio: "▼" }[t] || "";
    return `<span class="temp temp-${esc(t)}">${icon} ${esc(nome(TEMPERATURAS, t))}</span>`;
  }
  function etapaTag(id) {
    const cls = id === "ganho" ? "ok" : id === "perdido" ? "" : "red";
    return `<span class="tag ${cls}">${esc(nome(ETAPAS, id))}</span>`;
  }
  function sortByFollow(a, b) {
    const da = a.proximoPassoData || "9999-99-99";
    const db = b.proximoPassoData || "9999-99-99";
    if (da !== db) return da < db ? -1 : 1;
    return (b.atualizadoEm || "").localeCompare(a.atualizadoEm || "");
  }

  function fillTemplate(text, lead) {
    const t = lead && terrenoById(lead.terrenoId);
    const first = lead && lead.nome ? lead.nome.trim().split(/\s+/)[0] : "";
    return text
      .replace(/\[nome\]/g, first || "[nome]")
      .replace(/\[terreno\]/g, t ? t.codigo : "[terreno]")
      .replace(/\[metragem\]/g, t && hasNum(t.area) ? `${fmtNum(t.area)} m²` : "[metragem]")
      .replace(/\[valor\]/g, t && hasNum(t.preco) ? fmtMoney(t.preco) : "[valor]")
      .replace(/\[condicoes\]/g, t && t.condicoes ? t.condicoes : "[condicoes]");
  }

  let toastTimer;
  function toast(msg, isError) {
    const el = $("#toast");
    el.textContent = msg;
    el.classList.toggle("error", !!isError);
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), isError ? 5000 : 2600);
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch (e) {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    toast("Mensagem copiada.");
  }

  function download(filename, content, type) {
    const blob = new Blob([content], { type });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 500);
  }

  function toCSV(headers, rows) {
    const cell = (v) => {
      const s = String(v == null ? "" : v);
      return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    // ";" e BOM para o Excel em português abrir certo
    return "﻿" + [headers, ...rows].map((r) => r.map(cell).join(";")).join("\r\n");
  }

  function handleError(e) {
    console.error(e);
    if (e instanceof S.AuthError) {
      state.loaded = false;
      render();
    }
    toast(e && e.message ? e.message : "Erro inesperado.", true);
  }

  // ---------- dados ----------
  async function load() {
    state.loading = true;
    state.loadError = "";
    try {
      const [leads, terrenos] = await Promise.all([S.list("leads"), S.list("terrenos")]);
      state.leads = leads;
      state.terrenos = terrenos;
      state.loaded = true;
    } catch (e) {
      if (e instanceof S.AuthError) toast(e.message, true);
      state.loadError = e.message || "Não foi possível carregar os dados.";
    } finally {
      state.loading = false;
    }
    render();
  }

  function upsertLocal(list, rec) {
    const i = list.findIndex((x) => x.id === rec.id);
    if (i >= 0) list[i] = rec;
    else list.unshift(rec);
  }

  async function persistLead(lead) {
    lead.atualizadoEm = new Date().toISOString();
    await S.upsert("leads", lead);
    upsertLocal(state.leads, lead);
  }
  async function persistTerreno(t) {
    t.atualizadoEm = new Date().toISOString();
    await S.upsert("terrenos", t);
    upsertLocal(state.terrenos, t);
  }

  function logEntry(tipo, texto) {
    return { id: uid(), em: new Date().toISOString(), tipo, texto, por: S.user() || "" };
  }

  function applyEtapa(lead, novaEtapa) {
    if (lead.etapa === novaEtapa) return;
    const de = lead.etapa ? nome(ETAPAS, lead.etapa) : null;
    lead.historico = lead.historico || [];
    lead.historico.push(logEntry("Etapa", de ? `${de} → ${nome(ETAPAS, novaEtapa)}` : `Entrou em ${nome(ETAPAS, novaEtapa)}`));
    lead.etapa = novaEtapa;
    if (novaEtapa !== "perdido") lead.etapaMax = Math.max(lead.etapaMax || 0, RANK[novaEtapa]);
  }

  async function offerMarkSold(lead) {
    const t = terrenoById(lead.terrenoId);
    if (t && t.status !== "vendido" && confirm(`Marcar o terreno "${t.codigo}" como vendido?`)) {
      await persistTerreno({ ...t, status: "vendido", vendidoPara: lead.nome });
    }
  }

  async function moveLead(id, etapa) {
    const cur = state.leads.find((l) => l.id === id);
    if (!cur || cur.etapa === etapa) return;
    if (etapa === "perdido") {
      openLeadModal(cur, { etapa: "perdido" });
      return;
    }
    const lead = JSON.parse(JSON.stringify(cur));
    applyEtapa(lead, etapa);
    try {
      await persistLead(lead);
      if (etapa === "ganho") await offerMarkSold(lead);
      toast(`${lead.nome} → ${nome(ETAPAS, etapa)}`);
      render();
    } catch (e) {
      handleError(e);
    }
  }

  // ---------- modal ----------
  const modal = $("#modal");
  let onModalSave = null;

  function openModal({ title, body, foot, onSave, onMount }) {
    $("#modalTitle").textContent = title;
    $("#modalBody").innerHTML = body;
    $("#modalFoot").innerHTML = foot;
    modal.dataset.dirty = "";
    onModalSave = onSave || null;
    if (!modal.open) modal.showModal();
    $("#modalBody").scrollTop = 0;
    if (onMount) onMount($("#modalBody"), $("#modalFoot"));
    const first = $("#modalBody input, #modalBody select, #modalBody textarea");
    if (first) first.focus();
  }
  function closeModal(force) {
    if (!force && modal.dataset.dirty === "1" && !confirm("Descartar as alterações não salvas?")) return;
    modal.close();
  }
  modal.addEventListener("cancel", (e) => {
    e.preventDefault();
    closeModal();
  });
  modal.addEventListener("click", (e) => {
    if (e.target.closest("[data-close]")) closeModal();
  });
  modal.addEventListener("input", (e) => {
    if (e.target.closest("[data-nodirty]")) return;
    modal.dataset.dirty = "1";
  });
  $("#modalForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!onModalSave) return;
    const btn = $("#modalFoot button[type=submit]");
    if (btn) btn.disabled = true;
    try {
      const ok = await onModalSave(new FormData($("#modalForm")));
      if (ok !== false) closeModal(true);
    } catch (err) {
      handleError(err);
    } finally {
      if (btn) btn.disabled = false;
    }
  });

  function fieldError(name, msg) {
    const input = $(`#modalForm [name="${name}"]`);
    if (!input) return;
    const field = input.closest(".field");
    field.classList.add("invalid");
    let err = $(".err", field);
    if (!err) {
      err = document.createElement("span");
      err.className = "err";
      field.appendChild(err);
    }
    err.textContent = msg;
  }
  function clearErrors() {
    $$("#modalForm .field.invalid").forEach((f) => f.classList.remove("invalid"));
    $$("#modalForm .err").forEach((e) => e.remove());
  }

  // construtores de campos
  function fInput(name, label, val, o = {}) {
    const id = "f_" + name;
    return `<div class="field ${o.full ? "full" : ""}">
      <label for="${id}">${esc(label)}${o.req ? " *" : ""}</label>
      <input id="${id}" name="${name}" type="${o.type || "text"}" value="${esc(val == null ? "" : val)}" ${o.attrs || ""}>
      ${o.hint ? `<span class="hint">${esc(o.hint)}</span>` : ""}
    </div>`;
  }
  function fSelect(name, label, options, val, o = {}) {
    const id = "f_" + name;
    const opts = (o.empty !== undefined ? `<option value="">${esc(o.empty)}</option>` : "") +
      options.map((x) => `<option value="${esc(x.id)}" ${x.id === val ? "selected" : ""}>${esc(x.nome)}</option>`).join("");
    return `<div class="field ${o.full ? "full" : ""}" ${o.wrapAttrs || ""}>
      <label for="${id}">${esc(label)}${o.req ? " *" : ""}</label>
      <select id="${id}" name="${name}">${opts}</select>
      ${o.hint ? `<span class="hint">${esc(o.hint)}</span>` : ""}
    </div>`;
  }
  function fText(name, label, val, o = {}) {
    const id = "f_" + name;
    return `<div class="field ${o.full === false ? "" : "full"}">
      <label for="${id}">${esc(label)}</label>
      <textarea id="${id}" name="${name}" rows="${o.rows || 3}">${esc(val || "")}</textarea>
    </div>`;
  }
  const section = (t) => `<p class="section-title">${esc(t)}</p>`;

  // ---------- modal: interessado ----------
  function terrenoOptions(selectedId) {
    return state.terrenos
      .filter((t) => t.status !== "vendido" || t.id === selectedId)
      .map((t) => ({ id: t.id, nome: `${t.codigo}${t.localizacao ? " · " + t.localizacao : ""}${t.status === "vendido" ? " (vendido)" : ""}` }));
  }

  function timelineHTML(lead) {
    const items = (lead.historico || []).slice().reverse();
    if (!items.length) return `<p class="hint">Nenhum registro ainda.</p>`;
    return `<ul class="timeline">${items
      .map((h) => `<li class="${h.tipo === "Etapa" ? "k-etapa" : ""}">
        <div class="tl-meta">${esc(fmtDateTime(h.em))} · ${esc(h.tipo)}${h.por ? " · " + esc(h.por) : ""}</div>
        <div>${esc(h.texto)}</div></li>`)
      .join("")}</ul>`;
  }

  function openLeadModal(existing, overrides) {
    const isNew = !existing;
    const l = Object.assign(
      { etapa: "novo", temperatura: "morno", objetivo: "Não informado", pagamento: "Não informado", prazo: "Não informado" },
      existing || {},
      overrides || {}
    );
    const motivoVisible = l.etapa === "perdido";

    const body = `
      ${!isNew && overrides && overrides.etapa === "perdido" ? `<div class="notice">Informe o <b>motivo da perda</b> para mover para Perdido. Isso mostra onde ajustar preço, anúncio ou canal.</div>` : ""}
      <div class="form-grid">
        ${section("Contato")}
        ${fInput("nome", "Nome", l.nome, { req: true, attrs: 'autocomplete="off"' })}
        ${fInput("telefone", "Telefone / WhatsApp", l.telefone, { type: "tel", attrs: 'inputmode="tel" placeholder="(11) 99999-9999"' })}
        ${fInput("email", "E-mail", l.email, { type: "email" })}
        ${fSelect("canal", "Origem do contato", CANAIS, l.canal, { req: true, empty: "Selecione…" })}
        ${fInput("canalDetalhe", "Detalhe da origem", l.canalDetalhe, { full: true, hint: "Nome do grupo, link do anúncio ou quem indicou." })}
        <div class="field full">
          <label class="check"><input type="checkbox" name="autorizaWhatsapp" value="1" ${l.autorizaWhatsapp ? "checked" : ""}>
          <span>O interessado <b>pediu ou autorizou</b> contato pelo WhatsApp</span></label>
          <span class="hint">O botão de WhatsApp só aparece quando esta opção está marcada (LGPD).</span>
        </div>

        ${section("Interesse")}
        ${fSelect("terrenoId", "Terreno de interesse", terrenoOptions(l.terrenoId), l.terrenoId, { empty: state.terrenos.length ? "Ainda não definido" : "Cadastre terrenos na aba Terrenos" })}
        ${fSelect("objetivo", "Objetivo", OBJETIVOS, l.objetivo)}
        ${fSelect("pagamento", "Forma de pagamento", PAGAMENTOS, l.pagamento)}
        ${fInput("orcamento", "Orçamento (R$)", fmtNum(l.orcamento), { attrs: 'inputmode="decimal" placeholder="ex.: 250.000"' })}
        ${fSelect("prazo", "Prazo para comprar", PRAZOS, l.prazo)}
        ${fSelect("temperatura", "Temperatura", TEMPERATURAS, l.temperatura, { hint: "Quente: quer comprar logo. Frio: só pesquisando." })}

        ${section("Funil")}
        ${fSelect("etapa", "Etapa", ETAPAS, l.etapa, { req: true })}
        ${fSelect("motivoPerda", "Motivo da perda", MOTIVOS_PERDA, l.motivoPerda, { empty: "Selecione…", req: true, wrapAttrs: `data-motivo ${motivoVisible ? "" : "hidden"}` })}
        ${fInput("proximoPasso", "Próximo passo", l.proximoPasso, { attrs: 'placeholder="ex.: enviar fotos, confirmar visita"' })}
        ${fInput("proximoPassoData", "Data do próximo passo", l.proximoPassoData, { type: "date" })}
        ${fInput("valorProposta", "Valor da proposta (R$)", fmtNum(l.valorProposta), { attrs: 'inputmode="decimal"' })}
        ${fText("observacoes", "Observações", l.observacoes)}
      </div>

      ${isNew ? "" : `
      <div class="form-grid" style="margin-top:6px">
        ${section("Mensagem rápida")}
        <div class="field full" data-nodirty>
          <label for="f_tpl">Modelo</label>
          <select id="f_tpl">${MENSAGENS.map((m, i) => `<option value="${i}">${esc(m.titulo)}</option>`).join("")}</select>
        </div>
        <div class="field full" data-nodirty>
          <textarea id="f_tplText" rows="4" aria-label="Texto da mensagem"></textarea>
          <div class="actions">
            <button type="button" class="btn btn-ghost btn-sm" id="tplCopy">Copiar mensagem</button>
            ${l.autorizaWhatsapp && phoneDigits(l.telefone) ? `<a class="btn btn-wa btn-sm" id="tplWa" target="_blank" rel="noopener">Enviar no WhatsApp</a>` : ""}
          </div>
        </div>

        ${section("Histórico de contatos")}
        <div class="field full" data-nodirty>
          <div class="add-note">
            <select id="noteTipo" aria-label="Tipo de registro">${TIPOS_INTERACAO.map((t) => `<option>${esc(t)}</option>`).join("")}</select>
            <input id="noteTexto" placeholder="O que foi conversado?" aria-label="Descrição do contato">
            <button type="button" class="btn btn-ghost" id="noteAdd">Registrar</button>
          </div>
          <div id="timeline">${timelineHTML(l)}</div>
        </div>
      </div>`}
    `;

    const foot = `
      ${isNew ? "" : `<button type="button" class="btn btn-danger" id="leadDel">Excluir</button>`}
      <span class="spacer"></span>
      <button type="button" class="btn btn-ghost" data-close>Cancelar</button>
      <button type="submit" class="btn">${isNew ? "Cadastrar interessado" : "Salvar"}</button>`;

    openModal({
      title: isNew ? "Novo interessado" : l.nome,
      body,
      foot,
      onMount(root, footEl) {
        if (overrides) modal.dataset.dirty = "1";
        const etapaSel = $("#f_etapa", root);
        etapaSel.addEventListener("change", () => {
          $("[data-motivo]", root).hidden = etapaSel.value !== "perdido";
        });

        if (!isNew) {
          const tplSel = $("#f_tpl", root);
          const tplText = $("#f_tplText", root);
          const updateTpl = () => {
            tplText.value = fillTemplate(MENSAGENS[Number(tplSel.value)].texto, l);
            const wa = $("#tplWa", root);
            if (wa) wa.href = `https://wa.me/${phoneDigits(l.telefone)}?text=${encodeURIComponent(tplText.value)}`;
          };
          tplSel.addEventListener("change", updateTpl);
          tplText.addEventListener("input", () => {
            const wa = $("#tplWa", root);
            if (wa) wa.href = `https://wa.me/${phoneDigits(l.telefone)}?text=${encodeURIComponent(tplText.value)}`;
          });
          updateTpl();
          $("#tplCopy", root).addEventListener("click", () => copyText(tplText.value));

          const addNote = async () => {
            const texto = $("#noteTexto", root).value.trim();
            if (!texto) {
              $("#noteTexto", root).focus();
              return;
            }
            const stored = state.leads.find((x) => x.id === l.id);
            const copy = JSON.parse(JSON.stringify(stored));
            const entry = logEntry($("#noteTipo", root).value, texto);
            copy.historico = (copy.historico || []).concat(entry);
            copy.ultimoContato = entry.em;
            try {
              await persistLead(copy);
              l.historico = copy.historico;
              $("#timeline", root).innerHTML = timelineHTML(copy);
              $("#noteTexto", root).value = "";
              toast("Contato registrado.");
              render();
            } catch (e) {
              handleError(e);
            }
          };
          $("#noteAdd", root).addEventListener("click", addNote);
          $("#noteTexto", root).addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addNote();
            }
          });

          $("#leadDel", footEl).addEventListener("click", async () => {
            if (!confirm(`Excluir o interessado "${l.nome}"? Essa ação não pode ser desfeita.`)) return;
            try {
              await S.remove("leads", l.id);
              state.leads = state.leads.filter((x) => x.id !== l.id);
              closeModal(true);
              toast("Interessado excluído.");
              render();
            } catch (e) {
              handleError(e);
            }
          });
        }
      },
      async onSave(fd) {
        clearErrors();
        const v = (k) => String(fd.get(k) || "").trim();
        let ok = true;
        if (!v("nome")) { fieldError("nome", "Informe o nome."); ok = false; }
        if (!v("canal")) { fieldError("canal", "Informe de onde veio o contato."); ok = false; }
        if (v("email") && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v("email"))) { fieldError("email", "E-mail inválido."); ok = false; }
        if (fd.get("autorizaWhatsapp") && !phoneDigits(v("telefone"))) { fieldError("telefone", "Informe o telefone para contato no WhatsApp."); ok = false; }
        if (v("etapa") === "perdido" && !v("motivoPerda")) { fieldError("motivoPerda", "Informe o motivo da perda."); ok = false; }
        const orc = parseNum(v("orcamento"));
        const prop = parseNum(v("valorProposta"));
        if (Number.isNaN(orc)) { fieldError("orcamento", "Use só números, ex.: 250.000"); ok = false; }
        if (Number.isNaN(prop)) { fieldError("valorProposta", "Use só números, ex.: 250.000"); ok = false; }
        if (!ok) {
          const bad = $("#modalForm .field.invalid input, #modalForm .field.invalid select");
          if (bad) bad.focus();
          return false;
        }

        const stored = isNew ? null : state.leads.find((x) => x.id === l.id);
        const lead = stored ? JSON.parse(JSON.stringify(stored)) : { id: uid(), criadoEm: new Date().toISOString(), historico: [], etapaMax: 0 };
        Object.assign(lead, {
          nome: v("nome"),
          telefone: v("telefone"),
          email: v("email"),
          canal: v("canal"),
          canalDetalhe: v("canalDetalhe"),
          autorizaWhatsapp: !!fd.get("autorizaWhatsapp"),
          terrenoId: v("terrenoId"),
          objetivo: v("objetivo"),
          pagamento: v("pagamento"),
          orcamento: orc,
          prazo: v("prazo"),
          temperatura: v("temperatura"),
          motivoPerda: v("etapa") === "perdido" ? v("motivoPerda") : "",
          proximoPasso: v("proximoPasso"),
          proximoPassoData: v("proximoPassoData"),
          valorProposta: prop,
          observacoes: v("observacoes"),
        });
        if (isNew) {
          lead.historico.push(logEntry("Cadastro", `Interessado cadastrado · origem: ${lead.canal}${lead.canalDetalhe ? " (" + lead.canalDetalhe + ")" : ""}`));
          lead.etapa = null;
        }
        const virouGanho = v("etapa") === "ganho" && lead.etapa !== "ganho";
        applyEtapa(lead, v("etapa"));
        if (lead.etapa === "perdido" && stored && stored.motivoPerda !== lead.motivoPerda) {
          lead.historico.push(logEntry("Nota", `Motivo da perda: ${lead.motivoPerda}`));
        }
        await persistLead(lead);
        if (virouGanho) await offerMarkSold(lead);
        toast(isNew ? "Interessado cadastrado." : "Alterações salvas.");
        render();
      },
    });
  }

  // ---------- modal: terreno ----------
  function openTerrenoModal(existing) {
    const isNew = !existing;
    const t = Object.assign({ status: "disponivel" }, existing || {});
    const interessados = isNew ? [] : state.leads.filter((l) => l.terrenoId === t.id);

    const body = `
      <div class="form-grid">
        ${fInput("codigo", "Identificação", t.codigo, { req: true, attrs: 'placeholder="ex.: Lote 12 · Quadra B"' })}
        ${fSelect("status", "Situação", STATUS_TERRENO, t.status)}
        ${fInput("localizacao", "Localização", t.localizacao, { full: true, attrs: 'placeholder="Bairro / loteamento / rua — Mairinque/SP"' })}
        ${fInput("area", "Área (m²)", fmtNum(t.area), { attrs: 'inputmode="decimal"' })}
        ${fInput("dimensoes", "Dimensões", t.dimensoes, { attrs: 'placeholder="ex.: 10 x 30 m"' })}
        ${fInput("preco", "Preço (R$)", fmtNum(t.preco), { attrs: 'inputmode="decimal" placeholder="ex.: 180.000"' })}
        ${fInput("condicoes", "Condições de pagamento", t.condicoes, { attrs: 'placeholder="ex.: à vista ou 30% + 24x"' })}
        ${fInput("topografia", "Topografia", t.topografia, { attrs: 'placeholder="plano, aclive, declive"' })}
        ${fSelect("documentacao", "Documentação", DOCUMENTACAO, t.documentacao, { empty: "Selecione…" })}
        ${fInput("infraestrutura", "Infraestrutura", t.infraestrutura, { full: true, attrs: 'placeholder="água, luz, asfalto, esgoto…"' })}
        ${fText("anuncios", "Links dos anúncios", t.anuncios, { rows: 2 })}
        ${fText("observacoes", "Observações", t.observacoes)}
      </div>
      ${isNew ? "" : `
        <div class="form-grid" style="margin-top:6px">
          ${section(`Interessados neste terreno (${interessados.length})`)}
          <div class="field full">
            ${interessados.length
              ? `<ul class="timeline">${interessados.map((l) => `<li><b>${esc(l.nome)}</b> · ${esc(nome(ETAPAS, l.etapa))} · ${esc(l.canal || "")}</li>`).join("")}</ul>`
              : `<p class="hint">Nenhum interessado vinculado ainda.</p>`}
          </div>
        </div>`}
    `;
    const foot = `
      ${isNew ? "" : `<button type="button" class="btn btn-danger" id="terDel">Excluir</button>`}
      <span class="spacer"></span>
      <button type="button" class="btn btn-ghost" data-close>Cancelar</button>
      <button type="submit" class="btn">${isNew ? "Cadastrar terreno" : "Salvar"}</button>`;

    openModal({
      title: isNew ? "Novo terreno" : t.codigo,
      body,
      foot,
      onMount(root, footEl) {
        if (isNew) return;
        $("#terDel", footEl).addEventListener("click", async () => {
          const msg = interessados.length
            ? `Este terreno tem ${interessados.length} interessado(s) vinculado(s). Excluir mesmo assim? Eles ficarão sem terreno definido.`
            : `Excluir o terreno "${t.codigo}"?`;
          if (!confirm(msg)) return;
          try {
            await S.remove("terrenos", t.id);
            state.terrenos = state.terrenos.filter((x) => x.id !== t.id);
            for (const l of interessados) {
              await persistLead({ ...l, terrenoId: "" });
            }
            closeModal(true);
            toast("Terreno excluído.");
            render();
          } catch (e) {
            handleError(e);
          }
        });
      },
      async onSave(fd) {
        clearErrors();
        const v = (k) => String(fd.get(k) || "").trim();
        let ok = true;
        if (!v("codigo")) { fieldError("codigo", "Informe a identificação do terreno."); ok = false; }
        const area = parseNum(v("area"));
        const preco = parseNum(v("preco"));
        if (Number.isNaN(area)) { fieldError("area", "Use só números, ex.: 300"); ok = false; }
        if (Number.isNaN(preco)) { fieldError("preco", "Use só números, ex.: 180.000"); ok = false; }
        if (!ok) return false;
        const rec = Object.assign(isNew ? { id: uid(), criadoEm: new Date().toISOString() } : { ...existing }, {
          codigo: v("codigo"),
          status: v("status"),
          localizacao: v("localizacao"),
          area,
          dimensoes: v("dimensoes"),
          preco,
          condicoes: v("condicoes"),
          topografia: v("topografia"),
          documentacao: v("documentacao"),
          infraestrutura: v("infraestrutura"),
          anuncios: v("anuncios"),
          observacoes: v("observacoes"),
        });
        await persistTerreno(rec);
        toast(isNew ? "Terreno cadastrado." : "Alterações salvas.");
        render();
      },
    });
  }

  // ---------- telas ----------
  function pageHead(eyebrow, title, sub, actions) {
    return `<div class="page-head">
      <div><p class="eyebrow">${esc(eyebrow)}</p><h1>${esc(title)}</h1>${sub ? `<p class="sub">${sub}</p>` : ""}</div>
      ${actions ? `<div class="actions">${actions}</div>` : ""}
    </div>`;
  }
  const btnNewLead = `<button class="btn" data-new-lead>+ Novo interessado</button>`;
  const btnNewTerreno = `<button class="btn" data-new-terreno>+ Novo terreno</button>`;

  function localNotice() {
    if (S.mode !== "local") return "";
    return `<div class="notice"><span aria-hidden="true">⚠</span><span><b>Modo local:</b> os dados ficam salvos só neste navegador. Faça backups em <a href="#/nn/dados">Backup e exportação</a> ou configure o banco compartilhado (README) para a equipe usar junto.</span></div>`;
  }

  function viewInicio(el) {
    const ativos = state.leads.filter(isAtivo).length;
    const late = state.leads.filter((l) => followStatus(l) === "late").length;
    const disp = state.terrenos.filter((t) => t.status === "disponivel").length;
    el.innerHTML = `
      ${pageHead("Portal Costa Júnior", "Bem-vindo(a)", "Segurança, Responsabilidade e Excelência.")}
      ${localNotice()}
      <div class="card hero-card">
        <p class="eyebrow">Novos Negócios</p>
        <h2>Venda de terrenos · Mairinque/SP</h2>
        <p class="sub" style="color:var(--muted)">Controle os interessados que chegam pelo Facebook, OLX, VivaReal e outros portais, do primeiro contato até a venda.</p>
        <div class="kpis" style="margin:8px 0 0">
          <div class="card kpi"><p class="k-label">Interessados ativos</p><p class="k-value">${ativos}</p></div>
          <div class="card kpi ${late ? "alert" : ""}"><p class="k-label">Retornos atrasados</p><p class="k-value">${late}</p></div>
          <div class="card kpi"><p class="k-label">Terrenos disponíveis</p><p class="k-value">${disp}</p></div>
        </div>
        <div class="module-links">
          <a class="btn" href="#/nn/funil">Abrir funil</a>
          <a class="btn btn-ghost" href="#/nn/painel">Ver painel</a>
          <a class="btn btn-ghost" href="#/nn/mensagens">Mensagens prontas</a>
        </div>
      </div>`;
  }

  function barsHTML(rows, unit) {
    const max = Math.max(1, ...rows.map((r) => r.v));
    return `<div class="bars">${rows
      .map((r) => `<div class="bar-row" title="${esc(r.label)}: ${r.v} ${esc(unit)}">
        <span class="bar-label">${esc(r.label)}</span>
        <div class="bar-track"><div class="bar-fill" style="width:${(r.v / max) * 100}%"></div></div>
        <span class="bar-val">${r.v}</span></div>`)
      .join("")}</div>`;
  }

  function viewPainel(el) {
    const L = state.leads;
    const ativos = L.filter(isAtivo);
    const late = ativos.filter((l) => followStatus(l) === "late");
    const hoje = ativos.filter((l) => followStatus(l) === "today");
    const visitas = L.filter((l) => l.etapa === "visita");
    const emProposta = L.filter((l) => l.etapa === "proposta" || l.etapa === "negociacao");
    const somaProposta = emProposta.reduce((s, l) => s + (hasNum(l.valorProposta) ? Number(l.valorProposta) : 0), 0);
    const vendidos = L.filter((l) => l.etapa === "ganho");
    const somaVendas = vendidos.reduce((s, l) => s + (hasNum(l.valorProposta) ? Number(l.valorProposta) : 0), 0);
    const semData = ativos.filter((l) => !l.proximoPassoData).length;

    const proximos = ativos.filter((l) => l.proximoPassoData).sort(sortByFollow).slice(0, 10);

    const porCanal = CANAIS.map((c) => {
      const ls = L.filter((l) => l.canal === c.id);
      return {
        canal: c.nome,
        total: ls.length,
        qualif: ls.filter((l) => (l.etapaMax || 0) >= RANK.qualificado).length,
        visita: ls.filter((l) => (l.etapaMax || 0) >= RANK.visita).length,
        vend: ls.filter((l) => l.etapa === "ganho").length,
      };
    }).filter((r) => r.total).sort((a, b) => b.total - a.total);

    const perdidos = L.filter((l) => l.etapa === "perdido");
    const motivos = MOTIVOS_PERDA.map((m) => ({ label: m.nome, v: perdidos.filter((l) => l.motivoPerda === m.id).length })).filter((r) => r.v);

    const terr = STATUS_TERRENO.map((s) => ({ label: s.nome, v: state.terrenos.filter((t) => t.status === s.id).length }));
    const vgv = state.terrenos.filter((t) => t.status !== "vendido").reduce((s, t) => s + (hasNum(t.preco) ? Number(t.preco) : 0), 0);

    el.innerHTML = `
      ${pageHead("Novos Negócios", "Painel de vendas de terrenos", "Onde está cada interessado e quais canais trazem compradores.", btnNewLead)}
      ${localNotice()}
      <div class="kpis">
        <div class="card kpi"><p class="k-label">Interessados ativos</p><p class="k-value">${ativos.length}</p><p class="k-note">${L.length} no total</p></div>
        <div class="card kpi ${late.length ? "alert" : ""}"><p class="k-label">⚠ Retornos atrasados</p><p class="k-value">${late.length}</p><p class="k-note">${hoje.length} para hoje · ${semData} sem data</p></div>
        <div class="card kpi"><p class="k-label">Visitas agendadas</p><p class="k-value">${visitas.length}</p></div>
        <div class="card kpi"><p class="k-label">Em proposta / negociação</p><p class="k-value">${emProposta.length}</p><p class="k-note">${fmtMoney(somaProposta)}</p></div>
        <div class="card kpi"><p class="k-label">Vendidos</p><p class="k-value">${vendidos.length}</p><p class="k-note">${fmtMoney(somaVendas)} · conversão ${pct(vendidos.length, L.length)}</p></div>
      </div>

      <div class="grid grid-2">
        <section class="card card-pad">
          <h2>Próximos retornos</h2>
          ${proximos.length ? `<div class="table-wrap"><table>
            <thead><tr><th>Quando</th><th>Interessado</th><th>Próximo passo</th></tr></thead>
            <tbody>${proximos.map((l) => `<tr class="clickable" tabindex="0" data-open-lead="${esc(l.id)}">
              <td>${followTag(l)}</td><td><b>${esc(l.nome)}</b><br><span class="hint">${esc(nome(ETAPAS, l.etapa))}</span></td><td>${esc(l.proximoPasso || "—")}</td></tr>`).join("")}
            </tbody></table></div>` : `<div class="empty"><b>Nenhum retorno agendado</b>Preencha “Data do próximo passo” nos interessados para não perder o tempo da venda.</div>`}
        </section>

        <section class="card card-pad">
          <h2>Interessados por etapa</h2>
          ${L.length ? barsHTML(ETAPAS.map((e) => ({ label: e.nome, v: L.filter((l) => l.etapa === e.id).length })), "interessados") : `<div class="empty"><b>Sem dados ainda</b>Cadastre o primeiro interessado.</div>`}
        </section>
      </div>

      <section class="card card-pad" style="margin-top:16px">
        <h2>De onde vêm os compradores</h2>
        ${porCanal.length ? `<div class="table-wrap"><table>
          <thead><tr><th>Origem</th><th class="num">Interessados</th><th class="num">Qualificados</th><th class="num">Visitaram</th><th class="num">Vendidos</th><th class="num">Conversão</th></tr></thead>
          <tbody>${porCanal.map((r) => `<tr><td>${esc(r.canal)}</td><td class="num">${r.total}</td><td class="num">${r.qualif}</td><td class="num">${r.visita}</td><td class="num">${r.vend}</td><td class="num">${pct(r.vend, r.total)}</td></tr>`).join("")}</tbody>
        </table></div><p class="hint" style="margin-top:8px">Qualificados e visitaram contam quem chegou a essa etapa, mesmo que depois tenha sido perdido.</p>`
        : `<div class="empty"><b>Sem dados ainda</b>A origem de cada interessado aparece aqui para mostrar qual canal vende mais.</div>`}
      </section>

      <div class="grid grid-2" style="margin-top:16px">
        <section class="card card-pad">
          <h2>Motivos de perda</h2>
          ${motivos.length ? barsHTML(motivos, "perdidos") : `<div class="empty"><b>Nenhuma perda registrada</b>Ao mover para Perdido, o motivo aparece aqui.</div>`}
        </section>
        <section class="card card-pad">
          <h2>Terrenos</h2>
          ${state.terrenos.length ? barsHTML(terr, "terrenos") + `<p class="hint" style="margin-top:10px">Valor dos terrenos não vendidos: <b>${fmtMoney(vgv)}</b></p>` : `<div class="empty"><b>Nenhum terreno cadastrado</b><a href="#/nn/terrenos">Cadastre os terrenos disponíveis</a>.</div>`}
        </section>
      </div>`;
  }

  function filterBar(opts) {
    const f = state.f;
    return `<div class="filters">
      <input type="search" id="fq" placeholder="Buscar nome, telefone, e-mail…" value="${esc(f.q)}" aria-label="Buscar">
      ${opts.etapa ? `<select id="fetapa" aria-label="Etapa"><option value="">Todas as etapas</option>${ETAPAS.map((e) => `<option value="${e.id}" ${f.etapa === e.id ? "selected" : ""}>${esc(e.nome)}</option>`).join("")}</select>` : ""}
      <select id="fcanal" aria-label="Origem"><option value="">Todas as origens</option>${CANAIS.map((c) => `<option ${f.canal === c.id ? "selected" : ""}>${esc(c.nome)}</option>`).join("")}</select>
      <select id="ftemp" aria-label="Temperatura"><option value="">Todas as temperaturas</option>${TEMPERATURAS.map((t) => `<option value="${t.id}" ${f.temp === t.id ? "selected" : ""}>${esc(t.nome)}</option>`).join("")}</select>
      <select id="fterreno" aria-label="Terreno"><option value="">Todos os terrenos</option>${state.terrenos.map((t) => `<option value="${esc(t.id)}" ${f.terreno === t.id ? "selected" : ""}>${esc(t.codigo)}</option>`).join("")}</select>
    </div>`;
  }
  function bindFilters(el) {
    const map = { fq: "q", fetapa: "etapa", fcanal: "canal", ftemp: "temp", fterreno: "terreno" };
    Object.entries(map).forEach(([id, key]) => {
      const input = $("#" + id, el);
      if (!input) return;
      input.addEventListener(id === "fq" ? "input" : "change", () => {
        state.f[key] = input.value;
        if (id === "fq") {
          renderResults();
        } else {
          render();
        }
      });
    });
  }
  function filtered(useEtapa) {
    const f = state.f;
    const q = f.q.trim().toLowerCase();
    const qd = q.replace(/\D/g, "");
    return state.leads.filter((l) => {
      if (useEtapa && f.etapa && l.etapa !== f.etapa) return false;
      if (f.canal && l.canal !== f.canal) return false;
      if (f.temp && l.temperatura !== f.temp) return false;
      if (f.terreno && l.terrenoId !== f.terreno) return false;
      if (q) {
        const hay = `${l.nome} ${l.email} ${l.canalDetalhe} ${l.observacoes}`.toLowerCase();
        const phoneHit = qd && String(l.telefone || "").replace(/\D/g, "").includes(qd);
        if (!hay.includes(q) && !phoneHit) return false;
      }
      return true;
    });
  }

  // a busca redesenha só os resultados para não perder o foco do campo
  let renderResults = () => {};

  function viewFunil(el) {
    el.innerHTML = `
      ${pageHead("Novos Negócios", "Funil de compradores", "Arraste o cartão para mudar de etapa, ou clique para abrir.", btnNewLead)}
      ${localNotice()}
      ${filterBar({ etapa: false })}
      <div id="results"></div>`;
    bindFilters(el);

    renderResults = () => {
      const leads = filtered(false);
      $("#results", el).innerHTML = `<div class="kanban">${ETAPAS.map((e) => {
        const ls = leads.filter((l) => l.etapa === e.id).sort(sortByFollow);
        const soma = ls.reduce((s, l) => s + (hasNum(l.valorProposta) ? Number(l.valorProposta) : 0), 0);
        return `<section class="col ${e.id === "ganho" ? "won" : e.id === "perdido" ? "lost" : ""}" data-etapa="${e.id}" aria-label="${esc(e.nome)}">
          <div class="col-head"><h3>${esc(e.nome)}</h3><span class="count">${ls.length}</span></div>
          ${soma && ["proposta", "negociacao", "ganho"].includes(e.id) ? `<p class="hint" style="padding:0 4px">${fmtMoney(soma)}</p>` : ""}
          ${ls.map((l) => `<div class="lead-card t-${esc(l.temperatura || "")}" role="button" tabindex="0" draggable="true" data-id="${esc(l.id)}" data-open-lead="${esc(l.id)}">
              <span class="lc-name">${esc(l.nome)}</span>
              <span class="lc-meta">${esc(l.canal || "")}${l.terrenoId ? " · " + esc(terrenoLabel(l.terrenoId)) : ""}</span>
              ${l.proximoPasso && isAtivo(l) ? `<span class="lc-meta">→ ${esc(l.proximoPasso)}</span>` : ""}
              ${e.id === "perdido" && l.motivoPerda ? `<span class="lc-meta">Motivo: ${esc(l.motivoPerda)}</span>` : ""}
              <span class="lc-tags">${tempTag(l.temperatura)} ${followTag(l)}</span>
            </div>`).join("") || `<p class="col-empty">Nenhum interessado</p>`}
        </section>`;
      }).join("")}</div>`;

      $$(".lead-card", el).forEach((card) => {
        card.addEventListener("dragstart", (ev) => {
          ev.dataTransfer.setData("text/plain", card.dataset.id);
          ev.dataTransfer.effectAllowed = "move";
        });
      });
      $$(".col", el).forEach((col) => {
        col.addEventListener("dragover", (ev) => {
          ev.preventDefault();
          col.classList.add("drop");
        });
        col.addEventListener("dragleave", (ev) => {
          if (!col.contains(ev.relatedTarget)) col.classList.remove("drop");
        });
        col.addEventListener("drop", (ev) => {
          ev.preventDefault();
          col.classList.remove("drop");
          const id = ev.dataTransfer.getData("text/plain");
          if (id) moveLead(id, col.dataset.etapa);
        });
      });
    };
    renderResults();
  }

  function viewLeads(el) {
    el.innerHTML = `
      ${pageHead("Novos Negócios", "Interessados", "Todos os possíveis compradores, com origem, etapa e próximo passo.",
        `<button class="btn btn-ghost" id="expLeads">Exportar CSV</button>${btnNewLead}`)}
      ${localNotice()}
      ${filterBar({ etapa: true })}
      <div class="card" id="results"></div>`;
    bindFilters(el);
    $("#expLeads", el).addEventListener("click", () => exportLeads(filtered(true)));

    renderResults = () => {
      const leads = filtered(true).sort(sortByFollow);
      $("#results", el).innerHTML = leads.length
        ? `<div class="table-wrap"><table>
          <thead><tr><th>Nome</th><th>Contato</th><th>Origem</th><th>Terreno</th><th>Etapa</th><th>Temp.</th><th>Próximo passo</th></tr></thead>
          <tbody>${leads.map((l) => `<tr class="clickable" tabindex="0" data-open-lead="${esc(l.id)}">
            <td><b>${esc(l.nome)}</b>${l.objetivo && l.objetivo !== "Não informado" ? `<br><span class="hint">${esc(l.objetivo)}</span>` : ""}</td>
            <td>${esc(l.telefone || "")}${l.telefone && l.email ? "<br>" : ""}${esc(l.email || "")}${!l.telefone && !l.email ? "—" : ""}</td>
            <td>${esc(l.canal || "—")}</td>
            <td>${esc(terrenoLabel(l.terrenoId))}</td>
            <td>${etapaTag(l.etapa)}</td>
            <td>${tempTag(l.temperatura)}</td>
            <td>${esc(l.proximoPasso || "")} ${followTag(l)}</td>
          </tr>`).join("")}</tbody></table></div>`
        : state.leads.length
          ? `<div class="empty"><b>Nenhum interessado com esses filtros</b>Limpe a busca ou os filtros.</div>`
          : `<div class="empty"><b>Nenhum interessado ainda</b>Cadastre cada pessoa que chamar nos anúncios, grupos ou Direct.<br><br>${btnNewLead}</div>`;
    };
    renderResults();
  }

  function viewTerrenos(el) {
    const T = state.terrenos.slice().sort((a, b) => (a.codigo || "").localeCompare(b.codigo || "", "pt-BR", { numeric: true }));
    el.innerHTML = `
      ${pageHead("Novos Negócios", "Terrenos", "Cadastro dos terrenos à venda. Vincule cada interessado ao terreno que quer comprar.",
        `${T.length ? `<button class="btn btn-ghost" id="expTer">Exportar CSV</button>` : ""}${btnNewTerreno}`)}
      ${localNotice()}
      <div class="card">
      ${T.length ? `<div class="table-wrap"><table>
        <thead><tr><th>Terreno</th><th class="num">Área</th><th class="num">Preço</th><th class="num">R$/m²</th><th>Condições</th><th>Situação</th><th class="num">Interessados</th></tr></thead>
        <tbody>${T.map((t) => {
          const ls = state.leads.filter((l) => l.terrenoId === t.id);
          const ativos = ls.filter(isAtivo).length;
          const m2 = hasNum(t.preco) && hasNum(t.area) && Number(t.area) > 0 ? fmtMoney(Number(t.preco) / Number(t.area)) : "—";
          const st = t.status === "vendido" ? "ok" : t.status === "reservado" ? "today" : "red";
          return `<tr class="clickable" tabindex="0" data-open-terreno="${esc(t.id)}">
            <td><b>${esc(t.codigo)}</b>${t.localizacao ? `<br><span class="hint">${esc(t.localizacao)}</span>` : ""}</td>
            <td class="num">${hasNum(t.area) ? fmtNum(t.area) + " m²" : "—"}</td>
            <td class="num">${fmtMoney(t.preco)}</td>
            <td class="num">${m2}</td>
            <td>${esc(t.condicoes || "—")}</td>
            <td><span class="tag ${st}">${esc(nome(STATUS_TERRENO, t.status))}</span>${t.status === "vendido" && t.vendidoPara ? `<br><span class="hint">${esc(t.vendidoPara)}</span>` : ""}</td>
            <td class="num">${ativos}${ls.length !== ativos ? ` <span class="hint">(${ls.length} no total)</span>` : ""}</td>
          </tr>`;
        }).join("")}</tbody></table></div>`
        : `<div class="empty"><b>Nenhum terreno cadastrado</b>Comece pelos terrenos disponíveis: identificação, área, preço e condições.<br><br>${btnNewTerreno}</div>`}
      </div>`;
    const exp = $("#expTer", el);
    if (exp) exp.addEventListener("click", exportTerrenos);
  }

  function viewMensagens(el) {
    el.innerHTML = `
      ${pageHead("Novos Negócios", "Mensagens prontas", "Copie e ajuste. Dentro de cada interessado, as mensagens já saem com o nome e os dados do terreno.")}
      <div class="notice"><span aria-hidden="true">ℹ</span><span>Use o WhatsApp <b>só com quem pediu ou autorizou</b> o contato. Para os demais, responda pelo chat do próprio anúncio (OLX, VivaReal, Marketplace) ou pelo Direct.</span></div>
      <div class="msgs">${MENSAGENS.map((m, i) => `
        <article class="card msg">
          <div class="msg-head"><h3>${esc(m.titulo)}</h3><button class="btn btn-ghost btn-sm" data-copy="${i}">Copiar</button></div>
          <p class="hint" style="margin-bottom:8px">${esc(m.quando)}</p>
          <pre>${esc(m.texto)}</pre>
        </article>`).join("")}</div>`;
    $$("[data-copy]", el).forEach((b) => b.addEventListener("click", () => copyText(MENSAGENS[Number(b.dataset.copy)].texto)));
  }

  function viewDados(el) {
    el.innerHTML = `
      ${pageHead("Dados", "Backup e exportação", "")}
      ${localNotice()}
      <div class="grid grid-2">
        <section class="card card-pad">
          <h2>Exportar para Excel</h2>
          <p class="hint" style="margin-bottom:12px">Arquivos CSV que abrem direto no Excel ou no Google Planilhas.</p>
          <div class="actions">
            <button class="btn btn-ghost" id="dExpLeads">Interessados (${state.leads.length})</button>
            <button class="btn btn-ghost" id="dExpTer">Terrenos (${state.terrenos.length})</button>
          </div>
        </section>
        <section class="card card-pad">
          <h2>Backup completo</h2>
          <p class="hint" style="margin-bottom:12px">Salva tudo num arquivo. A restauração junta o backup aos dados atuais: registros com o mesmo código são substituídos pela versão do backup.</p>
          <div class="actions">
            <button class="btn" id="dBackup">Baixar backup</button>
            <label class="btn btn-ghost" for="dRestore">Restaurar backup</label>
            <input type="file" id="dRestore" accept="application/json,.json" hidden>
          </div>
        </section>
      </div>
      <section class="card card-pad" style="margin-top:16px">
        <h2>Onde os dados ficam</h2>
        <p>${S.mode === "local"
          ? "Modo local: os dados estão só neste navegador. Para a equipe trabalhar junta, configure o Supabase seguindo o README do repositório."
          : `Banco compartilhado (Supabase). Conectado como <b>${esc(S.user() || "")}</b>.`}</p>
        <p class="hint" style="margin-top:8px">Os dados dos interessados são pessoais (LGPD): use só para negociar os terrenos e exclua quem pedir para sair.</p>
      </section>`;
    $("#dExpLeads", el).addEventListener("click", () => exportLeads(state.leads));
    $("#dExpTer", el).addEventListener("click", exportTerrenos);
    $("#dBackup", el).addEventListener("click", () => {
      const data = { app: "portal-costajr/novos-negocios", versao: 1, exportadoEm: new Date().toISOString(), terrenos: state.terrenos, leads: state.leads };
      download(`backup-novos-negocios-${todayISO()}.json`, JSON.stringify(data, null, 2), "application/json");
    });
    $("#dRestore", el).addEventListener("change", async (ev) => {
      const file = ev.target.files[0];
      ev.target.value = "";
      if (!file) return;
      try {
        const data = JSON.parse(await file.text());
        if (!data || !Array.isArray(data.leads) || !Array.isArray(data.terrenos)) throw new Error("Arquivo de backup inválido.");
        const valid = (r) => r && typeof r === "object" && typeof r.id === "string";
        const terrenos = data.terrenos.filter(valid);
        const leads = data.leads.filter(valid);
        if (!confirm(`Restaurar ${terrenos.length} terreno(s) e ${leads.length} interessado(s)?`)) return;
        for (const t of terrenos) await S.upsert("terrenos", t);
        for (const l of leads) await S.upsert("leads", l);
        state.loaded = false;
        toast("Backup restaurado.");
        render();
      } catch (e) {
        handleError(e instanceof SyntaxError ? new Error("Arquivo de backup inválido.") : e);
      }
    });
  }

  function exportLeads(leads) {
    const headers = ["Nome", "Telefone", "E-mail", "Origem", "Detalhe da origem", "Autoriza WhatsApp", "Terreno", "Objetivo", "Pagamento",
      "Orçamento", "Prazo", "Temperatura", "Etapa", "Motivo da perda", "Próximo passo", "Data do próximo passo", "Valor da proposta", "Cadastrado em", "Observações"];
    const rows = leads.map((l) => [
      l.nome, l.telefone, l.email, l.canal, l.canalDetalhe, l.autorizaWhatsapp ? "Sim" : "Não", terrenoLabel(l.terrenoId), l.objetivo, l.pagamento,
      hasNum(l.orcamento) ? l.orcamento : "", l.prazo, nome(TEMPERATURAS, l.temperatura), nome(ETAPAS, l.etapa), l.motivoPerda,
      l.proximoPasso, l.proximoPassoData ? fmtDate(l.proximoPassoData) : "", hasNum(l.valorProposta) ? l.valorProposta : "",
      l.criadoEm ? fmtDate(l.criadoEm) : "", l.observacoes,
    ]);
    download(`interessados-${todayISO()}.csv`, toCSV(headers, rows), "text/csv;charset=utf-8");
  }
  function exportTerrenos() {
    const headers = ["Identificação", "Localização", "Área (m²)", "Dimensões", "Preço", "Condições", "Topografia", "Documentação", "Infraestrutura", "Situação", "Vendido para", "Interessados ativos", "Anúncios", "Observações"];
    const rows = state.terrenos.map((t) => [
      t.codigo, t.localizacao, hasNum(t.area) ? t.area : "", t.dimensoes, hasNum(t.preco) ? t.preco : "", t.condicoes, t.topografia, t.documentacao,
      t.infraestrutura, nome(STATUS_TERRENO, t.status), t.vendidoPara || "", state.leads.filter((l) => l.terrenoId === t.id && isAtivo(l)).length, t.anuncios, t.observacoes,
    ]);
    download(`terrenos-${todayISO()}.csv`, toCSV(headers, rows), "text/csv;charset=utf-8");
  }

  function viewLogin(el) {
    el.innerHTML = `
      <form class="card login" id="loginForm">
        <p class="eyebrow">Portal Costa Júnior</p>
        <h1>Entrar</h1>
        <div class="field"><label for="lEmail">E-mail</label><input id="lEmail" type="email" autocomplete="username" required></div>
        <div class="field"><label for="lPass">Senha</label><input id="lPass" type="password" autocomplete="current-password" required></div>
        <button class="btn" type="submit">Entrar</button>
        <p class="hint">Acesso liberado só para a equipe. Peça seu usuário ao administrador.</p>
      </form>`;
    $("#loginForm", el).addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = $("button[type=submit]", el);
      btn.disabled = true;
      try {
        await S.signIn($("#lEmail", el).value.trim(), $("#lPass", el).value);
        state.loaded = false;
        render();
      } catch (err) {
        toast(err.message || "Não foi possível entrar.", true);
      } finally {
        btn.disabled = false;
      }
    });
  }

  // ---------- roteamento ----------
  const ROUTES = {
    inicio: viewInicio,
    "nn/painel": viewPainel,
    "nn/funil": viewFunil,
    "nn/leads": viewLeads,
    "nn/terrenos": viewTerrenos,
    "nn/mensagens": viewMensagens,
    "nn/dados": viewDados,
  };
  function currentRoute() {
    const r = location.hash.replace(/^#\/?/, "");
    return ROUTES[r] ? r : "inicio";
  }

  function updateChrome() {
    const chip = $("#modeChip");
    if (S.mode === "local") {
      chip.textContent = "Modo local · só neste navegador";
      chip.className = "mode-chip local";
    } else {
      chip.textContent = S.user() || "Banco compartilhado";
      chip.className = "mode-chip";
    }
    $("#logoutBtn").hidden = !(S.mode === "remote" && !S.needsLogin());
    $("#refreshBtn").hidden = S.needsLogin();
    const r = currentRoute();
    $$(".sidebar a").forEach((a) => {
      const on = a.dataset.route === r;
      a.classList.toggle("active", on);
      if (on) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
  }

  function render() {
    updateChrome();
    renderResults = () => {};
    const el = $("#view");
    if (S.needsLogin()) {
      viewLogin(el);
      return;
    }
    if (!state.loaded) {
      if (state.loadError && !state.loading) {
        el.innerHTML = `<div class="card empty"><b>Não foi possível carregar os dados</b>${esc(state.loadError)}<br><br><button class="btn" id="retry">Tentar novamente</button></div>`;
        $("#retry", el).addEventListener("click", load);
        return;
      }
      el.innerHTML = `<p class="empty">Carregando…</p>`;
      if (!state.loading) load();
      return;
    }
    ROUTES[currentRoute()](el);
  }

  // ---------- eventos globais ----------
  document.addEventListener("click", (e) => {
    const lead = e.target.closest("[data-open-lead]");
    if (lead) {
      const l = state.leads.find((x) => x.id === lead.dataset.openLead);
      if (l) openLeadModal(l);
      return;
    }
    const ter = e.target.closest("[data-open-terreno]");
    if (ter) {
      const t = state.terrenos.find((x) => x.id === ter.dataset.openTerreno);
      if (t) openTerrenoModal(t);
      return;
    }
    if (e.target.closest("[data-new-lead]")) {
      const pre = state.f.terreno ? { terrenoId: state.f.terreno } : null;
      openLeadModal(null, pre);
      if (pre) modal.dataset.dirty = "";
      return;
    }
    if (e.target.closest("[data-new-terreno]")) openTerrenoModal(null);
  });

  // cartões e linhas clicáveis também abrem pelo teclado
  document.addEventListener("keydown", (e) => {
    if ((e.key === "Enter" || e.key === " ") && e.target.matches("[data-open-lead][role=button], tr[data-open-lead], tr[data-open-terreno]")) {
      e.preventDefault();
      e.target.click();
    }
  });

  window.addEventListener("hashchange", () => {
    $("#sidebar").classList.remove("open");
    $("#menuBtn").setAttribute("aria-expanded", "false");
    render();
    $("#view").focus({ preventScroll: true });
    window.scrollTo(0, 0);
  });
  $("#menuBtn").addEventListener("click", () => {
    const open = $("#sidebar").classList.toggle("open");
    $("#menuBtn").setAttribute("aria-expanded", String(open));
  });
  $("#refreshBtn").addEventListener("click", () => {
    state.loaded = false;
    render();
  });
  $("#logoutBtn").addEventListener("click", () => {
    S.signOut();
    state.loaded = false;
    state.leads = [];
    state.terrenos = [];
    render();
  });

  render();
})();
