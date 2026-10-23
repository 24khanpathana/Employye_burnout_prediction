from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer

analyzer = SentimentIntensityAnalyzer()


def analyze_sentiment_text(text):
    if text is None or not str(text).strip():
        return 0.0, 'NEUTRAL'

    result = analyzer.polarity_scores(str(text))
    compound = result.get('compound', 0.0)
    if compound > 0.05:
        label = 'POSITIVE'
    elif compound < -0.05:
        label = 'NEGATIVE'
    else:
        label = 'NEUTRAL'
    return float(compound), label


def average_sentiment(scores):
    if not scores:
        return 0.0, 'NEUTRAL'
    avg = sum(scores) / len(scores)
    if avg > 0.05:
        label = 'POSITIVE'
    elif avg < -0.05:
        label = 'NEGATIVE'
    else:
        label = 'NEUTRAL'
    return float(avg), label
