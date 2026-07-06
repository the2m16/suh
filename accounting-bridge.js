// ============================================================
// accounting-bridge.js — suh.html-ийн санхүүгийн урсгалыг Supabase-ийн
// нягтлан бодох бүртгэлийн backend-тэй (chart_of_accounts/journal_entries/
// journal_lines + create_journal_entry() RPC) холбоно.
// ============================================================
// АРХИТЕКТУР: Энэ файл нь ЗӨВХӨН Дт/Кт мөрүүдийг угсарч
// sb.rpc('create_journal_entry', ...)-г дуудна. Балансын шалгалт, дансны
// код зөв эсэх зэрэг БҮХ баталгаажуулалт Postgres талд (create_journal_entry
// RPC дотор) хийгддэг тул энд дахин давхардуулаагүй.
//
// ЧУХАЛ ЗАРЧИМ: Энэ hook-ууд нь ОДОО байгаа transactions/businesses
// урсгалыг ОГТ ӨӨРЧЛӨХГҮЙ — зөвхөн ТЭДНИЙ ХАЖУУГААР нэмэлт journal entry
// үүсгэдэг ("instrumentation"). Хэрэв journal entry үүсгэхэд алдаа гарвал
// (жишээ нь сүлжээ тасрах), ГОЛ гүйлгээ (transactions insert) саадгүй
// үргэлжилнэ — зөвхөн toast анхааруулга гарна. Ингэснээр аккруэл системийн
// алдаа өдөр тутмын ажлыг зогсоохгүй.
// ============================================================

async function db_createJournalEntry(date, description, reference, lines) {
  const { data, error } = await sb.rpc('create_journal_entry', {
    p_date: date, p_description: description, p_reference: reference, p_lines: lines,
  });
  if (error) {
    console.error('Journal entry алдаа:', error.message, { date, description, reference, lines });
    return { success: false, error: error.message };
  }
  return { success: true, entryId: data };
}

async function db_getPartyBalance(account, party) {
  const { data, error } = await sb.rpc('get_party_balance', { p_account: account, p_party: party });
  if (error) { console.error('get_party_balance алдаа:', error.message); return 0; }
  return +data || 0;
}

// ------------------------------------------------------------
// САР БҮРИЙН АККРУЭЛ (нэхэмжлэх) — админ товч дараад дуудна.
// Аль хэдийн энэ сард нэхэмжилсэн эсэхийг reference-ээр шалгаж, ДАВХАРДУУЛАХГҮЙ.
// ------------------------------------------------------------
async function accountingCheckAlreadyAccrued(yearMonth) {
  const { data, error } = await sb.from('journal_entries').select('id').ilike('reference', `accrual:%:${yearMonth}`).limit(1);
  if (error) { console.error(error); return false; }
  return data && data.length > 0;
}

async function runMonthlyAccrual() {
  if (!canWrite('transactions')) { toast('Танд энэ үйлдлийг хийх эрх байхгүй байна', 'error'); return; }
  const yearMonth = `${CUR_YEAR}-${String(CUR_MONTH).padStart(2, '0')}`;
  if (await accountingCheckAlreadyAccrued(yearMonth)) {
    toast(`${yearMonth} сар аль хэдийн нэхэмжлэгдсэн байна — дахин хийхгүй`, 'error');
    return;
  }
  if (!confirm(`${yearMonth} сарын хураамж/түрээсийг ${residents.length} өмчлөгч, ${businesses.length} аж ахуйн нэгжид нэхэмжлэх үү?\n(Энэ үйлдлийг буцаах боломжгүй тул анхаарна уу.)`)) return;

  let succeeded = 0, failed = 0;
  for (const r of residents) {
    const amount = calcFee(residentSqm(r));
    if (!amount) continue;
    const res = await db_createJournalEntry(
      `${yearMonth}-01`, `${r.apt} тоот — ${yearMonth} сарын хураамж нэхэмжлэв`,
      `accrual:resident:${r.apt}:${yearMonth}`,
      [{ account: '1110', debit: amount, credit: 0, party: 'resident:' + r.apt },
       { account: '5100', debit: 0, credit: amount }]
    );
    res.success ? succeeded++ : failed++;
  }
  for (const b of businesses) {
    if (!b.monthlyFee) continue;
    const res = await db_createJournalEntry(
      `${yearMonth}-01`, `${b.name} — ${yearMonth} сарын түрээс нэхэмжлэв`,
      `accrual:business:${b.id}:${yearMonth}`,
      [{ account: '1120', debit: b.monthlyFee, credit: 0, party: 'business:' + b.id },
       { account: '5400', debit: 0, credit: b.monthlyFee }]
    );
    res.success ? succeeded++ : failed++;
  }
  toast(`${yearMonth} сарын нэхэмжлэл: ${succeeded} амжилттай${failed ? ', ' + failed + ' алдаатай' : ''}`, failed ? 'error' : 'success');
}

// ------------------------------------------------------------
// ТӨЛБӨР ХҮЛЭЭН АВАХ (settlement) hook-ууд — savePayment()/saveBizPayment()-
// ийн ХАЖУУГААР нэмэлтээр дуудагдана (тэдгээрийн одоогийн логикийг
// огт өөрчлөхгүй).
// ------------------------------------------------------------
async function accountingRecordResidentPayment(apt, amountPaid, date, description) {
  const party = 'resident:' + apt;
  const openBalance = Math.max(await db_getPartyBalance('1110', party), 0);
  const settleAmount = Math.min(amountPaid, openBalance);
  const overpayAmount = +(amountPaid - settleAmount).toFixed(2);

  const lines = [{ account: '1020', debit: amountPaid, credit: 0, party }];
  if (settleAmount > 0) lines.push({ account: '1110', debit: 0, credit: settleAmount, party });
  if (overpayAmount > 0) lines.push({ account: '3050', debit: 0, credit: overpayAmount, party });

  return db_createJournalEntry(date, description || `${apt} тоот — төлбөр хүлээн авав`, `payment:resident:${apt}:${date}`, lines);
}

async function accountingRecordBusinessPayment(businessId, amountPaid, date, description) {
  const party = 'business:' + businessId;
  const openBalance = Math.max(await db_getPartyBalance('1120', party), 0);
  const settleAmount = Math.min(amountPaid, openBalance);
  const overpayAmount = +(amountPaid - settleAmount).toFixed(2);

  const lines = [{ account: '1020', debit: amountPaid, credit: 0, party }];
  if (settleAmount > 0) lines.push({ account: '1120', debit: 0, credit: settleAmount, party });
  if (overpayAmount > 0) lines.push({ account: '3050', debit: 0, credit: overpayAmount, party });

  return db_createJournalEntry(date, description || `Аж ахуйн нэгж #${businessId} — төлбөр хүлээн авав`, `payment:business:${businessId}:${date}`, lines);
}

// ------------------------------------------------------------
// ЗАРДЛЫН ДАНСНЫ MAPPING (санал болгож буй эхний хувилбар) — EXPENSE_CATS
// (finance.js)-ийн чөлөөт текст ангиллыг chart_of_accounts-ийн тодорхой
// дансуудтай нийцүүлнэ. ⚠️ ЭНЭ MAPPING-ИЙГ НЯГТЛАН БОДОГЧООР ХЯНУУЛАХЫГ
// ЗӨВЛӨЖ БАЙНА — зарим зүйл тодорхойгүй тул хамгийн ойрхон дансанд
// (ихэвчлэн 7090 "Бусад") ноогдуулсан болно.
// ------------------------------------------------------------
const EXPENSE_SUBCAT_TO_ACCOUNT = {
  'Цалин хөлсний зардал': '7010',
  'НДШ зардал': '7020',
  'Татварын зардал (ХХОАТ)': '3020', // энэ бол өглөг тооцох тул онцгой тохиолдол — доор тайлбарласан
  'Ашиглалтын зардалд төлсөн (цахилгаан, ус, дулаан, санхүүгийн програм)': '7040',
  'Интернет, шуудан холбоо, бичиг хэрэг': '7050',
  'Шатахуун, тээврийн хөлс': '7070',
  'Хуримтлалын сан': '4100', // энэ зардал биш, цэвэр хөрөнгийн нөөц рүү шилжүүлэлт — тусад нь бодолцоно
  'Үндсэн хөрөнгийн элэгдэл': '7060',
};
function mapExpenseSubcatToAccount(subcat) {
  return EXPENSE_SUBCAT_TO_ACCOUNT[subcat] || '7090'; // тодорхойгүй бол "Бусад ерөнхий зардал"
}

async function accountingRecordExpense(subcat, amount, date, description) {
  const account = mapExpenseSubcatToAccount(subcat);
  return db_createJournalEntry(date, description || subcat, `expense:${account}:${date}`,
    [{ account, debit: amount, credit: 0 }, { account: '1020', debit: 0, credit: amount }]);
}

async function accountingRecordIncome(subcat, amount, date, description) {
  // Одоогийн INCOME_CATS нь резидент/бизнесээс тусдаа "бусад орлого" төрлүүд
  // (жишээ нь антен/лифтний самбарын түрээс, банкны хүү) — эдгээрийг 5600
  // (Бусад орлого) дансанд ноогдуулна.
  return db_createJournalEntry(date, description || subcat, `income:5600:${date}`,
    [{ account: '1020', debit: amount, credit: 0 }, { account: '5600', debit: 0, credit: amount }]);
}
