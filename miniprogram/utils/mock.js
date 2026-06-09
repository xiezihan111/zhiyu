const scenarioCopy = {
  interview: {
    name: "英文面试",
    opening: "Welcome. To begin, please introduce yourself and explain why this role is a good fit for you.",
    questions: [
      "Tell me about a project where you had to work with different stakeholders.",
      "What is one weakness in your English communication, and how are you improving it?",
      "Why should we choose you over other candidates?"
    ]
  },
  meeting: {
    name: "会议发言",
    opening: "Let's start with your weekly update. Please summarize your progress, blockers, and next steps.",
    questions: [
      "What support do you need from the team?",
      "If the timeline changes, how would you explain the trade-off?",
      "Please close the meeting with a clear action plan."
    ]
  },
  intro: {
    name: "自我介绍",
    opening: "Please give a concise professional self-introduction in English.",
    questions: [
      "Can you make it more specific with one concrete achievement?",
      "How would you introduce yourself to a foreign manager?",
      "Can you make the ending more confident and memorable?"
    ]
  }
};

const roleCopy = {
  pm: "产品经理",
  engineer: "程序员",
  operator: "运营",
  sales: "销售"
};

const difficultyCopy = {
  basic: "初级",
  advanced: "进阶",
  strict: "严厉"
};

function getScenario(key) {
  return scenarioCopy[key] || scenarioCopy.interview;
}

function getRole(key) {
  return roleCopy[key] || roleCopy.pm;
}

function getDifficulty(key) {
  return difficultyCopy[key] || difficultyCopy.basic;
}

function getOpeningQuestion(config) {
  const scenario = getScenario(config.scenario);
  return {
    role: "assistant",
    text: scenario.opening
  };
}

function containsChinese(text) {
  return /[\u4e00-\u9fff]/.test(String(text || ""));
}

function normalizeMixedAnswer(answer, config, turn) {
  const raw = String(answer || "").trim();
  if (!raw) {
    return {
      normalizedText: "",
      wasMixedLanguage: false,
      note: ""
    };
  }

  if (!containsChinese(raw)) {
    return {
      normalizedText: raw,
      wasMixedLanguage: false,
      note: ""
    };
  }

  const roleName = getRole(config && config.role);
  const lower = raw.toLowerCase();
  let normalizedText = "";

  if (raw.includes("用户") || raw.includes("调研") || raw.includes("产品") || lower.includes("roadmap")) {
    normalizedText =
      "I was responsible for user research and product planning. I worked with the team to understand user needs, define priorities, and turn those insights into a clear product roadmap.";
  } else if (raw.includes("项目") || raw.includes("设计") || raw.includes("工程") || raw.includes("上线")) {
    normalizedText =
      "In one project, I worked closely with design and engineering teams to define the user flow, collect feedback, and launch the first version within a short timeline.";
  } else if (raw.includes("会议") || raw.includes("进度") || raw.includes("风险")) {
    normalizedText =
      "In the meeting, I would summarize the current progress, explain the key risks, and make the next steps clear for everyone involved.";
  } else if (raw.includes("紧张") || raw.includes("不自信") || raw.includes("发音")) {
    normalizedText =
      "One challenge I am working on is speaking more confidently in English. I practice by preparing structured answers and reviewing my pronunciation after each session.";
  } else {
    normalizedText =
      `As a ${roleName}, I want to express my ideas clearly in English. I can explain my experience, share concrete examples, and keep improving my communication in professional situations.`;
  }

  return {
    normalizedText,
    wasMixedLanguage: true,
    note: "检测到中文或中英混说，已先整理成自然英文，再交给 AI 考官评估。"
  };
}

function buildFeedback(answer, config, turn) {
  const words = String(answer || "").trim().split(/\s+/).filter(Boolean);
  const shortAnswer = words.length < 18;
  const roleName = getRole(config.role);
  const base = shortAnswer
    ? "回答偏短，面试官还看不到你的经历证据。"
    : "回答已经能表达基本意思，可以继续增强结构和结果感。";
  const structureTip =
    turn === 1
      ? "建议用 Past-Present-Future：过去经历、现在能力、未来匹配。"
      : "建议用 STAR：Situation、Task、Action、Result。";
  return `${base} ${structureTip} 你可以补一句和${roleName}相关的量化结果。`;
}

function demoNextQuestion(payload) {
  const config = payload.config || {};
  const answer = payload.answer || "";
  const userTurn = payload.userTurn || 1;
  const scenario = getScenario(config.scenario);
  const done = userTurn >= 3;
  const nextText = done
    ? "Thanks. That is enough for this round. I will now give you a summary report."
    : scenario.questions[userTurn - 1] || scenario.questions[0];

  return {
    feedback: buildFeedback(answer, config, userTurn),
    assistantText: nextText,
    done
  };
}

function buildDemoReport(history, config) {
  const userAnswers = history.filter((item) => item.role === "user");
  const totalWords = userAnswers.reduce((sum, item) => {
    return sum + String(item.text || "").split(/\s+/).filter(Boolean).length;
  }, 0);
  const lengthBoost = Math.min(12, Math.floor(totalWords / 18));
  const scenario = getScenario(config.scenario);

  return {
    title: `${scenario.name}陪练报告`,
    summary: "你已经完成一轮职场英语模拟。整体能开口表达，但需要加强结构、例子和更自然的商务表达。",
    scores: [
      { name: "流利度", value: 68 + lengthBoost },
      { name: "结构感", value: 64 + Math.min(10, userAnswers.length * 3) },
      { name: "自然度", value: 66 + Math.min(8, lengthBoost) },
      { name: "职场匹配", value: 70 }
    ],
    strengths: [
      "能围绕问题直接作答，没有明显跑题。",
      "已经具备完成基础英文面试/会议表达的起点。",
      "适合继续做高频场景的短轮练习。"
    ],
    improvements: [
      "每个回答都补一个具体例子，减少空泛描述。",
      "用 because, for example, as a result 连接逻辑。",
      "把中式表达换成更自然的职场英语。"
    ],
    upgradedSentences: [
      {
        before: "I am responsible for product work.",
        after: "I own the product workflow from user research to launch, and I work closely with design and engineering teams."
      },
      {
        before: "I want to improve my English.",
        after: "I am actively improving my spoken English so I can communicate more clearly in cross-functional meetings."
      },
      {
        before: "This project is good.",
        after: "This project improved the user experience and helped the team validate the core business assumption."
      }
    ],
    portfolioNote:
      "这是一个面向中国职场人的 AI 英语口语陪练 MVP。核心闭环是场景选择、AI 角色扮演、语音/文字回答、即时反馈和总结评估。"
  };
}

module.exports = {
  getOpeningQuestion,
  demoNextQuestion,
  buildDemoReport,
  containsChinese,
  normalizeMixedAnswer,
  getScenario,
  getRole,
  getDifficulty
};
