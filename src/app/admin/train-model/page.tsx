import { desc } from "drizzle-orm";
import Link from "next/link";
import { hasAdminSession } from "@/lib/admin-auth";
import { getDb } from "@/lib/db";
import { referenceExamples } from "@/lib/db/schema";
import { TrainingForm } from "./TrainingForm";

export default async function TrainModelPage() {
  const isAdmin = await hasAdminSession();
  if (!isAdmin) return <main className="shell"><section className="card panel access-card"><span className="tag">مساحة المالك المحمية</span><h1>تدريب النموذج المرجعي</h1><p>افتح جلسة الإدارة باستخدام ADMIN_SECRET قبل إضافة أمثلة موثّقة.</p><Link className="btn" href="/admin/codes">فتح الإدارة</Link></section></main>;
  const db = getDb();
  const examples = db ? await db.select().from(referenceExamples).orderBy(desc(referenceExamples.createdAt)).limit(12) : [];
  return <main className="shell"><nav className="nav"><Link className="brand" href="/solver">بِبراس <b>× كانجارو</b></Link><div className="nav-links"><Link href="/solver">المحلل البصري الفوري</Link><Link className="active" href="/admin/train-model">تدريب النموذج</Link><Link href="/admin/codes">أكواد الدخول</Link></div></nav><section className="hero compact"><span className="eyebrow">Few-shot reference vault</span><h1>علّم النموذج من حلولك الموثّقة.</h1><p>كل مثال محفوظ يصبح مرجعًا ذكيًا يضيف قواعد نمطه إلى طلبات Gemini القادمة.</p></section><div className="training-layout"><section className="card panel"><h2>إضافة مثال مرجعي</h2><p className="muted">راجع الاستراتيجية والـ JSON قبل الحفظ؛ هذه الأمثلة تتحكم في أسلوب الحل.</p><TrainingForm /></section><aside className="card panel"><div className="section-heading"><h2>الأمثلة المحفوظة</h2><span className="tag">{examples.length}</span></div>{examples.length ? <div className="reference-list">{examples.map((example) => <article key={example.id} className="reference-item">{example.thumbnailBase64 && <img src={example.thumbnailBase64} alt="صورة مرجعية" />}<div><small>{example.competition} · {example.category}</small><h3>{example.puzzlePatternDescription}</h3><p>{example.solvingStrategy}</p></div></article>)}</div> : <p className="muted">لا توجد أمثلة بعد. أضف أول لغز محلول لتبدأ ذاكرة النموذج المرجعية.</p>}</aside></div></main>;
}
