export const DEFAULT_SCORING_WEIGHTS = Object.freeze({
  overtime: 30,
  project: 25,
  workLifeBalanceRisk: 25,
  additionalAssessmentRisk: 20
});

export const DEFAULT_RESPONSE_OPTIONS = Object.freeze([
  { id: 'option-1', label: 'Never', score: 1 },
  { id: 'option-2', label: 'Rarely', score: 2 },
  { id: 'option-3', label: 'Sometimes', score: 3 },
  { id: 'option-4', label: 'Often', score: 4 },
  { id: 'option-5', label: 'Always', score: 5 }
]);

const QUESTION_DEFINITIONS = [
  ['Overtime Assessment', 'How frequently do you work beyond your scheduled working hours?', 'negative'],
  ['Overtime Assessment', 'How often do you need to extend your working day to complete assigned tasks?', 'negative'],
  ['Overtime Assessment', 'How frequently does overtime affect your rest or personal time?', 'negative'],
  ['Project Workload Assessment', 'How often are you responsible for more projects than you can comfortably manage?', 'negative'],
  ['Project Workload Assessment', 'How frequently do project deadlines create excessive work pressure?', 'negative'],
  ['Project Workload Assessment', 'How often do overlapping project responsibilities affect your work quality or personal time?', 'negative'],
  ['Work-Life Balance Assessment', 'How often can you maintain a healthy balance between work and personal life?', 'positive'],
  ['Work-Life Balance Assessment', 'How frequently does work interfere with your personal or family time?', 'negative'],
  ['Work-Life Balance Assessment', 'How often do you have enough time to rest and recover after work?', 'positive'],
  ['Work-Life Balance Assessment', 'How satisfied are you with your current work-life balance?', 'positive'],
  ['Additional Burnout Assessment', 'How satisfied are you with your job overall?', 'positive'],
  ['Additional Burnout Assessment', 'How frequently do you feel stressed by your work?', 'negative'],
  ['Additional Burnout Assessment', 'How often does your manager provide the support you need?', 'positive'],
  ['Additional Burnout Assessment', 'How often can you rely on your team for support?', 'positive'],
  ['Additional Burnout Assessment', 'How often can you access training that helps you do your job?', 'positive'],
  ['Additional Burnout Assessment', 'How often are you able to take leave when you need it?', 'positive'],
  ['Additional Burnout Assessment', 'How often do you feel recognized and appreciated for your work?', 'positive'],
  ['Additional Burnout Assessment', 'How frequently does your workplace environment make it difficult to focus or feel comfortable?', 'negative'],
  ['Additional Burnout Assessment', 'How often do you have enough time to recover after demanding work?', 'positive'],
  ['Additional Burnout Assessment', 'How likely are you to remain with this organization over the next year?', 'positive']
];

export const createDefaultQuestions = () => QUESTION_DEFINITIONS.map(([section, text, scoringDirection], index) => ({
  id: `q${index + 1}`,
  section,
  text,
  scoringDirection,
  required: true,
  options: DEFAULT_RESPONSE_OPTIONS.map((option) => ({ ...option }))
}));

export const validateAssessmentQuestions = (questions, { requireComplete = false } = {}) => {
  if (!Array.isArray(questions)) throw new Error('Assessment questions must be an array.');
  if (requireComplete && questions.length !== QUESTION_DEFINITIONS.length) {
    throw new Error('A published assessment must contain exactly 20 questions.');
  }
  if (questions.length > QUESTION_DEFINITIONS.length) {
    throw new Error('An assessment cannot contain more than 20 questions.');
  }

  const seenIds = new Set();
  for (const [index, question] of questions.entries()) {
    if (!question || typeof question.id !== 'string' || !/^q([1-9]|1\d|20)$/.test(question.id)) {
      throw new Error(`Question ${index + 1} must use a valid question ID from q1 to q20.`);
    }
    if (seenIds.has(question.id)) throw new Error(`Question ID ${question.id} is duplicated.`);
    seenIds.add(question.id);
    if (typeof question.text !== 'string' || !question.text.trim()) {
      throw new Error(`Question ${question.id} must have question text.`);
    }
    if (typeof question.required !== 'boolean') {
      throw new Error(`Question ${question.id} must specify whether it is required.`);
    }
    if (!['positive', 'negative'].includes(question.scoringDirection)) {
      throw new Error(`Question ${question.id} must declare a positive or negative scoring direction.`);
    }
    if (Number(question.id.slice(1)) <= 10
      && question.scoringDirection !== QUESTION_DEFINITIONS[Number(question.id.slice(1)) - 1][2]) {
      throw new Error(`Question ${question.id} scoring direction cannot be changed.`);
    }
    if (!['Overtime Assessment', 'Project Workload Assessment', 'Work-Life Balance Assessment', 'Additional Burnout Assessment'].includes(question.section)) {
      throw new Error(`Question ${question.id} has an unsupported section.`);
    }
    if (!Array.isArray(question.options) || question.options.length !== 5) {
      throw new Error(`Question ${question.id} must contain exactly five response options.`);
    }
    const optionIds = new Set();
    const scores = new Set();
    for (const option of question.options) {
      if (!option || typeof option.id !== 'string' || !option.id.trim() || optionIds.has(option.id)) {
        throw new Error(`Question ${question.id} has invalid or duplicate response option IDs.`);
      }
      const score = Number(option.score);
      if (!Number.isFinite(score)) throw new Error(`Question ${question.id} has a non-numeric response score.`);
      if (scores.has(score)) throw new Error(`Question ${question.id} must have a unique score for each response option.`);
      if (typeof option.label !== 'string' || !option.label.trim()) {
        throw new Error(`Question ${question.id} has an empty response option label.`);
      }
      optionIds.add(option.id);
      scores.add(score);
    }
  }

  if (requireComplete) {
    for (let index = 0; index < QUESTION_DEFINITIONS.length; index += 1) {
      const question = questions.find((item) => item.id === `q${index + 1}`);
      if (!question) throw new Error(`Published assessment is missing question q${index + 1}.`);
      if (question.section !== QUESTION_DEFINITIONS[index][0]) {
        throw new Error(`Question q${index + 1} must belong to ${QUESTION_DEFINITIONS[index][0]}.`);
      }
    }
  }
};

export const validateScoringWeights = (weights = DEFAULT_SCORING_WEIGHTS) => {
  const keys = Object.keys(DEFAULT_SCORING_WEIGHTS);
  if (!weights || keys.some((key) => !Number.isFinite(Number(weights[key])) || Number(weights[key]) < 0)) {
    throw new Error('Scoring weights must be non-negative numbers.');
  }
  const total = keys.reduce((sum, key) => sum + Number(weights[key]), 0);
  if (Math.abs(total - 100) > 0.0001) throw new Error('Scoring weights must total 100%.');
  return Object.fromEntries(keys.map((key) => [key, Number(weights[key])]));
};

export const calculateAssessmentResults = (questions, answers, weights = DEFAULT_SCORING_WEIGHTS) => {
  validateAssessmentQuestions(questions, { requireComplete: true });
  const validWeights = validateScoringWeights(weights);
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) {
    throw new Error('Assessment answers must be an object keyed by question ID.');
  }
  if (Object.keys(answers).some((questionId) => !questions.some((question) => question.id === questionId))) {
    throw new Error('Assessment answers include an unknown question ID.');
  }

  const questionScores = {};
  for (const question of questions) {
    const selectedOptionId = answers[question.id];
    if (question.required && !selectedOptionId) {
      throw new Error(`Question ${question.id} is required.`);
    }
    if (selectedOptionId === undefined || selectedOptionId === null || selectedOptionId === '') continue;
    const option = question.options.find((candidate) => candidate.id === selectedOptionId);
    if (!option) throw new Error(`Question ${question.id} contains an invalid response option.`);
    const allScores = question.options.map((candidate) => Number(candidate.score));
    const minScore = Math.min(...allScores);
    const maxScore = Math.max(...allScores);
    if (maxScore === minScore) throw new Error(`Question ${question.id} must have a non-zero scoring range.`);
    questionScores[question.id] = 1 + ((Number(option.score) - minScore) / (maxScore - minScore)) * 4;
  }

  const averageAnswered = (ids) => {
    const values = ids.map((id) => questionScores[id]).filter(Number.isFinite);
    if (!values.length) throw new Error('Answer at least one question in each assessment section to calculate scores.');
    return round(values.reduce((sum, value) => sum + value, 0) / values.length);
  };
  const overtimeScore = averageAnswered(['q1', 'q2', 'q3']);
  const projectScore = averageAnswered(['q4', 'q5', 'q6']);
  const reversedQ8 = Number.isFinite(questionScores.q8) ? round(6 - questionScores.q8) : null;
  const wlbValues = [questionScores.q7, reversedQ8, questionScores.q9, questionScores.q10].filter(Number.isFinite);
  if (!wlbValues.length) throw new Error('Answer at least one work-life balance question to calculate scores.');
  const wlbScore = round(wlbValues.reduce((sum, value) => sum + value, 0) / wlbValues.length);
  const additionalQuestionIds = Array.from({ length: 10 }, (_, index) => `q${index + 11}`);
  const additionalRisks = additionalQuestionIds.filter((id) => Number.isFinite(questionScores[id])).map((id) => {
    const question = questions.find((item) => item.id === id);
    const score = questionScores[id];
    return question.scoringDirection === 'negative' ? score : 6 - score;
  });
  if (!additionalRisks.length) throw new Error('Answer at least one additional burnout assessment question to calculate scores.');
  const additionalRiskPercentage = percentage(additionalRisks.reduce((sum, score) => sum + score, 0) / (additionalRisks.length * 5));
  const overtimePercentage = percentage(overtimeScore / 5);
  const projectPercentage = percentage(projectScore / 5);
  const wlbPercentage = percentage(wlbScore / 5);
  const wlbRiskPercentage = round(100 - wlbPercentage);
  const overallScore = round((
    (overtimePercentage * validWeights.overtime)
    + (projectPercentage * validWeights.project)
    + (wlbRiskPercentage * validWeights.workLifeBalanceRisk)
    + (additionalRiskPercentage * validWeights.additionalAssessmentRisk)
  ) / 100);

  return {
    overtimeScore,
    overtimePercentage,
    projectScore,
    projectPercentage,
    wlbScore,
    wlbPercentage,
    wlbRiskPercentage,
    additionalRiskPercentage,
    overallScore,
    scoringWeights: validWeights,
    reversedQ8: round(reversedQ8),
    normalizedAnswers: questionScores
  };
};

function percentage(value) {
  return round(value * 100);
}

function round(value) {
  return Number(value.toFixed(2));
}
