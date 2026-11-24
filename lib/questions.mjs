// Edit this file to change the session title and questions for each PLT.
// Question types:
//   mcq       - multiple choice. Add `correct: <index>` for a knowledge question; omit it for an opinion poll.
//   rating    - 1 to 5 scale (good for before/after confidence).
//   wordcloud - short answer of one or two words, shown as a word cloud.
//   text      - free-text answer, shown as cards and themed by the AI summary.

export const SESSION = {
  title: "QOF 2026/27: Obesity in Primary Care",
  subtitle: "SAFECARE Protected Learning Time · Test session",
};

export const QUESTIONS = [
  {
    id: "q1",
    type: "wordcloud",
    text: "In one word: how do you feel about obesity returning to QOF in 2026/27?",
  },
  {
    id: "q2",
    type: "rating",
    text: "Before we start: how confident are you about delivering the new obesity QOF indicators?",
    labels: ["Not at all", "Very confident"],
  },
  {
    id: "q3",
    type: "mcq",
    text: "OB004: what BMI threshold applies to adults from a South Asian, Chinese, other Asian, Middle Eastern, Black African or African-Caribbean family background?",
    options: ["25 or more", "27.5 or more", "30 or more", "32.5 or more"],
    correct: 1,
  },
  {
    id: "q4",
    type: "mcq",
    text: "OB004: within how many days of the qualifying BMI must the referral to a weight management programme be made?",
    options: ["30 days", "60 days", "90 days", "180 days"],
    correct: 2,
  },
  {
    id: "q5",
    type: "mcq",
    text: "Which obesity indicator is worth more QOF points in 2026/27?",
    options: [
      "OB004 – weight management referral",
      "OB005 – shared decision-making and pharmacotherapy offer",
      "They are worth the same",
    ],
    correct: 1,
  },
  {
    id: "q6",
    type: "mcq",
    text: "How is your practice planning to deliver weight-loss medicine prescribing?",
    options: ["GP-led clinics", "Clinical pharmacist / ARRS-led", "PCN or federation hub", "Not decided yet"],
  },
  {
    id: "q7",
    type: "text",
    text: "What is the biggest barrier to delivering obesity QOF work in your practice?",
  },
  {
    id: "q8",
    type: "rating",
    text: "After this session: how confident do you feel now?",
    labels: ["Not at all", "Very confident"],
  },
];

export function publicQuestion(q, revealed) {
  if (!q) return null;
  const { correct, ...rest } = q;
  return revealed && correct !== undefined ? { ...rest, correct } : { ...rest, hasAnswer: correct !== undefined };
}
