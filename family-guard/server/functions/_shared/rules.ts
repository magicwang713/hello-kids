export type DashboardInput = {
  total_minutes: number;
  night_minutes: number;
  short_video_ratio_wow: number;
  game_minutes_3days_avg: number;
  night_delta_percent: number;
};

export function calculateRiskScore(input: DashboardInput) {
  let score = 0;
  const signals: string[] = [];

  if (input.night_minutes >= 30) {
    score += 25;
    signals.push("夜间使用超过30分钟");
  }
  if (input.short_video_ratio_wow >= 0.3) {
    score += 20;
    signals.push("短视频占比上升30%+");
  }
  if (input.game_minutes_3days_avg >= 60) {
    score += 15;
    signals.push("近三日游戏均值超60分钟");
  }
  if (input.night_delta_percent >= 0.25) {
    score += 10;
    signals.push("夜间环比+25%");
  }

  return {
    score: Math.min(100, score),
    signals,
  };
}

type Tone = "strong" | "neutral" | "gentle";

const tonePrompts: Record<Tone, string> = {
  strong: "请用坚定但尊重的语气，提醒孩子调整使用习惯。",
  neutral: "请用中性建设性的语气，提出合作改进建议。",
  gentle: "请用温和鼓励的语气，与孩子共创解决方案。",
};

export function generateTips(riskScore: number, signals: string[], childName = "孩子") {
  const why = signals.length > 0
    ? `根据近期数据：${signals.join("，")}`
    : "近期使用平稳，维持良好习惯。";

  const tones: Tone[] = ["strong", "neutral", "gentle"];
  const baseSuggestion = riskScore > 60
    ? `${childName} 最近的使用需要及时调整。`
    : riskScore > 30
      ? `${childName} 的使用略有增加，建议适度引导。`
      : `${childName} 的使用总体健康，可继续保持。`;

  const tips = tones.reduce<Record<Tone, string>>((acc, tone) => {
    acc[tone] = `${baseSuggestion}${tonePrompts[tone]}`;
    return acc;
  }, {} as Record<Tone, string>);

  return {
    ...tips,
    why,
  };
}
