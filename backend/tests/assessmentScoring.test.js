import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateAssessmentResults,
  createDefaultQuestions,
  DEFAULT_SCORING_WEIGHTS,
  validateAssessmentQuestions,
  validateScoringWeights
} from '../services/assessmentScoring.js';

const selectedOptions = (questions, score) => Object.fromEntries(
  questions.map((question) => [question.id, question.options.find((option) => option.score === score).id])
);

test('default assessment has 20 ordered questions across the required sections', () => {
  const questions = createDefaultQuestions();
  assert.equal(questions.length, 20);
  assert.deepEqual(questions.slice(0, 3).map((question) => question.section), Array(3).fill('Overtime Assessment'));
  assert.deepEqual(questions.slice(3, 6).map((question) => question.section), Array(3).fill('Project Workload Assessment'));
  assert.deepEqual(questions.slice(6, 10).map((question) => question.section), Array(4).fill('Work-Life Balance Assessment'));
  assert.deepEqual(questions.slice(10).map((question) => question.section), Array(10).fill('Additional Burnout Assessment'));
  validateAssessmentQuestions(questions, { requireComplete: true });
});

test('overtime, project, WLB reverse scoring, and overall weights are calculated server-side', () => {
  const questions = createDefaultQuestions();
  const results = calculateAssessmentResults(questions, selectedOptions(questions, 1));

  assert.equal(results.overtimeScore, 1);
  assert.equal(results.overtimePercentage, 20);
  assert.equal(results.projectScore, 1);
  assert.equal(results.projectPercentage, 20);
  assert.equal(results.reversedQ8, 5);
  assert.equal(results.wlbScore, 2);
  assert.equal(results.wlbPercentage, 40);
  assert.equal(results.wlbRiskPercentage, 60);
  assert.equal(results.additionalRiskPercentage, 84);
  assert.equal(results.overallScore, 42.8);
  assert.deepEqual(results.scoringWeights, DEFAULT_SCORING_WEIGHTS);
});

test('custom option score ranges normalize to the same five-point scale', () => {
  const questions = createDefaultQuestions().map((question) => ({
    ...question,
    options: question.options.map((option) => ({ ...option, score: (option.score - 1) * 10 }))
  }));
  const results = calculateAssessmentResults(questions, selectedOptions(questions, 0));
  assert.equal(results.overtimeScore, 1);
  assert.equal(results.projectScore, 1);
  assert.equal(results.wlbScore, 2);
});

test('required answers, response IDs, and scoring weights are validated', () => {
  const questions = createDefaultQuestions();
  const answers = selectedOptions(questions, 3);
  delete answers.q1;
  assert.throws(() => calculateAssessmentResults(questions, answers), /q1 is required/i);

  answers.q1 = 'not-an-option';
  assert.throws(() => calculateAssessmentResults(questions, answers), /invalid response option/i);
  assert.throws(() => validateScoringWeights({ overtime: 10, project: 10, workLifeBalanceRisk: 10, additionalAssessmentRisk: 10 }), /total 100/i);
});

test('publishing rejects removed, duplicated, or mis-sectioned default questions', () => {
  const questions = createDefaultQuestions();
  assert.throws(() => validateAssessmentQuestions(questions.slice(1), { requireComplete: true }), /exactly 20/i);
  const duplicated = [...questions];
  duplicated[1] = { ...duplicated[1], id: duplicated[0].id };
  assert.throws(() => validateAssessmentQuestions(duplicated, { requireComplete: true }), /duplicated/i);
  const wrongSection = questions.map((question) => question.id === 'q8' ? { ...question, section: 'Additional Burnout Assessment' } : question);
  assert.throws(() => validateAssessmentQuestions(wrongSection, { requireComplete: true }), /must belong/i);
});
