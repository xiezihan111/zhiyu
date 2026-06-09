const app = typeof getApp === "function" ? getApp() : { globalData: { useDemoMode: true } };
const {
  getOpeningQuestion,
  demoNextQuestion,
  buildDemoReport,
  normalizeMixedAnswer,
  getScenario,
  getRole,
  getDifficulty
} = require("../../utils/mock");

let recorder = null;
let audioContext = null;

Page({
  data: {
    config: {
      scenario: "interview",
      role: "pm",
      difficulty: "strict"
    },
    scenarioName: "英文面试",
    roleName: "产品经理",
    difficultyName: "严厉",
    history: [],
    draftAnswer: "",
    userTurn: 0,
    maxTurns: 3,
    progressPercent: 0,
    roundLabel: "第 1 / 3 轮",
    coachTip: "先回答结论，再补一个具体例子。英文面试最怕只有形容词，没有证据。",
    sampleAnswers: [
      "我是产品经理候选人，I did user research and roadmap planning，希望加入 international team。",
      "In my previous project, I worked with designers and engineers to define the user flow, collect user feedback, and launch the first version within two weeks.",
      "I believe I am a good fit because I can connect user needs, business goals, and technical possibilities. I can also communicate clearly with cross-functional teams."
    ],
    mixedLanguageAssist: true,
    normalizeTip: "",
    isRecording: false,
    hasRecordSupport: true,
    recordTip: "",
    isLoading: false,
    isFinishing: false,
    useDemoMode: true,
    voiceEnabled: false,
    isPlaying: false,
    playingMessageId: "",
    scrollAnchor: "bottom-anchor"
  },

  onLoad(options) {
    const config = {
      scenario: options.scenario || "interview",
      role: options.role || "pm",
      difficulty: options.difficulty || "strict"
    };
    const opening = getOpeningQuestion(config);
    this.setData({
      config,
      scenarioName: getScenario(config.scenario).name,
      roleName: getRole(config.role),
      difficultyName: getDifficulty(config.difficulty),
      useDemoMode: app.globalData.useDemoMode,
      voiceEnabled: app.globalData.voiceEnabled,
      history: [this.makeMessage(opening.role, opening.text, "", `${config.scenario}-0`)]
    });

    this.initRecorder();
    this.initAudio();

    if (app.globalData.voiceEnabled) {
      setTimeout(() => this.playLatestAssistant(), 350);
    }
  },

  onUnload() {
    if (audioContext) {
      audioContext.destroy();
      audioContext = null;
    }
  },

  initRecorder() {
    if (typeof wx === "undefined" || !wx.getRecorderManager) {
      recorder = null;
      this.setData({
        hasRecordSupport: false,
        recordTip: "当前环境暂不支持录音。你可以先用文字或示范回答跑通练习。"
      });
      return;
    }

    recorder = wx.getRecorderManager();
    recorder.onStop((res) => {
      this.setData({ isRecording: false });
      this.submitAudio(res.tempFilePath);
    });

    recorder.onError(() => {
      this.setData({ isRecording: false, isLoading: false });
      wx.showToast({ title: "录音失败", icon: "none" });
    });
  },

  initAudio() {
    if (typeof wx === "undefined" || !wx.createInnerAudioContext) return;
    if (audioContext) audioContext.destroy();
    audioContext = wx.createInnerAudioContext();
    audioContext.obeyMuteSwitch = false;
    audioContext.onEnded(() => {
      this.setData({ isPlaying: false, playingMessageId: "" });
    });
    audioContext.onError(() => {
      this.setData({ isPlaying: false, playingMessageId: "" });
      wx.showToast({ title: "语音播放失败", icon: "none" });
    });
  },

  makeMessage(role, text, feedback, audioKey, meta) {
    const extra = meta || {};
    return {
      id: Date.now() + Math.floor(Math.random() * 10000),
      role,
      text,
      feedback: feedback || "",
      audioKey: audioKey || "",
      originalText: extra.originalText || "",
      normalizedText: extra.normalizedText || "",
      normalizeNote: extra.normalizeNote || ""
    };
  },

  scrollToBottom() {
    this.setData({ scrollAnchor: "" });
    setTimeout(() => this.setData({ scrollAnchor: "bottom-anchor" }), 30);
  },

  getApiErrorTitle(statusCode, fallback) {
    const status = Number(statusCode || 0);
    if (status === 401) return "Key无效";
    if (status === 402 || status === 429) return "API额度不足";
    if (status >= 500) return "后端异常";
    return fallback || "请求失败";
  },

  onDraftInput(event) {
    this.setData({ draftAnswer: event.detail.value });
  },

  fillSampleAnswer() {
    const sample = this.data.sampleAnswers[this.data.userTurn] || this.data.sampleAnswers[0];
    this.setData({ draftAnswer: sample });
  },

  toggleVoice(event) {
    const value = event.detail.value;
    if (app.setVoiceEnabled) app.setVoiceEnabled(value);
    this.setData({ voiceEnabled: value });
    if (value) {
      this.playLatestAssistant();
    } else if (audioContext && audioContext.stop) {
      audioContext.stop();
      this.setData({ isPlaying: false, playingMessageId: "" });
    }
  },

  toggleMixedAssist(event) {
    this.setData({
      mixedLanguageAssist: event.detail.value,
      normalizeTip: event.detail.value ? "" : "已关闭中英混说辅助，回答会按原文提交。"
    });
  },

  startRecording() {
    if (this.data.isLoading) return;
    if (!recorder) {
      this.setData({
        recordTip: "当前环境暂不支持录音。先用文字输入或示范回答，真机调试时再测试录音。"
      });
      wx.showToast({ title: "可先用文字回答", icon: "none" });
      return;
    }
    this.ensureRecordPermission(() => this.startRecorderNow());
  },

  ensureRecordPermission(callback) {
    if (!wx.getSetting || !wx.authorize) {
      callback();
      return;
    }

    wx.getSetting({
      success: (setting) => {
        const auth = setting.authSetting || {};
        if (auth["scope.record"]) {
          callback();
          return;
        }

        if (auth["scope.record"] === false) {
          this.showRecordPermissionModal(callback);
          return;
        }

        wx.authorize({
          scope: "scope.record",
          success: callback,
          fail: () => this.showRecordPermissionModal(callback)
        });
      },
      fail: () => {
        wx.authorize({
          scope: "scope.record",
          success: callback,
          fail: () => this.showRecordPermissionModal(callback)
        });
      }
    });
  },

  showRecordPermissionModal(callback) {
    this.setData({
      recordTip:
        "开发工具详情页没有麦克风开关。请先清缓存/清除授权数据后重新点录音；真机可在小程序右上角 ... 的设置里开启麦克风。"
    });
    wx.showModal({
      title: "需要录音授权",
      content:
        "开发工具里请先尝试打开小程序授权页；如果看不到麦克风开关，就清除授权数据后重新点录音。手机真机在右上角 ... 设置里开启麦克风。",
      confirmText: "打开授权页",
      cancelText: "先文字练",
      success: (res) => {
        if (!res.confirm || !wx.openSetting) return;
        wx.openSetting({
          success: (setting) => {
            const auth = setting.authSetting || {};
            if (auth["scope.record"]) {
              this.setData({ recordTip: "" });
              callback();
            } else {
              this.setData({
                recordTip:
                  "仍未开启录音权限。开发工具请清除授权数据后重新点录音；真机请在小程序右上角 ... 的设置里打开麦克风。"
              });
              wx.showToast({ title: "未开启录音权限", icon: "none" });
            }
          }
        });
      }
    });
  },

  startRecorderNow() {
    recorder.start({
      duration: 60000,
      sampleRate: 16000,
      numberOfChannels: 1,
      encodeBitRate: 48000,
      format: "mp3"
    });
    this.setData({ isRecording: true, recordTip: "" });
  },

  stopRecording() {
    if (!this.data.isRecording || !recorder) return;
    recorder.stop();
  },

  playMessageAudio(event) {
    const id = String(event.currentTarget.dataset.id || "");
    const message = this.data.history.find((item) => String(item.id) === id);
    if (message) this.playAssistantAudio(message);
  },

  playLatestAssistant() {
    const assistants = this.data.history.filter((item) => item.role === "assistant");
    const latest = assistants[assistants.length - 1];
    if (latest) this.playAssistantAudio(latest);
  },

  playAssistantAudio(message) {
    if (!message || message.role !== "assistant") return;
    if (!audioContext) this.initAudio();
    if (!audioContext) {
      wx.showToast({ title: "当前环境不支持播放", icon: "none" });
      return;
    }

    if (audioContext.stop) audioContext.stop();
    this.setData({ isPlaying: true, playingMessageId: String(message.id) });

    if (message.audioKey) {
      audioContext.src = `/assets/audio/${message.audioKey}.wav`;
      audioContext.play();
      return;
    }

    if (!this.data.useDemoMode && wx.downloadFile) {
      const url = `${app.globalData.apiBase}/api/speech?text=${encodeURIComponent(message.text)}`;
      wx.downloadFile({
        url,
        success: (res) => {
          if (res.statusCode === 200 && res.tempFilePath) {
            audioContext.src = res.tempFilePath;
            audioContext.play();
          } else {
            this.setData({ isPlaying: false, playingMessageId: "" });
            if (res.statusCode === 401 || res.statusCode === 402 || res.statusCode === 429) {
              wx.showToast({ title: this.getApiErrorTitle(res.statusCode), icon: "none" });
              return;
            }
            wx.showToast({ title: "语音生成失败", icon: "none" });
          }
        },
        fail: () => {
          this.setData({ isPlaying: false, playingMessageId: "" });
          wx.showToast({ title: "后端未连接", icon: "none" });
        }
      });
      return;
    }

    this.setData({ isPlaying: false, playingMessageId: "" });
    wx.showToast({ title: "演示音频暂未覆盖这句", icon: "none" });
  },

  submitAudio(tempFilePath) {
    if (this.data.useDemoMode) {
      const sampleAnswers = [
        "I am a product manager candidate with experience in user research and feature planning. I want to work in an international team and improve user experience with AI products.",
        "In my previous project, I worked with designers and engineers to define the user flow, collect feedback, and launch the first version within two weeks.",
        "I believe I am a good fit because I can connect user needs, business goals, and technical possibilities."
      ];
      const answer = sampleAnswers[this.data.userTurn] || sampleAnswers[0];
      this.submitAnswer(answer);
      return;
    }

    this.setData({ isLoading: true });
    wx.uploadFile({
      url: `${app.globalData.apiBase}/api/transcribe`,
      filePath: tempFilePath,
      name: "audio",
      success: (res) => {
        try {
          if (res.statusCode >= 400) {
            wx.showToast({ title: this.getApiErrorTitle(res.statusCode, "转文字失败"), icon: "none" });
            this.setData({ isLoading: false });
            return;
          }
          const data = JSON.parse(res.data);
          if (!data.text) throw new Error("No transcript");
          this.setData({ isLoading: false });
          this.submitAnswer(data.text);
        } catch (error) {
          wx.showToast({ title: "转文字失败", icon: "none" });
          this.setData({ isLoading: false });
        }
      },
      fail: () => {
        wx.showToast({ title: "后端未连接", icon: "none" });
        this.setData({ isLoading: false });
      }
    });
  },

  submitText() {
    const answer = this.data.draftAnswer.trim();
    if (!answer) {
      wx.showToast({ title: "先输入英文回答", icon: "none" });
      return;
    }
    this.submitAnswer(answer);
  },

  submitAnswer(answer) {
    if (this.data.isLoading) return;
    this.setData({
      isLoading: true,
      normalizeTip: this.data.mixedLanguageAssist ? "正在识别并整理你的表达..." : ""
    });
    this.normalizeAnswer(answer, (normalized) => {
      this.submitNormalizedAnswer(answer, normalized);
    });
  },

  normalizeAnswer(answer, callback) {
    if (!this.data.mixedLanguageAssist) {
      callback({
        normalizedText: answer,
        wasMixedLanguage: false,
        note: ""
      });
      return;
    }

    if (this.data.useDemoMode) {
      callback(normalizeMixedAnswer(answer, this.data.config, this.data.userTurn + 1));
      return;
    }

    wx.request({
      url: `${app.globalData.apiBase}/api/normalize-answer`,
      method: "POST",
      data: {
        config: this.data.config,
        answer,
        userTurn: this.data.userTurn + 1
      },
      success: (res) => {
        const data = res.data || {};
        if (res.statusCode >= 400 || !data.normalizedText) {
          callback(normalizeMixedAnswer(answer, this.data.config, this.data.userTurn + 1));
          return;
        }
        callback({
          normalizedText: data.normalizedText || answer,
          wasMixedLanguage: Boolean(data.wasMixedLanguage),
          note: data.note || ""
        });
      },
      fail: () => {
        callback(normalizeMixedAnswer(answer, this.data.config, this.data.userTurn + 1));
      }
    });
  },

  submitNormalizedAnswer(originalAnswer, normalized) {
    const answer = normalized.normalizedText || originalAnswer;

    const userTurn = this.data.userTurn + 1;
    const progressPercent = Math.min(100, Math.round((userTurn / this.data.maxTurns) * 100));
    const userMessage = this.makeMessage("user", answer, "", "", {
      originalText: normalized.wasMixedLanguage ? originalAnswer : "",
      normalizedText: normalized.wasMixedLanguage ? answer : "",
      normalizeNote: normalized.note || ""
    });
    const history = this.data.history.concat(userMessage);
    this.setData({
      history,
      draftAnswer: "",
      userTurn,
      progressPercent,
      roundLabel: `第 ${Math.min(userTurn + 1, this.data.maxTurns)} / ${this.data.maxTurns} 轮`,
      normalizeTip: normalized.note || "",
      isLoading: true
    });
    this.scrollToBottom();

    if (this.data.useDemoMode) {
      const result = demoNextQuestion({
        config: this.data.config,
        answer,
        userTurn
      });
      this.applyNextResult(result);
      return;
    }

    wx.request({
      url: `${app.globalData.apiBase}/api/interview/next`,
      method: "POST",
      data: {
        config: this.data.config,
        history,
        answer,
        userTurn
      },
      success: (res) => {
        if (res.statusCode >= 400) {
          wx.showToast({ title: this.getApiErrorTitle(res.statusCode, "AI请求失败"), icon: "none" });
          this.setData({ isLoading: false });
          return;
        }
        if (!res.data || !res.data.assistantText) {
          wx.showToast({ title: "AI 返回异常", icon: "none" });
          this.setData({ isLoading: false });
          return;
        }
        this.applyNextResult(res.data);
      },
      fail: () => {
        wx.showToast({ title: "后端未连接", icon: "none" });
        this.setData({ isLoading: false });
      }
    });
  },

  applyNextResult(result) {
    const history = this.data.history.slice();
    const lastIndex = history.length - 1;
    if (history[lastIndex] && history[lastIndex].role === "user") {
      history[lastIndex].feedback = result.feedback || "";
    }

    if (result.assistantText && !result.done) {
      history.push(
        this.makeMessage(
          "assistant",
          result.assistantText,
          "",
          this.data.useDemoMode ? `${this.data.config.scenario}-${this.data.userTurn}` : ""
        )
      );
    }

    this.setData({
      history,
      isLoading: false
    });
    this.scrollToBottom();

    if (result.assistantText && !result.done && this.data.voiceEnabled) {
      setTimeout(() => this.playLatestAssistant(), 250);
    }

    if (result.done) {
      setTimeout(() => this.finishSession(), 500);
    }
  },

  finishSession() {
    if (this.data.isFinishing) return;

    if (this.data.useDemoMode) {
      const report = buildDemoReport(this.data.history, this.data.config);
      app.globalData.lastReport = report;
      wx.navigateTo({ url: "/pages/report/report" });
      return;
    }

    this.setData({ isFinishing: true });
    wx.request({
      url: `${app.globalData.apiBase}/api/report`,
      method: "POST",
      data: {
        config: this.data.config,
        history: this.data.history
      },
      success: (res) => {
        app.globalData.lastReport = res.data;
        wx.navigateTo({ url: "/pages/report/report" });
      },
      fail: () => {
        wx.showToast({ title: "报告生成失败", icon: "none" });
      },
      complete: () => {
        this.setData({ isFinishing: false });
      }
    });
  }
});
