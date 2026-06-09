App({
  globalData: {
    apiBase: "http://127.0.0.1:8787",
    useDemoMode: true,
    voiceEnabled: false,
    lastReport: null
  },

  setDemoMode(value) {
    this.globalData.useDemoMode = Boolean(value);
  },

  setVoiceEnabled(value) {
    this.globalData.voiceEnabled = Boolean(value);
  }
});
