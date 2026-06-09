const app = typeof getApp === "function" ? getApp() : { globalData: { useDemoMode: true }, setDemoMode() {} };

Page({
  data: {
    scenario: "interview",
    role: "pm",
    difficulty: "strict",
    useDemoMode: true,
    voiceEnabled: false,
    selectedScenarioName: "英文面试",
    selectedRoleName: "产品经理",
    selectedDifficultyName: "严厉考官",
    scenarios: [
      {
        key: "interview",
        name: "英文面试",
        tag: "Offer",
        desc: "模拟外企面试官追问，练自我介绍、项目经历和胜任力。",
        selectedClass: "active"
      },
      {
        key: "meeting",
        name: "会议发言",
        tag: "Meeting",
        desc: "练周会汇报、项目进展、风险说明和行动计划。",
        selectedClass: ""
      },
      {
        key: "intro",
        name: "自我介绍",
        tag: "Intro",
        desc: "把中文履历翻成自然、自信、适合职场的英文表达。",
        selectedClass: ""
      }
    ],
    roles: [
      { key: "pm", name: "产品经理", selectedClass: "active" },
      { key: "engineer", name: "程序员", selectedClass: "" },
      { key: "operator", name: "运营", selectedClass: "" },
      { key: "sales", name: "销售", selectedClass: "" }
    ],
    difficulties: [
      { key: "basic", name: "初级私教", selectedClass: "" },
      { key: "advanced", name: "进阶教练", selectedClass: "" },
      { key: "strict", name: "严厉考官", selectedClass: "active" }
    ]
  },

  onLoad() {
    this.setData({
      useDemoMode: app.globalData.useDemoMode,
      voiceEnabled: app.globalData.voiceEnabled
    });
  },

  chooseScenario(event) {
    this.refreshSelection("scenarios", event.currentTarget.dataset.key, "scenario", "selectedScenarioName");
  },

  chooseRole(event) {
    this.refreshSelection("roles", event.currentTarget.dataset.key, "role", "selectedRoleName");
  },

  chooseDifficulty(event) {
    this.refreshSelection("difficulties", event.currentTarget.dataset.key, "difficulty", "selectedDifficultyName");
  },

  toggleMode(event) {
    const value = event.detail.value;
    app.setDemoMode(value);
    this.setData({ useDemoMode: value });
  },

  toggleVoice(event) {
    const value = event.detail.value;
    if (app.setVoiceEnabled) app.setVoiceEnabled(value);
    this.setData({ voiceEnabled: value });
  },

  startSession() {
    const { scenario, role, difficulty } = this.data;
    if (typeof wx === "undefined" || !wx.navigateTo) return;
    wx.navigateTo({
      url: `/pages/session/session?scenario=${scenario}&role=${role}&difficulty=${difficulty}`
    });
  },

  refreshSelection(listName, key, valueName, labelName) {
    const list = this.data[listName].map((item) => ({
      ...item,
      selectedClass: item.key === key ? "active" : ""
    }));
    const selected = list.find((item) => item.key === key);
    this.setData({
      [listName]: list,
      [valueName]: key,
      [labelName]: selected ? selected.name : ""
    });
  }
});
