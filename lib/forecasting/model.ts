export type ConfidenceLevel = "low" | "medium" | "high";
export type ErrorMetricName = "wape" | "mae";

export type ForecastModelOutput = {
  modelName: string;
  forecast7d: number;
  forecast30d: number;
  dailyDemandAvg: number;
  confidenceLevel: ConfidenceLevel;
  errorMetricName: ErrorMetricName;
  errorMetricValue: number | null;
  historyDaysUsed: number;
};

type ForecastModelDefinition = {
  name: string;
  fit: (history: number[]) => number;
};

type EvaluatedModel = {
  modelName: string;
  dailyRate: number;
  errorMetricName: ErrorMetricName;
  errorMetricValue: number | null;
  score: number;
};

const MODEL_DEFINITIONS: ForecastModelDefinition[] = [
  {
    name: "mean_daily_v1",
    fit: fitMeanDailyRate,
  },
  {
    name: "croston_sba_v1",
    fit: fitCrostonSbaDailyRate,
  },
  {
    name: "ewma_daily_v1",
    fit: fitExponentialSmoothingDailyRate,
  },
];

function roundForecast(value: number) {
  return Number(value.toFixed(2));
}

function average(values: number[]) {
  if (!values.length) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function standardDeviation(values: number[]) {
  if (values.length <= 1) {
    return 0;
  }

  const mean = average(values);
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1);

  return Math.sqrt(variance);
}

function fitMeanDailyRate(history: number[]) {
  return average(history);
}

function fitExponentialSmoothingDailyRate(history: number[]) {
  if (!history.length) {
    return 0;
  }

  const alpha = 0.3;
  let smoothed = history[0] ?? 0;

  for (const value of history.slice(1)) {
    smoothed = alpha * value + (1 - alpha) * smoothed;
  }

  return Math.max(smoothed, 0);
}

function fitCrostonSbaDailyRate(history: number[]) {
  const nonZeroHistory = history.filter((value) => value > 0);

  if (nonZeroHistory.length === 0) {
    return 0;
  }

  if (nonZeroHistory.length === 1) {
    return nonZeroHistory[0] / Math.max(history.length, 1);
  }

  const alpha = 0.2;
  let demandEstimate = nonZeroHistory[0];
  let firstDemandIndex = history.findIndex((value) => value > 0);

  if (firstDemandIndex < 0) {
    firstDemandIndex = 0;
  }

  let intervalEstimate = Math.max(firstDemandIndex + 1, 1);
  let intervalSinceLastDemand = 0;

  for (const value of history) {
    intervalSinceLastDemand += 1;

    if (value <= 0) {
      continue;
    }

    demandEstimate = demandEstimate + alpha * (value - demandEstimate);
    intervalEstimate = intervalEstimate + alpha * (intervalSinceLastDemand - intervalEstimate);
    intervalSinceLastDemand = 0;
  }

  if (intervalEstimate <= 0) {
    return average(history);
  }

  return Math.max((1 - alpha / 2) * (demandEstimate / intervalEstimate), 0);
}

function determineHoldoutDays(historyLength: number) {
  if (historyLength >= 84) {
    return 28;
  }

  if (historyLength >= 42) {
    return 14;
  }

  if (historyLength >= 21) {
    return 7;
  }

  return 0;
}

function evaluateForecastAgainstActuals({
  predictedDailyRate,
  actuals,
}: {
  predictedDailyRate: number;
  actuals: number[];
}) {
  if (!actuals.length) {
    return {
      errorMetricName: "mae" as const,
      errorMetricValue: null,
      score: Number.POSITIVE_INFINITY,
    };
  }

  const absoluteErrors = actuals.map((actual) => Math.abs(actual - predictedDailyRate));
  const totalActual = actuals.reduce((sum, value) => sum + value, 0);
  const mae = average(absoluteErrors);

  if (totalActual > 0) {
    const wape = absoluteErrors.reduce((sum, value) => sum + value, 0) / totalActual;

    return {
      errorMetricName: "wape" as const,
      errorMetricValue: roundForecast(wape),
      score: wape,
    };
  }

  return {
    errorMetricName: "mae" as const,
    errorMetricValue: roundForecast(mae),
    score: mae,
  };
}

function evaluateModels(dailyHistory: number[]) {
  const holdoutDays = determineHoldoutDays(dailyHistory.length);
  const trainingHistory =
    holdoutDays > 0 ? dailyHistory.slice(0, dailyHistory.length - holdoutDays) : dailyHistory;
  const holdoutHistory = holdoutDays > 0 ? dailyHistory.slice(-holdoutDays) : [];

  const evaluatedModels: EvaluatedModel[] = MODEL_DEFINITIONS.map((model) => {
    const fittedDailyRate = model.fit(trainingHistory);
    const evaluation = evaluateForecastAgainstActuals({
      predictedDailyRate: fittedDailyRate,
      actuals: holdoutHistory,
    });
    const finalDailyRate = model.fit(dailyHistory);

    return {
      modelName: model.name,
      dailyRate: finalDailyRate,
      errorMetricName: evaluation.errorMetricName,
      errorMetricValue: evaluation.errorMetricValue,
      score: evaluation.score,
    };
  }).sort((first, second) => {
    if (first.score !== second.score) {
      return first.score - second.score;
    }

    return first.modelName.localeCompare(second.modelName);
  });

  return {
    selectedModel: evaluatedModels[0],
    holdoutDays,
    evaluatedModels,
  };
}

function calculateConfidenceLevel({
  historyLength,
  nonZeroDays,
  errorMetricName,
  errorMetricValue,
  dailyHistory,
}: {
  historyLength: number;
  nonZeroDays: number;
  errorMetricName: ErrorMetricName;
  errorMetricValue: number | null;
  dailyHistory: number[];
}) {
  if (historyLength < 21 || nonZeroDays === 0) {
    return "low" as const;
  }

  let confidenceScore = 0;

  if (historyLength >= 90) {
    confidenceScore += 2;
  } else if (historyLength >= 45) {
    confidenceScore += 1;
  }

  if (nonZeroDays >= 15) {
    confidenceScore += 1;
  } else if (nonZeroDays <= 4) {
    confidenceScore -= 1;
  }

  const nonZeroDemand = dailyHistory.filter((value) => value > 0);
  const meanDemand = average(nonZeroDemand);
  const cv = meanDemand > 0 ? standardDeviation(nonZeroDemand) / meanDemand : Number.POSITIVE_INFINITY;

  if (cv <= 1.2) {
    confidenceScore += 1;
  } else if (cv >= 2) {
    confidenceScore -= 1;
  }

  if (errorMetricValue !== null) {
    if (errorMetricName === "wape") {
      if (errorMetricValue <= 0.25) {
        confidenceScore += 2;
      } else if (errorMetricValue <= 0.5) {
        confidenceScore += 1;
      } else {
        confidenceScore -= 1;
      }
    } else {
      const normalizedMae = meanDemand > 0 ? errorMetricValue / meanDemand : errorMetricValue;

      if (normalizedMae <= 0.5) {
        confidenceScore += 1;
      } else if (normalizedMae > 1) {
        confidenceScore -= 1;
      }
    }
  }

  if (confidenceScore >= 4) {
    return "high" as const;
  }

  if (confidenceScore >= 2) {
    return "medium" as const;
  }

  return "low" as const;
}

export function generateDemandForecast({
  dailyHistory,
}: {
  dailyHistory: number[];
}): ForecastModelOutput {
  const sanitizedHistory = dailyHistory.map((value) => (value > 0 ? value : 0));
  const historyDaysUsed = sanitizedHistory.length;
  const dailyDemandAvg = average(sanitizedHistory);
  const nonZeroDays = sanitizedHistory.filter((value) => value > 0).length;
  const { selectedModel } = evaluateModels(sanitizedHistory);
  const confidenceLevel = calculateConfidenceLevel({
    historyLength: historyDaysUsed,
    nonZeroDays,
    errorMetricName: selectedModel.errorMetricName,
    errorMetricValue: selectedModel.errorMetricValue,
    dailyHistory: sanitizedHistory,
  });

  return {
    modelName: selectedModel.modelName,
    dailyDemandAvg: roundForecast(dailyDemandAvg),
    forecast7d: roundForecast(selectedModel.dailyRate * 7),
    forecast30d: roundForecast(selectedModel.dailyRate * 30),
    confidenceLevel,
    errorMetricName: selectedModel.errorMetricName,
    errorMetricValue: selectedModel.errorMetricValue,
    historyDaysUsed,
  };
}
