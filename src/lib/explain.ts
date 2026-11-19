export type Language = 'en' | 'ar' | 'hi';
export type Instrument = 'PHQ9' | 'GAD7';

export interface ExplainInput {
  instrument: Instrument;
  total: number;
  band: string;
  language: Language;
}

export interface Explanation {
  text: string;
  source: 'llm' | 'template';
}

const INSTRUMENT_NAME: Record<Language, Record<Instrument, string>> = {
  en: { PHQ9: 'mood questionnaire (PHQ-9)', GAD7: 'anxiety questionnaire (GAD-7)' },
  ar: { PHQ9: 'استبيان المزاج (PHQ-9)', GAD7: 'استبيان القلق (GAD-7)' },
  hi: { PHQ9: 'मूड प्रश्नावली (PHQ-9)', GAD7: 'चिंता प्रश्नावली (GAD-7)' },
};

// Deterministic, kind, plain-language templates. They never diagnose and
// always pair what the result means with what it does not mean.
const TEMPLATES: Record<Language, Record<string, string>> = {
  en: {
    minimal:
      'Your answers on the {instrument} suggest very few symptoms right now. That is reassuring. This is a screening, not a diagnosis — it cannot rule everything out. Keep doing what supports you, and consider checking in again in about 30 days.',
    mild:
      'Your answers on the {instrument} suggest some mild symptoms. Many people feel this way at times, and gentle support often helps. This is a screening, not a diagnosis. Self-help resources and community support are good next steps, with a check-in in about 14 days.',
    moderate:
      'Your answers on the {instrument} suggest a moderate level of symptoms. You do not have to manage this alone — talking with a primary-care clinician or a tele-mental-health professional is a reasonable next step. This is a screening, not a diagnosis; a professional can understand your situation fully.',
    moderately_severe:
      'Your answers on the {instrument} suggest a fairly high level of symptoms. Please consider reaching out for professional support soon — a human navigator can help you arrange it within 24 hours. This is a screening, not a diagnosis, and it is not a judgment about you. Support works, and you deserve it.',
    severe:
      'Your answers on the {instrument} suggest a high level of symptoms. You deserve prompt, human support — a navigator can contact you within 24 hours to help arrange specialist or tele-mental-health care. This is a screening, not a diagnosis. Whatever you are carrying, you do not have to carry it alone.',
    crisis:
      'Some of your answers suggest you may be having thoughts of harming yourself. Please talk to a human right now — you matter, and help is available. This is a screening, not a diagnosis, and no decision about you is made by a computer. Use the emergency guidance on this page or press “Talk to a human now”.',
  },
  ar: {
    minimal:
      'إجاباتك على {instrument} تشير إلى أعراض قليلة جدًا في الوقت الحالي، وهذا مطمئن. هذا فحص استرشادي وليس تشخيصًا، ولا يمكنه استبعاد كل شيء. استمر في ما يدعمك، وفكّر في إعادة الفحص بعد حوالي ٣٠ يومًا.',
    mild:
      'إجاباتك على {instrument} تشير إلى بعض الأعراض الخفيفة. كثير من الناس يمرون بمثل هذا الشعور، والدعم البسيط غالبًا ما يساعد. هذا فحص استرشادي وليس تشخيصًا. موارد المساعدة الذاتية والدعم المجتمعي خطوات مناسبة تالية، مع متابعة بعد حوالي ١٤ يومًا.',
    moderate:
      'إجاباتك على {instrument} تشير إلى مستوى متوسط من الأعراض. لست مضطرًا للتعامل مع هذا وحدك — التحدث مع طبيب رعاية أولية أو أخصائي صحة نفسية عن بُعد خطوة مناسبة. هذا فحص استرشادي وليس تشخيصًا؛ المختص يستطيع فهم حالتك بالكامل.',
    moderately_severe:
      'إجاباتك على {instrument} تشير إلى مستوى مرتفع نسبيًا من الأعراض. نرجو أن تفكر في طلب دعم مختص قريبًا — يمكن لميسّر الرعاية البشري مساعدتك في ترتيب ذلك خلال ٢٤ ساعة. هذا فحص استرشادي وليس تشخيصًا، وليس حكمًا عليك. الدعم فعّال، وأنت تستحقه.',
    severe:
      'إجاباتك على {instrument} تشير إلى مستوى مرتفع من الأعراض. أنت تستحق دعمًا بشريًا سريعًا — يمكن لميسّر الرعاية التواصل معك خلال ٢٤ ساعة للمساعدة في ترتيب رعاية مختصة أو عن بُعد. هذا فحص استرشادي وليس تشخيصًا. مهما كان ما تحمله، لست مضطرًا لحمله وحدك.',
    crisis:
      'بعض إجاباتك تشير إلى أنك قد تراودك أفكار بإيذاء نفسك. نرجو أن تتحدث إلى إنسان الآن — أنت مهم، والمساعدة متاحة. هذا فحص استرشادي وليس تشخيصًا، ولا يتخذ أي حاسوب قرارًا بشأنك. استخدم إرشادات الطوارئ في هذه الصفحة أو اضغط «تحدث إلى إنسان الآن».',
  },
  hi: {
    minimal:
      '{instrument} पर आपके उत्तर बताते हैं कि अभी बहुत कम लक्षण हैं। यह राहत की बात है। यह एक स्क्रीनिंग है, निदान नहीं — यह सब कुछ खारिज नहीं कर सकती। जो चीज़ें आपको सहारा देती हैं वे जारी रखें, और लगभग ३० दिनों में दोबारा जाँच करने पर विचार करें।',
    mild:
      '{instrument} पर आपके उत्तर कुछ हल्के लक्षण बताते हैं। कई लोग कभी-कभी ऐसा महसूस करते हैं, और हल्का सहयोग अक्सर मदद करता है। यह एक स्क्रीनिंग है, निदान नहीं। स्व-सहायता संसाधन और सामुदायिक सहयोग अच्छे अगले कदम हैं, लगभग १४ दिनों में दोबारा जाँच के साथ।',
    moderate:
      '{instrument} पर आपके उत्तर मध्यम स्तर के लक्षण बताते हैं। आपको यह अकेले नहीं संभालना है — प्राथमिक देखभाल चिकित्सक या टेली-मानसिक स्वास्थ्य पेशेवर से बात करना उचित अगला कदम है। यह एक स्क्रीनिंग है, निदान नहीं; कोई पेशेवर आपकी स्थिति को पूरी तरह समझ सकता है।',
    moderately_severe:
      '{instrument} पर आपके उत्तर काफी अधिक लक्षण बताते हैं। कृपया जल्द पेशेवर सहयोग लेने पर विचार करें — एक मानव नेविगेटर २४ घंटे के भीतर इसकी व्यवस्था में मदद कर सकता है। यह एक स्क्रीनिंग है, निदान नहीं, और आपके बारे में कोई फैसला नहीं। सहयोग काम करता है, और आप इसके हकदार हैं।',
    severe:
      '{instrument} पर आपके उत्तर उच्च स्तर के लक्षण बताते हैं। आप तुरंत मानवीय सहयोग के हकदार हैं — एक नेविगेटर २४ घंटे के भीतर आपसे संपर्क करके विशेषज्ञ या टेली-मानसिक स्वास्थ्य देखभाल की व्यवस्था में मदद कर सकता है। यह एक स्क्रीनिंग है, निदान नहीं। आप जो भी बोझ उठाए हुए हैं, उसे अकेले उठाना ज़रूरी नहीं।',
    crisis:
      'आपके कुछ उत्तर बताते हैं कि आपके मन में स्वयं को नुकसान पहुँचाने के विचार आ सकते हैं। कृपया अभी किसी इंसान से बात करें — आप महत्वपूर्ण हैं, और मदद उपलब्ध है। यह एक स्क्रीनिंग है, निदान नहीं, और कोई कंप्यूटर आपके बारे में फैसला नहीं लेता। इस पृष्ठ पर आपातकालीन मार्गदर्शन देखें या “अभी किसी इंसान से बात करें” दबाएँ।',
  },
};

export function explainTemplate(input: ExplainInput): string {
  const lang = TEMPLATES[input.language] ? input.language : 'en';
  const template = TEMPLATES[lang][input.band] ?? TEMPLATES[lang].moderate;
  return template.replace('{instrument}', INSTRUMENT_NAME[lang][input.instrument]);
}