const STORAGE_KEY = "zhiyu_product_metrics_v1";
const ALLOWED_PROPERTIES = [
  "scenario",
  "role",
  "difficulty",
  "demoMode",
  "turn",
  "mixedLanguage",
  "voiceEnabled"
];

function sanitizeProperties(properties) {
  return ALLOWED_PROPERTIES.reduce((result, key) => {
    if (Object.prototype.hasOwnProperty.call(properties || {}, key)) {
      result[key] = properties[key];
    }
    return result;
  }, {});
}

function trackEvent(event, properties) {
  if (typeof wx === "undefined") return;

  const safeProperties = sanitizeProperties(properties);
  const current = wx.getStorageSync ? wx.getStorageSync(STORAGE_KEY) || {} : {};
  current[event] = (current[event] || 0) + 1;
  if (wx.setStorageSync) wx.setStorageSync(STORAGE_KEY, current);

  const app = typeof getApp === "function" ? getApp() : null;
  if (!app || app.globalData.useDemoMode || !app.globalData.apiBase || !wx.request) return;

  wx.request({
    url: `${app.globalData.apiBase}/api/events`,
    method: "POST",
    data: {
      event,
      properties: safeProperties
    }
  });
}

module.exports = {
  trackEvent
};
