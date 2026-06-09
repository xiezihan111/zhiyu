const app = typeof getApp === "function" ? getApp() : { globalData: { lastReport: null } };
const { buildDemoReport } = require("../../utils/mock");
const { trackEvent } = require("../../utils/analytics");

Page({
  data: {
    report: null
  },

  onLoad() {
    const fallback = buildDemoReport([], {
      scenario: "interview",
      role: "pm",
      difficulty: "strict"
    });
    this.setData({
      report: app.globalData.lastReport || fallback
    });
    trackEvent("report_viewed", {
      demoMode: Boolean(app.globalData.useDemoMode)
    });
  },

  copyPortfolio() {
    const report = this.data.report;
    const text = `${report.title}\n\n${report.summary}\n\n${report.portfolioNote}`;
    wx.setClipboardData({ data: text });
  },

  backHome() {
    wx.reLaunch({ url: "/pages/home/home" });
  }
});
