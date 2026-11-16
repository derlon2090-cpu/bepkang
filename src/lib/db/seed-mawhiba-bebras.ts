import dotenv from "dotenv";
import { createHash } from "node:crypto";
import { closeDb, getDb } from ".";
import { embedText } from "../ai/reference-memory";
import { PLAYBOOK } from "../ai/competition-playbook";
import { referenceExamples, type VisualSolutionRecord } from "./schema";
dotenv.config({ path: ".env.local" });

type Task = { id: string; title: string; category: string; archetype: keyof typeof PLAYBOOK; answer: string; strategy: string; trap: string };

const tasks: Task[] = [
  { id: "1-1", title: "القلائد", category: "العد والتجريد", archetype: "SET_DIFFERENCE_ABSTRACTION", answer: "أ", strategy: "اطرح الخرز المتبقي على خيطَي نورة وسارة من العدد الأصلي: 3 مربعات صفراء و3 مثلثات حمراء مفقودة، أي 6 خرزات لأصيل.", trap: "افصل اللون عن الشكل ولا تعدّ الخرز الظاهر بدل المفقود." },
  { id: "1-2", title: "العصي", category: "الترتيب والخوارزميات", archetype: "TOPOLOGICAL_SORT_STACK_LIFO", answer: "ج", strategy: "حدّد العصا التي لا توجد فوقها أي عصا، ثم أزلها وكرر العملية من الأعلى إلى الأسفل.", trap: "لا تبدأ بعصا محجوبة بعصا أخرى." },
  { id: "1-3", title: "ترتيب القمصان", category: "الحساب الدوري", archetype: "MODULO_ARITHMETIC", answer: "ب (الدرج الثاني)", strategy: "تتوزع 6 قمصان دوريًا على 4 أدراج، لذا 6 mod 4 = 2، أي الدرج الثاني من الأعلى.", trap: "انتبه إلى أن المواقع مرقمة بدءًا من واحد." },
  { id: "1-4", title: "رسالة من القنادس الأجداد", category: "التشفير", archetype: "GRID_COORDINATE_CIPHER", answer: "LOVEWATER", strategy: "طابق كل زوج من الرموز مع مؤشر الصف والعمود في كتل الحروف 3×3.", trap: "لا تعكس ترتيب رمز الصف ورمز العمود." },
  { id: "1-5", title: "سوار من النجوم والأقمار", category: "الأنماط", archetype: "LOOP_INVARIANTS_ADJACENCY", answer: "ج", strategy: "النمط (نجمة-قمر) يتكرر 3 مرات ثم تضاف نجمتان؛ لذلك لا يمكن ظهور 3 أقمار متجاورة، وهو ما تعرضه ج.", trap: "افحص التجاور الدائري عند طرفي السوار." },
  { id: "1-6", title: "لوحة بيبراس", category: "تحولات الحالة", archetype: "STATE_TRANSITION_PIXEL_MAPPING", answer: "د", strategy: "استنتج قاعدة الاستبدال الدوري للأشكال من لوحة قبل/بعد ثم طبّقها على كل خلية في اللوحة المطلوبة.", trap: "لا تغيّر مواضع الخلايا عندما تكون القاعدة استبدالًا للرموز." },
  { id: "1-7", title: "الري", category: "المنطق والتدفق", archetype: "BOOLEAN_LOGIC_FLOW_NETWORK", answer: "ب (الزهرة الوسطى)", strategy: "تتبّع الماء بالجاذبية من الخزانات المفتوحة فقط عبر الصمامات الحمراء الرأسية أو الأفقية المفتوحة.", trap: "الصمام المغلق أو العمودي على اتجاه المسار يمنع الماء." },
  { id: "1-8", title: "الأرقام", category: "الترميز", archetype: "BINARY_BITMASK_ENCODING", answer: "423958", strategy: "طابق الخلايا الحمراء النشطة في الأعمدة A إلى G مع تخطيطات الأرقام القياسية ذات القطاعات السبعة.", trap: "اقرأ كل رقم من مواضع قطاعاته لا من عدد الخلايا فقط." },
  { id: "1-9", title: "الصواميل والمسامير", category: "المكدسات", archetype: "BALANCED_PARENTHESES_STACK", answer: "ج", strategy: "عامل الصامولة كقوس فتح يدفع إلى السلة والمسمار كقوس غلق يسحب منها؛ كل بادئة تحتاج صواميل لا تقل عن المسامير والإجمالي 5 و5.", trap: "تساوي العدد النهائي وحده لا يثبت سلامة الترتيب." },
  { id: "1-10", title: "الجيران", category: "الرسوم البيانية", archetype: "GRAPH_DEGREE_ADJACENCY", answer: "4", strategy: "العقد ذات الدرجة 4 هي 4 و5 و7. نواف درجته 2 ومتصل بزينب وباسم، فيلزم أن يكون 6، وتبقى مريم = 4.", trap: "احسب الجيران الحقيقيين فقط ولا تعتمد على شكل الرسم." },
  { id: "2-1", title: "نمل في المستنقع", category: "التدفق والشبكات", archetype: "MAX_FLOW_TIME_EXPANDED_GRAPH", answer: "7 نملات", strategy: "كل جسر قشي سعته نملة واحدة/دقيقة. عدّ المسارات المنفصلة خلال 3 دقائق: أ-ب-و، أ-ج-و، وأ-د-هـ-و، فيكون المجموع 7.", trap: "لا تتجاوز سعة أي جسر في الدقيقة الواحدة." },
  { id: "2-2", title: "في خطر", category: "البرمجة الديناميكية", archetype: "BOTTOM_UP_DYNAMIC_PROGRAMMING", answer: "8 كرات", strategy: "كرات الصف السفلي آمنة. تحرك للأعلى: الكرة في خطر إن كان موضع أسفل-يسار أو أسفل-يمين فارغًا أو في خطر.", trap: "احسب الصفوف من الأسفل قبل استخدام نتيجتها." },
  { id: "2-3", title: "ملكة جمال إنفينيتي", category: "انتشار الشبكات", archetype: "GRAPH_THRESHOLD_DIFFUSION", answer: "يوم الجمعة", strategy: "الاثنين A,D,I؛ الثلاثاء G,C؛ الأربعاء B؛ الخميس E؛ والجمعة H,F، فتتنشط الطالبات التسع.", trap: "حدّث كل يوم بالتزامن من حالة اليوم السابق." },
  { id: "2-4", title: "ذات الرداء الأحمر", category: "مسارات الشبكة", archetype: "GRID_DYNAMIC_PROGRAMMING_MAX_PATH", answer: "41", strategy: "مع حركتي اليمين والأسفل فقط، احسب dp[r][c] = قيمة الخلية + أكبر قيمة من أعلى أو يسار حتى تصل للنهاية.", trap: "لا تستخدم حركة قطرية أو صعودًا." },
  { id: "2-5", title: "شبكة القنادس", category: "شبكات المقارنات", archetype: "COMPARATOR_NETWORK_REVERSE_ROUTING", answer: "ر ر ر ب ب ب أو ر ر ب ر ب ب", strategy: "عند التقاطع يتجه البني يمينًا والرمادي يسارًا؛ تتبع المخرج ر ب ر ب ر ب إلى الخلف لتقييد زوجي المدخلات الطرفيين.", trap: "لا تفترض أن ترتيب الألوان يبقى كما هو بعد التقاطعات." },
  { id: "2-6", title: "الجواسيس", category: "انتشار المعلومات", archetype: "PAIRWISE_INFORMATION_DISSEMINATION", answer: "4 جولات", strategy: "مع خمسة جواسيس، يجلس واحد في الجولة الأولى؛ نحتاج ثلاث جولات إضافية لانتشار سره إلى الأربعة الآخرين وفق 1 ثم 2 ثم 4 ثم 5.", trap: "لا يمكن للجاسوس أن يقابل أكثر من واحد في الجولة." },
  { id: "2-7", title: "المتحف", category: "الرسوم البيانية", archetype: "HAMILTONIAN_PATH", answer: "ج", strategy: "الغرف ذات الممر الواحد لا تسمح بزيارة وسطية. المسار الصحيح: مدخل ← 2 ← 1 ← 3 ← 4 ← 7 ← 6 ← 5 ← مخرج.", trap: "المطلوب زيارة كل غرفة مرة واحدة، لا زيارة كل ممر." },
  { id: "2-8", title: "مسارات الطيران", category: "الرسوم البيانية", archetype: "MINIMUM_SPANNING_TREE", answer: "8 مسارات", strategy: "يوجد 8 مدن و15 مسارًا. شبكة متصلة بأقل حواف تحتاج V-1 = 7 مسارات، لذا يُلغى 15-7 = 8.", trap: "لا تحذف مسارًا يعزل مدينة عن الشبكة." },
  { id: "2-9", title: "شراء الأحذية", category: "البحث", archetype: "TWO_DIMENSIONAL_SEARCH", answer: "2", strategy: "ابدأ بالحذاء الأوسط (5) في شبكة 3×3 مرتبة؛ نتيجة المقارنة تستبعد نطاقات صفوف وأعمدة وتبقي منطقة يكفيها فحص أوسط واحد.", trap: "استفد من ترتيب العرض والطول معًا." },
  { id: "2-10", title: "الدوال", category: "الدوال والتبديلات", archetype: "FUNCTION_COMPOSITION_PERMUTATION", answer: "[e, b, c, d, a]", strategy: "omar يبدّل الأول والأخير وahmed يعكس القائمة. shaker = omar(ahmed(omar(x))) = ahmed(x)، ومنه test(x) = omar(x).", trap: "طبّق الدوال من الداخل إلى الخارج وسجّل القائمة بعد كل خطوة." },
];

function record(task: Task): VisualSolutionRecord {
  return { steps: [{ stepNumber: 1, actionBadge: "حلّل", instruction: task.strategy, stateAfterMove: "الإجابة الرسمية: " + task.answer, annotationType: "HIGHLIGHT_BOX", color: "#2563eb" }], socraticHints: ["ما القاعدة أو البنية الحاسوبية الظاهرة؟", "كيف تحوّلها إلى خطوات قابلة للتحقق؟", "تحقق من القيود قبل اختيار الإجابة."], metadata: { source: "Mawhiba Saudi Bebras activity book", taskId: task.id, title: task.title, officialAnswer: task.answer } };
}

export async function seedMawhibaBebras() {
  const db = getDb();
  if (!db) throw new Error("DATABASE_URL مطلوب لتشغيل بذر مراجع موهبة.");
  for (const task of tasks) {
    const signature = "BEBRAS | موهبة | " + task.id + " " + task.title + " | " + task.archetype + " | " + task.strategy;
    const imageHash = createHash("sha256").update("mawhiba-bebras-" + task.id).digest("hex");
    const embedding = await embedText(signature);
    const values = { competition: "BEBRAS" as const, category: task.category, puzzlePatternDescription: task.title + ": " + task.archetype, solvingStrategy: task.strategy + " الإجابة الرسمية: " + task.answer + ".", verifiedStepsJson: record(task), archetype: task.archetype, structuralSignature: signature, trapWarning: task.trap, imageHash, embedding: embedding ?? undefined };
    await db.insert(referenceExamples).values(values).onConflictDoUpdate({ target: referenceExamples.imageHash, set: values });
    console.log("تمت مزامنة " + task.id + ": " + task.title);
  }
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("src/lib/db/seed-mawhiba-bebras.ts")) {
  seedMawhibaBebras().then(async () => { await closeDb(); console.log("تمت مزامنة " + tasks.length + " مهمة موهبة بيبراس."); }).catch(async (error) => { await closeDb(); console.error(error); process.exitCode = 1; });
}
