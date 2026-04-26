const STORAGE_KEY = "chronic-med-manager-state";

const today = new Date();
const isoToday = toISO(today);

const defaultState = {
  patient: {
    name: "张阿姨",
    condition: "2 型糖尿病、高血压",
    familySync: true
  },
  medicines: [
    {
      id: crypto.randomUUID(),
      name: "二甲双胍缓释片",
      dose: "0.5g / 1片",
      frequency: 2,
      times: ["早餐后", "晚餐后"],
      stock: 18,
      stockWarn: 7,
      rxDays: 14,
      followUpDate: offsetDate(12),
      purchaseChannel: "线上药房",
      logs: seedLogs([1, 1, 1, 0, 1, 1, 0])
    },
    {
      id: crypto.randomUUID(),
      name: "氨氯地平片",
      dose: "5mg / 1片",
      frequency: 1,
      times: ["早餐后"],
      stock: 9,
      stockWarn: 10,
      rxDays: 10,
      followUpDate: offsetDate(8),
      purchaseChannel: "医院药房",
      logs: seedLogs([1, 1, 1, 1, 1, 0, 1])
    }
  ]
};

let state = loadState();

const elements = {
  currentDate: document.querySelector("#currentDate"),
  viewTitle: document.querySelector("#viewTitle"),
  tabs: document.querySelectorAll(".tab"),
  views: document.querySelectorAll(".view"),
  patientName: document.querySelector("#patientName"),
  patientCondition: document.querySelector("#patientCondition"),
  familySync: document.querySelector("#familySync"),
  statsGrid: document.querySelector("#statsGrid"),
  doseList: document.querySelector("#doseList"),
  todayProgress: document.querySelector("#todayProgress"),
  insights: document.querySelector("#insights"),
  medForm: document.querySelector("#medForm"),
  stockWarn: document.querySelector("#stockWarn"),
  stockWarnOut: document.querySelector("#stockWarnOut"),
  medList: document.querySelector("#medList"),
  planCount: document.querySelector("#planCount"),
  refillList: document.querySelector("#refillList"),
  refillSummary: document.querySelector("#refillSummary"),
  copyRefillBtn: document.querySelector("#copyRefillBtn"),
  adherenceChart: document.querySelector("#adherenceChart"),
  adherenceBadge: document.querySelector("#adherenceBadge"),
  reviewNotes: document.querySelector("#reviewNotes"),
  resetBtn: document.querySelector("#resetBtn"),
  exportBtn: document.querySelector("#exportBtn")
};

init();

function init() {
  elements.currentDate.textContent = new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "full"
  }).format(today);

  bindEvents();
  hydratePatient();
  hydrateFormDefaults();
  render();
}

function bindEvents() {
  elements.tabs.forEach((tab) => {
    tab.addEventListener("click", () => switchView(tab.dataset.view));
  });

  ["input", "change"].forEach((eventName) => {
    elements.patientName.addEventListener(eventName, persistPatient);
    elements.patientCondition.addEventListener(eventName, persistPatient);
    elements.familySync.addEventListener(eventName, persistPatient);
  });

  elements.stockWarn.addEventListener("input", () => {
    elements.stockWarnOut.textContent = `${elements.stockWarn.value} 天`;
  });

  elements.medForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = getMedicineFormData();
    const existingIndex = state.medicines.findIndex((med) => med.name === formData.name);

    if (existingIndex >= 0) {
      state.medicines[existingIndex] = {
        ...state.medicines[existingIndex],
        ...formData
      };
    } else {
      state.medicines.push({
        id: crypto.randomUUID(),
        ...formData,
        logs: {}
      });
    }

    saveState();
    elements.medForm.reset();
    hydrateFormDefaults();
    render();
    switchView("plan");
  });

  elements.doseList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-action='toggle-dose']");
    if (!button) return;
    toggleDose(button.dataset.medId, button.dataset.time);
  });

  elements.medList.addEventListener("click", handleMedicineAction);
  elements.refillList.addEventListener("click", handleMedicineAction);

  elements.copyRefillBtn.addEventListener("click", async () => {
    elements.refillSummary.select();
    await navigator.clipboard?.writeText(elements.refillSummary.value).catch(() => {});
    elements.copyRefillBtn.textContent = "已生成";
    setTimeout(() => (elements.copyRefillBtn.textContent = "生成给医生的摘要"), 1200);
  });

  elements.resetBtn.addEventListener("click", () => {
    state = structuredClone(defaultState);
    saveState();
    hydratePatient();
    hydrateFormDefaults();
    render();
  });

  elements.exportBtn.addEventListener("click", () => {
    const blob = new Blob([buildSummary()], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `慢病用药摘要-${isoToday}.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  });
}

function switchView(view) {
  const titles = {
    today: "今日计划",
    plan: "用药建档",
    refill: "购药续方",
    review: "复诊回顾"
  };

  elements.tabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.view === view));
  elements.views.forEach((section) => section.classList.remove("active-view"));
  document.querySelector(`#${view}View`).classList.add("active-view");
  elements.viewTitle.textContent = titles[view];
}

function hydratePatient() {
  elements.patientName.value = state.patient.name;
  elements.patientCondition.value = state.patient.condition;
  elements.familySync.checked = state.patient.familySync;
}

function hydrateFormDefaults() {
  document.querySelector("#stockWarn").value = 7;
  document.querySelector("#rxDays").value = 30;
  document.querySelector("#stock").value = 30;
  document.querySelector("#followUpDate").value = offsetDate(30);
  elements.stockWarnOut.textContent = "7 天";
}

function persistPatient() {
  state.patient = {
    name: elements.patientName.value.trim() || "未命名患者",
    condition: elements.patientCondition.value.trim() || "未填写",
    familySync: elements.familySync.checked
  };
  saveState();
  render();
}

function getMedicineFormData() {
  const selectedTimes = [...document.querySelectorAll("input[name='time']:checked")].map((input) => input.value);
  const frequency = Number(document.querySelector("#frequency").value);
  return {
    name: document.querySelector("#medName").value.trim(),
    dose: document.querySelector("#dose").value.trim(),
    frequency,
    times: selectedTimes.slice(0, frequency),
    stock: Number(document.querySelector("#stock").value),
    stockWarn: Number(document.querySelector("#stockWarn").value),
    rxDays: Number(document.querySelector("#rxDays").value),
    followUpDate: document.querySelector("#followUpDate").value,
    purchaseChannel: document.querySelector("#purchaseChannel").value
  };
}

function render() {
  renderStats();
  renderTodayDoses();
  renderInsights();
  renderMedicineList();
  renderRefills();
  renderAdherence();
  renderReviewNotes();
}

function renderStats() {
  const doses = todayDoses();
  const completed = doses.filter((dose) => isDoseDone(dose.med, dose.time)).length;
  const lowStock = state.medicines.filter((med) => daysLeft(med) <= med.stockWarn).length;
  const nextFollowUp = nearestFollowUp();
  const adherence = adherenceRate();

  const stats = [
    ["今日待服", `${completed}/${doses.length}`, "已完成 / 总次数"],
    ["库存预警", `${lowStock}`, "需补药的药品"],
    ["下次复诊", nextFollowUp ? daysUntil(nextFollowUp.followUpDate) + " 天" : "无", nextFollowUp?.name || "暂无计划"],
    ["近 7 天依从性", `${adherence}%`, "按打卡记录估算"]
  ];

  elements.statsGrid.innerHTML = stats
    .map(([label, value, helper]) => `<article class="stat"><span>${label}</span><strong>${value}</strong><span>${helper}</span></article>`)
    .join("");
}

function renderTodayDoses() {
  const doses = todayDoses();
  elements.todayProgress.textContent = `${doses.filter((dose) => isDoseDone(dose.med, dose.time)).length}/${doses.length} 已打卡`;

  if (!doses.length) {
    elements.doseList.innerHTML = emptyState();
    return;
  }

  elements.doseList.innerHTML = doses
    .map(({ med, time }) => {
      const done = isDoseDone(med, time);
      return `
        <article class="dose-item">
          <div class="dose-top">
            <div>
              <p class="dose-title">${med.name}</p>
              <p class="meta">${time} · ${med.dose} · 剩余约 ${daysLeft(med)} 天</p>
            </div>
            <span class="status-chip ${done ? "" : stockClass(med)}">${done ? "已完成" : doseStatus(med)}</span>
          </div>
          <div class="dose-actions">
            <button class="mini-btn ${done ? "done" : ""}" data-action="toggle-dose" data-med-id="${med.id}" data-time="${time}" type="button">
              ${done ? "撤销打卡" : "服药打卡"}
            </button>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderInsights() {
  const insights = buildInsights();
  elements.insights.innerHTML = insights
    .map((item) => `<article class="insight"><strong>${item.title}</strong><p class="meta">${item.body}</p></article>`)
    .join("");
}

function renderMedicineList() {
  elements.planCount.textContent = `${state.medicines.length} 个计划`;
  elements.medList.innerHTML = state.medicines.length ? state.medicines.map(renderMedicineItem).join("") : emptyState();
}

function renderRefills() {
  const sorted = [...state.medicines].sort((a, b) => daysLeft(a) - daysLeft(b));
  elements.refillList.innerHTML = sorted.length ? sorted.map(renderMedicineItem).join("") : emptyState();
  elements.refillSummary.value = buildSummary();
}

function renderMedicineItem(med) {
  return `
    <article class="medicine-item">
      <div class="medicine-top">
        <div>
          <p class="medicine-title">${med.name}</p>
          <p class="meta">${med.dose} · ${med.times.join("、")} · ${med.purchaseChannel}</p>
        </div>
        <span class="status-chip ${stockClass(med)}">${doseStatus(med)}</span>
      </div>
      <p class="meta">库存 ${med.stock} 份，预计可用 ${daysLeft(med)} 天；下次复诊 ${med.followUpDate}，距今 ${daysUntil(med.followUpDate)} 天。</p>
      <div class="dose-actions">
        <button class="mini-btn" data-action="add-stock" data-med-id="${med.id}" type="button">补 7 天药</button>
        <button class="mini-btn" data-action="edit-med" data-med-id="${med.id}" type="button">带入编辑</button>
        <button class="mini-btn" data-action="delete-med" data-med-id="${med.id}" type="button">删除</button>
      </div>
    </article>
  `;
}

function renderAdherence() {
  const days = lastSevenDays();
  const rates = days.map((day) => {
    const expected = state.medicines.reduce((sum, med) => sum + med.times.length, 0);
    if (!expected) return { day, rate: 0 };
    const actual = state.medicines.reduce((sum, med) => sum + Object.keys(med.logs?.[day] || {}).length, 0);
    return { day, rate: Math.round((actual / expected) * 100) };
  });

  elements.adherenceBadge.textContent = `${adherenceRate()}%`;
  elements.adherenceChart.innerHTML = rates
    .map(({ day, rate }) => {
      const label = new Date(`${day}T00:00:00`).toLocaleDateString("zh-CN", { weekday: "short" });
      return `<div class="bar-cell"><div class="bar" style="height:${Math.max(rate, 4)}%"></div><span class="bar-label">${label}<br>${rate}%</span></div>`;
    })
    .join("");
}

function renderReviewNotes() {
  const notes = [
    {
      title: "复诊前需要确认",
      body: `当前记录 ${state.medicines.length} 个用药计划，近 7 天依从性 ${adherenceRate()}%。建议复诊时同步血压、血糖等家庭监测值。`
    },
    {
      title: "续方风险",
      body: buildInsights().map((item) => item.body).join(" ")
    },
    {
      title: "家属协同",
      body: state.patient.familySync ? "已开启家属同步提醒，可将导出摘要发给照护人。" : "未开启家属同步提醒，适合自主用药用户。"
    }
  ];

  elements.reviewNotes.innerHTML = notes
    .map((note) => `<article class="note"><strong>${note.title}</strong><p class="meta">${note.body}</p></article>`)
    .join("");
}

function handleMedicineAction(event) {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const med = state.medicines.find((item) => item.id === button.dataset.medId);
  if (!med) return;

  if (button.dataset.action === "add-stock") {
    med.stock += Math.max(med.frequency * 7, 7);
  }

  if (button.dataset.action === "delete-med") {
    state.medicines = state.medicines.filter((item) => item.id !== med.id);
  }

  if (button.dataset.action === "edit-med") {
    fillForm(med);
    switchView("plan");
  }

  saveState();
  render();
}

function fillForm(med) {
  document.querySelector("#medName").value = med.name;
  document.querySelector("#dose").value = med.dose;
  document.querySelector("#frequency").value = med.frequency;
  document.querySelector("#stock").value = med.stock;
  document.querySelector("#stockWarn").value = med.stockWarn;
  document.querySelector("#rxDays").value = med.rxDays;
  document.querySelector("#followUpDate").value = med.followUpDate;
  document.querySelector("#purchaseChannel").value = med.purchaseChannel;
  document.querySelectorAll("input[name='time']").forEach((input) => {
    input.checked = med.times.includes(input.value);
  });
  elements.stockWarnOut.textContent = `${med.stockWarn} 天`;
}

function toggleDose(medId, time) {
  const med = state.medicines.find((item) => item.id === medId);
  if (!med) return;
  med.logs ||= {};
  med.logs[isoToday] ||= {};

  if (med.logs[isoToday][time]) {
    delete med.logs[isoToday][time];
    med.stock += 1;
  } else {
    med.logs[isoToday][time] = new Date().toISOString();
    med.stock = Math.max(0, med.stock - 1);
  }

  saveState();
  render();
}

function todayDoses() {
  return state.medicines.flatMap((med) => med.times.map((time) => ({ med, time })));
}

function isDoseDone(med, time) {
  return Boolean(med.logs?.[isoToday]?.[time]);
}

function daysLeft(med) {
  return med.frequency ? Math.floor(med.stock / med.frequency) : 0;
}

function daysUntil(dateString) {
  const target = new Date(`${dateString}T00:00:00`);
  return Math.ceil((target - startOfDay(today)) / 86400000);
}

function nearestFollowUp() {
  return [...state.medicines].sort((a, b) => daysUntil(a.followUpDate) - daysUntil(b.followUpDate))[0];
}

function doseStatus(med) {
  const left = daysLeft(med);
  if (left <= 0) return "已用完";
  if (left <= med.stockWarn) return `仅剩 ${left} 天`;
  if (daysUntil(med.followUpDate) <= 7) return "复诊将近";
  return "计划正常";
}

function stockClass(med) {
  if (daysLeft(med) <= 0) return "danger";
  if (daysLeft(med) <= med.stockWarn) return "warning";
  if (daysUntil(med.followUpDate) <= 7) return "blue";
  return "";
}

function buildInsights() {
  if (!state.medicines.length) {
    return [{ title: "先建立用药计划", body: "添加药品后，小管家会自动识别漏服、库存不足和复诊临近。" }];
  }

  const insights = [];
  const low = state.medicines.filter((med) => daysLeft(med) <= med.stockWarn);
  const follow = state.medicines.filter((med) => daysUntil(med.followUpDate) <= 7);
  const duplicateChannels = state.medicines.reduce((map, med) => {
    map[med.purchaseChannel] = (map[med.purchaseChannel] || 0) + 1;
    return map;
  }, {});

  if (low.length) {
    insights.push({
      title: "库存需要处理",
      body: `${low.map((med) => med.name).join("、")} 已进入补药窗口，建议先核对家中余量，再按处方天数购买，减少重复囤药。`
    });
  }

  if (follow.length) {
    insights.push({
      title: "复诊或续方临近",
      body: `${follow.map((med) => med.name).join("、")} 的复诊日在 7 天内，建议准备近一周打卡记录和异常症状。`
    });
  }

  if (Object.values(duplicateChannels).some((count) => count > 1)) {
    insights.push({
      title: "购药渠道可合并",
      body: "多个药品使用同一购药渠道，可以合并下单或同日取药，降低重复购买和漏买风险。"
    });
  }

  if (adherenceRate() < 85) {
    insights.push({
      title: "依从性偏低",
      body: "近 7 天打卡率低于 85%，建议把高频药调整到餐后固定场景，并开启家属同步提醒。"
    });
  }

  if (!insights.length) {
    insights.push({
      title: "计划运行稳定",
      body: "当前库存、复诊和打卡记录都处于稳定状态，继续按计划服药即可。"
    });
  }

  return insights;
}

function adherenceRate() {
  const days = lastSevenDays();
  const expected = state.medicines.reduce((sum, med) => sum + med.times.length * days.length, 0);
  if (!expected) return 0;
  const actual = state.medicines.reduce((sum, med) => {
    return sum + days.reduce((daySum, day) => daySum + Object.keys(med.logs?.[day] || {}).length, 0);
  }, 0);
  return Math.round((actual / expected) * 100);
}

function buildSummary() {
  const rows = state.medicines.map((med) => {
    return `- ${med.name}：${med.dose}，${med.times.join("、")}；库存 ${med.stock} 份，预计 ${daysLeft(med)} 天；复诊 ${med.followUpDate}；渠道 ${med.purchaseChannel}`;
  });

  return [
    `患者：${state.patient.name}`,
    `主要慢病：${state.patient.condition}`,
    `生成日期：${isoToday}`,
    `近 7 天依从性：${adherenceRate()}%`,
    "",
    "当前用药：",
    rows.join("\n") || "暂无用药计划",
    "",
    "需要医生确认：",
    buildInsights().map((item) => `- ${item.title}：${item.body}`).join("\n")
  ].join("\n");
}

function emptyState() {
  return document.querySelector("#emptyStateTemplate").innerHTML;
}

function loadState() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return structuredClone(defaultState);
  try {
    return JSON.parse(stored);
  } catch {
    return structuredClone(defaultState);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function seedLogs(pattern) {
  return pattern.reduce((logs, value, index) => {
    const day = toISO(new Date(today.getFullYear(), today.getMonth(), today.getDate() - (6 - index)));
    if (value) {
      logs[day] = { "早餐后": `${day}T08:20:00.000Z` };
    }
    return logs;
  }, {});
}

function lastSevenDays() {
  return Array.from({ length: 7 }, (_, index) =>
    toISO(new Date(today.getFullYear(), today.getMonth(), today.getDate() - (6 - index)))
  );
}

function offsetDate(days) {
  return toISO(new Date(today.getFullYear(), today.getMonth(), today.getDate() + days));
}

function toISO(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}
