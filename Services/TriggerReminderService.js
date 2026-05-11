export function queueTriggerReminders({ phase, permanents = [], automationRules = [], now = Date.now() }) {
  const reminders = [];

  permanents.forEach((permanent) => {
    const oracleText = String(permanent?.oracleText || "").toLowerCase();
    if (!oracleText) {
      return;
    }

    if (oracleText.includes("at the beginning of") && oracleText.includes(String(phase || "").toLowerCase())) {
      reminders.push({
        id: createReminderId(),
        summary: `${permanent.name}: beginning of ${phase} trigger`,
        source: permanent.name,
        deterministic: isDeterministicOracleText(oracleText),
        timestamp: now,
      });
    }

    if (oracleText.includes("whenever") && oracleText.includes("attacks")) {
      reminders.push({
        id: createReminderId(),
        summary: `${permanent.name}: attack trigger available`,
        source: permanent.name,
        deterministic: isDeterministicOracleText(oracleText),
        timestamp: now,
      });
    }
  });

  automationRules.forEach((rule) => {
    const rulePhase = String(rule?.phase || "").toLowerCase();
    if (String(phase || "").toLowerCase() !== rulePhase) {
      return;
    }

    reminders.push({
      id: createReminderId(),
      summary: `${rule.sourceCardName || "Automation"}: ${rule.actionType}`,
      source: rule.sourceCardName || "Automation",
      deterministic: isDeterministicRule(rule),
      timestamp: now,
    });
  });

  return reminders;
}

export function isDeterministicRule(rule) {
  if (!rule) {
    return false;
  }

  if (rule.requiresTargetSelection || rule.askBeforeRun) {
    return false;
  }

  const targetType = String(rule.targetType || rule.target || "").toLowerCase();
  if (targetType.includes("selected") || targetType.includes("target")) {
    return false;
  }

  return true;
}

export function isDeterministicOracleText(oracleText) {
  const normalized = String(oracleText || "").toLowerCase();
  if (!normalized) {
    return false;
  }

  if (normalized.includes("may") || normalized.includes("target") || normalized.includes("choose")) {
    return false;
  }

  return normalized.includes("create") || normalized.includes("counter") || normalized.includes("gain");
}

function createReminderId() {
  return `trg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
