import type { Language } from '../explain';

// Every LLM response must pass these checks or the fixed template is used.
// Rules: short (<120 words), requested language, says what the result means
// AND what it does not mean, says a professional should confirm, and never
// uses diagnosis-style or treatment wording.

const NOT_DIAGNOSIS: Record<Language, RegExp> = {
  en: /not a diagnosis/i,
  ar: /ليس تشخيص/,
  hi: /निदान नहीं/,
};

const MEANS: Record<Language, RegExp> = {
  en: /symptom|level|suggest|score|result/i,
  ar: /أعراض|مستوى|تشير|نتيجة/,
  hi: /लक्षण|स्तर|बताते|परिणाम/,
};

const PROFESSIONAL: Record<Language, RegExp> = {
  en: /professional|clinician|doctor|health.?care provider|specialist|therapist|counselor|psychiatrist/i,
  ar: /مختص|طبيب|أخصائي|معالج|مقدم رعاية/,
  hi: /पेशेवर|चिकित्सक|डॉक्टर|विशेषज्ञ|मनोचिकित्सक|काउंसलर/,
};

const CONFIRM: Record<Language, RegExp> = {
  en: /confirm|assess|evaluate|review|understand|consult|talk|speak|discuss/i,
  ar: /يؤكد|تأكيد|يقيّم|تقييم|استشارة|استشر|راجع|يفهم|فهم/,
  hi: /पुष्टि|आकलन|मूल्यांकन|समझ|परामर्श|बात|जाँच/,
};

// Diagnosis-style wording: labels, named disorders, "you have / you are X".
const DIAGNOSIS: Record<Language, RegExp> = {
  en: /\b(you have|you've|you are suffering from|you suffer from|diagnosed with|you are depressed|you are anxious|you are bipolar|depression|depressive|bipolar|schizophrenia|schizoaffective|ptsd|ocd|adhd|anorexia|bulimia|psychosis|psychotic|panic disorder|anxiety disorder|social anxiety|generalized anxiety|obsessive[- ]compulsive|post[- ]traumatic|borderline personality|eating disorder|autism|autistic|dementia|alzheimer|addiction|substance use disorder)\b/i,
  ar: /أنت مصاب|أنك مصاب|تعاني من|تم تشخيصك|تشخيصك هو|لديك اكتئاب|أنت مكتئب|أنت قلق|اكتئاب|ثنائي القطب|فصام|وسواس قهري|ما بعد الصدمة|اضطراب القلق|اضطراب الأكل|ذهان|إدمان/,
  hi: /आपको अवसाद|आप अवसाद|से ग्रस्त|आपका निदान|निदान किया गया|आप उदास हैं|आप चिंतित हैं|अवसाद|द्विध्रुवीय|सिज़ोफ्रेनिया|सिजोफ्रेनिया|पीटीएसडी|ओसीडी|चिंता विकार|खाने का विकार|मनोविकृति|व्यसन|नशा/,
};

// Medication names, doses, and any advice to start/stop/change treatment.
const TREATMENT: Record<Language, RegExp> = {
  en: /\b(mg|milligrams?|dose|dosage|medications?|medicine|antidepressants?|prescrib\w*|sertraline|fluoxetine|paroxetine|citalopram|escitalopram|fluvoxamine|venlafaxine|duloxetine|bupropion|mirtazapine|amitriptyline|nortriptyline|imipramine|clomipramine|lithium|lamotrigine|valproate|carbamazepine|quetiapine|olanzapine|risperidone|aripiprazole|clozapine|haloperidol|alprazolam|clonazepam|lorazepam|diazepam|buspirone|hydroxyzine|propranolol|zolpidem|eszopiclone|prozac|zoloft|lexapro|paxil|celexa|effexor|cymbalta|wellbutrin|remeron|elavil|xanax|valium|ativan|klonopin|seroquel|zyprexa|risperdal|abilify|lamictal|depakote|tegretol|ambien|lunesta|adderall|vyvanse|ritalin|concerta|strattera)\b/i,
  ar: /دواء|أدوية|ملغ|مليغرام|مليجرام|جرعة|سيرترالين|فلوكستين|بروزاك|زولوفت|زانكس|ديازيبام|لورازيبام|مضاد للاكتئاب|ليثيوم/,
  hi: /दवा|दवाइ|मिलीग्राम|खुराक|सेर्ट्रालिन|फ्लुओक्सेटीन|प्रोज़ैक|ज़ोलोफ्ट|ज़ानैक्स|डायजेपाम|एंटीडिप्रेसेंट|लिथियम/,
};

const TREATMENT_CHANGE: Record<Language, RegExp> = {
  en: /\b(stop|quit|discontinue|skip|double|halve|increase|decrease|reduce|adjust|change|taper|start|begin|try)\b[^.!?]*\b(medication|medicine|meds|dose|dosage|treatment|therapy|pills?|antidepressants?)\b/i,
  ar: /أوقف|توقف عن تناول|غيّر الجرعة|غير الجرعة|زد الجرعة|خفف الجرعة|عدّل الجرعة|ابدأ العلاج|أوقف العلاج|غيّر العلاج|غير العلاج/,
  hi: /दवा बंद|दवा बदल|दवा शुरू|दवा लेनी|दवा लें|खुराक बढ़ा|खुराक घटा|खुराक बदल|इलाज बंद|इलाज बदल|इलाज शुरू/,
};

// Negated spans ("this does not mean you have ...") are safe and stripped
// before the diagnosis/treatment checks so reassurance is not rejected.
const NEGATED: Record<Language, RegExp> = {
  en: /\b(?:does not|doesn't|do not|don't|cannot|can't|never|not|isn't|is not)\s+(?:mean|means|meaning|say|saying|imply|implies|prove|confirm|indicate|tell you|diagnose)\b[^.!?]*/gi,
  ar: /(?:لا|ليس|لم|لن)\s+(?:يعني|تشير|يثبت|يؤكد)\s[^.!?،]*/g,
  hi: /(?:नहीं|मत)[^.!?।]*/g,
};

const ARABIC = /[؀-ۿ]/g;
const DEVANAGARI = /[ऀ-ॿ]/g;

function scriptRatio(text: string, re: RegExp): number {
  const letters = text.match(/\p{L}/gu)?.length ?? 0;
  if (letters === 0) return 0;
  return (text.match(re)?.length ?? 0) / letters;
}

export function validateExplanation(text: unknown, language: Language): text is string {
  if (typeof text !== 'string') return false;
  const t = text.trim();
  if (!t) return false;
  const words = t.split(/\s+/).length;
  if (words < 10 || words >= 120) return false;

  if (language === 'ar' && scriptRatio(t, ARABIC) < 0.5) return false;
  if (language === 'hi' && scriptRatio(t, DEVANAGARI) < 0.5) return false;
  if (language === 'en' && (/[؀-ۿ]/.test(t) || /[ऀ-ॿ]/.test(t) || scriptRatio(t, /[A-Za-z]/g) < 0.5)) {
    return false;
  }

  if (!NOT_DIAGNOSIS[language].test(t)) return false;
  if (!MEANS[language].test(t)) return false;
  if (!PROFESSIONAL[language].test(t) || !CONFIRM[language].test(t)) return false;

  const stripped = t.replace(NEGATED[language], ' ');
  if (DIAGNOSIS[language].test(stripped)) return false;
  if (TREATMENT[language].test(stripped)) return false;
  if (TREATMENT_CHANGE[language].test(stripped)) return false;
  return true;
}