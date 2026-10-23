export const calculateMCQScore = (answers, correctAnswers) => {
  const submissionKeys = Object.keys(answers || {});
  let correct = 0;

  for (const key of submissionKeys) {
    if ((answers[key] || '').toString() === (correctAnswers[key] || '').toString()) {
      correct += 1;
    }
  }

  const total = Math.max(submissionKeys.length || 1, 1);
  return Number(((correct / total) * 100).toFixed(2));
};

export const calculateRatingAverage = (ratings = []) => {
  if (ratings.length === 0) return 0;
  const total = ratings.reduce((sum, item) => sum + Number(item || 0), 0);
  return Number((total / ratings.length).toFixed(2));
};

export const computeSentimentScore = (text = '') => {
  const cleaned = String(text).trim().toLowerCase();
  if (!cleaned) return 0;
  const positives = ['good', 'great', 'happy', 'satisfied', 'excellent', 'supportive', 'productive'];
  const negatives = ['bad', 'stress', 'burnout', 'overloaded', 'tired', 'frustrated', 'angry', 'unhappy'];
  let score = 0;

  for (const word of positives) {
    score += cleaned.split(word).length - 1;
  }

  for (const word of negatives) {
    score -= cleaned.split(word).length - 1;
  }

  return Number(Math.max(-1, Math.min(1, score / 5)).toFixed(2));
};

export const overallTestScore = ({ mcqScore = 0, ratingAverage = 0, sentimentScore = 0 }) => {
  const weighted = (Number(mcqScore) * 0.5) + (Number(ratingAverage) * 10 * 0.3) + (Number(sentimentScore) * 50 * 0.2);
  return Number(Math.max(0, Math.min(100, weighted)).toFixed(2));
};
