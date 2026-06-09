const app = typeof getApp === "function" ? getApp() : { globalData: { lastReport: null } };
const { buildDemoReport } = require("../../utils/mock");

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
