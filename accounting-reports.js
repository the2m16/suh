// ============================================================
// accounting-reports.js — Нягтлан бодох бүртгэлийн ТАЙЛАН ХАРАХ модуль
// ============================================================
// ЭНЭ ФАЙЛ ЗӨВХӨН УНШИХ (read-only) зориулалттай — journal_entries/
// journal_lines/chart_of_accounts (Supabase)-аас дата татаж, ТЭДГЭЭРИЙГ
// шинээр journal бичих ямар ч функцгүйгээр л тайлан болгон харуулна.
// Гүйлгээ бичих цорын ганц зам хэвээрээ accounting-bridge.js
// (sb.rpc('create_journal_entry',...)) байна.
//
// Доорх тайлан тооцоолох логик (getTrialBalance, generateBalanceSheetFormA,
// generateIncomeStatementFormA, generateCashFlowStatement, getLedger гэх мэт)
// нь Node.js орчинд 83 тестээр батлагдсан "accounting.js" прототипоос яг
// тэр хэвээр нь шилжүүлсэн (дахин бичээгүй, дахин алдаа гаргах эрсдэлгүй).
// ============================================================

let JOURNAL_ENTRIES = []; // Supabase-аас ачаалагдана (loadJournalData())

async function loadJournalData() {
  const { data, error } = await sb
    .from('journal_entries')
    .select('id, entry_date, description, reference, journal_lines(account_code, debit, credit, party)')
    .order('entry_date', { ascending: true })
    .order('id', { ascending: true });

  if (error) {
    console.error('Journal дата ачаалахад алдаа:', error.message);
    toast('Нягтлан бодох бүртгэлийн дата ачаалахад алдаа гарлаа', 'error');
    JOURNAL_ENTRIES = [];
    return false;
  }

  JOURNAL_ENTRIES = (data || []).map(e => ({
    id: e.id, date: e.entry_date, description: e.description, reference: e.reference,
    lines: (e.journal_lines || []).map(l => ({
      account: l.account_code, debit: +l.debit, credit: +l.credit, party: l.party,
    })),
  }));
  return true;
}
const ACCOUNT_CATEGORIES = {
  asset:       { label: 'Хөрөнгө',              normal_balance: 'debit'  },
  contra_asset:{ label: 'Хөрөнгийн хасагдуулга', normal_balance: 'credit' }, // элэгдэл, найдваргүй авлагын хасагдуулга гэх мэт
  liability:   { label: 'Өр төлбөр',            normal_balance: 'credit' },
  net_assets:  { label: 'Цэвэр хөрөнгө',        normal_balance: 'credit' },
  income:      { label: 'Орлого',               normal_balance: 'credit' },
  expense:     { label: 'Зардал',               normal_balance: 'debit'  },
};


const CHART_OF_ACCOUNTS = [
  // ============================================================
  // A. САНХҮҮГИЙН БАЙДЛЫН ДАНС — НЭГ. ХӨРӨНГӨ
  // ============================================================
  // --- Эргэлтийн хөрөнгө / Мөнгөн хөрөнгө (албан ёсны бүлэг 10) ---
  { code: '1010', name: 'Кассад байгаа бэлэн мөнгө',            category: 'asset', group: 'Мөнгөн хөрөнгө', official_code: '10' },
  { code: '1020', name: 'Харилцахад байгаа мөнгө',              category: 'asset', group: 'Мөнгөн хөрөнгө', official_code: '10',
    note: 'Банкны данс тус бүрээр туслах данс нээж болно (жишээ: 1020-01 Хаан банк, 1020-02 Голомт банк)' },

  // --- Богино хугацаат хөрөнгө оруулалт (13) ---
  { code: '1030', name: 'Богино хугацаат хөрөнгө оруулалт',     category: 'asset', group: 'Богино хугацаат хөрөнгө оруулалт', official_code: '13' },

  // --- Авлагын данс (12) ---
  { code: '1110', name: 'Сууц өмчлөгчдийн авлага',               category: 'asset', group: 'Авлагын данс', official_code: '12',
    note: 'Тухайн сарын хураамж хугацаандаа төлөгдөөгүй өмчлөгчийн авлага. residents/transactions-той шууд холбогдоно (Phase 2).' },
  { code: '1120', name: 'Аж ахуйн нэгжийн авлага',               category: 'asset', group: 'Авлагын данс', official_code: '12',
    note: 'Түрээслэгч аж ахуйн нэгжийн төлөгдөөгүй авлага. businesses-тэй холбогдоно (Phase 2).' },
  { code: '1130', name: 'Ажилтнаас авах авлага',                 category: 'asset', group: 'Авлагын данс', official_code: '12' },
  { code: '1140', name: 'Бусад авлага',                          category: 'asset', group: 'Авлагын данс', official_code: '12' },
  { code: '1190', name: 'Найдваргүй авлагын хасагдуулга',        category: 'contra_asset', group: 'Авлагын данс', official_code: '12',
    note: 'Contra-asset данс — үлдэгдэл нь бусад авлагын дансдын дүнг бууруулна (Кт талдаа өснө).' },

  // --- Бараа материал (14) ---
  { code: '1210', name: 'Бараа материал',                       category: 'asset', group: 'Бараа материал', official_code: '14' },
  { code: '1220', name: 'Түлш шатахуун',                         category: 'asset', group: 'Бараа материал', official_code: '14' },
  { code: '1230', name: 'Сэлбэг хэрэгсэл',                       category: 'asset', group: 'Бараа материал', official_code: '14' },

  // --- Урьдчилж төлсөн зардал/тооцоо (18) ---
  { code: '1400', name: 'Урьдчилж төлсөн зардал/тооцоо',        category: 'asset', group: 'Урьдчилж төлсөн зардал', official_code: '18' },

  // --- Эргэлтийн бус хөрөнгө / Үндсэн хөрөнгө (20) ---
  { code: '2010', name: 'Үндсэн хөрөнгө',                       category: 'asset', group: 'Үндсэн хөрөнгө', official_code: '20',
    note: 'fixed_assets хүснэгэлтэй шууд холбогдоно (Phase 2) — original_cost нийлбэр.' },
  { code: '2015', name: 'Үндсэн хөрөнгийн хуримтлагдсан элэгдэл', category: 'contra_asset', group: 'Үндсэн хөрөнгө', official_code: '20',
    note: 'Contra-asset — fixed_assets.accumulated_depreciation нийлбэртэй тохирно.' },

  // --- Биет бус хөрөнгө (21) ---
  { code: '2100', name: 'Биет бус хөрөнгө',                     category: 'asset', group: 'Биет бус хөрөнгө', official_code: '21' },

  // --- Хөрөнгө оруулалт (22) ---
  { code: '2200', name: 'Хөрөнгө оруулалт',                     category: 'asset', group: 'Хөрөнгө оруулалт', official_code: '22' },

  // ============================================================
  // A. САНХҮҮГИЙН БАЙДЛЫН ДАНС — ХОЁР. ӨР ТӨЛБӨР БА БАЙГУУЛЛАГЫН ӨМЧ
  // ============================================================
  // --- Богино хугацаат өр төлбөр (31/32/33) ---
  { code: '3010', name: 'Нийлүүлэгчид өгөх өглөг',              category: 'liability', group: 'Богино хугацаат өр төлбөр', official_code: '31' },
  { code: '3020', name: 'Татвар, хураамжийн өглөг',             category: 'liability', group: 'Богино хугацаат өр төлбөр', official_code: '33' },
  { code: '3030', name: 'Цалин, нийгмийн даатгалын өглөг',      category: 'liability', group: 'Богино хугацаат өр төлбөр', official_code: '31' },
  { code: '3040', name: 'Бусад өглөг',                          category: 'liability', group: 'Богино хугацаат өр төлбөр', official_code: '31' },
  { code: '3050', name: 'Урьдчилж орсон орлого',                category: 'liability', group: 'Богино хугацаат өр төлбөр', official_code: '32',
    note: 'Өмчлөгч/түрээслэгч хэдэн сарын хураамжийг урьдчилж төлсөн тохиолдолд ашиглана.' },

  // --- Урт хугацаат өр төлбөр (34) ---
  { code: '3900', name: 'Урт хугацаат өр',                      category: 'liability', group: 'Урт хугацаат өр төлбөр', official_code: '34' },

  // --- Цэвэр хөрөнгө (41/42/44) ---
  { code: '4100', name: 'Нөөц сан',                             category: 'net_assets', group: 'Цэвэр хөрөнгө', official_code: '41' },
  { code: '4200', name: 'Дахин үнэлгээний нэмэгдэл',            category: 'net_assets', group: 'Цэвэр хөрөнгө', official_code: '42' },
  { code: '4400', name: 'Хуримтлагдсан үр дүн',                 category: 'net_assets', group: 'Цэвэр хөрөнгө', official_code: '44',
    note: 'Жил бүрийн эцэст 9200 дансны үлдэгдэл энд шилждэг (Phase 2 — жилийн хаалтын гүйлгээ).' },

  // ============================================================
  // Б. ОРЛОГО, ЗАРДЛЫН ДАНС — НЭГ. ОРЛОГО
  // ============================================================
  { code: '5100', name: 'Гишүүдийн хураамж (Сууц өмчлөгчийн хураамж)', category: 'income', group: 'Орлого', official_code: '51',
    note: 'СӨХ-ийн гол орлого. transactions category=\'resident\' үүнд харгалзана (Phase 2).' },
  { code: '5200', name: 'Хөтөлбөр, төслийн орлого',             category: 'income', group: 'Орлого', official_code: '52' },
  { code: '5300', name: 'Бэлэг, хандив, тусламжийн орлого',     category: 'income', group: 'Орлого', official_code: '53' },
  { code: '5400', name: 'Түрээсийн орлого (Аж ахуйн нэгж)',     category: 'income', group: 'Орлого', official_code: '54',
    note: 'transactions category=\'business\' үүнд харгалзана (Phase 2).' },
  { code: '5500', name: 'Хөрөнгө оруулалтын орлого',            category: 'income', group: 'Орлого', official_code: '55' },
  { code: '5600', name: 'Бусад орлого',                         category: 'income', group: 'Орлого', official_code: '56' },

  // ============================================================
  // Б. ОРЛОГО, ЗАРДЛЫН ДАНС — ХОЁР. ЗАРДАЛ
  // ============================================================
  { code: '6100', name: 'Хандив, тусламжийн зардал',            category: 'expense', group: 'Зардал', official_code: '61' },
  { code: '6200', name: 'Хөтөлбөр хэрэгжүүлэх зардал',          category: 'expense', group: 'Зардал', official_code: '62' },
  { code: '6300', name: 'Төсөл хэрэгжүүлэх зардал',             category: 'expense', group: 'Зардал', official_code: '63' },

  // --- Ерөнхий удирдлагын зардал (70) — СӨХ-ийн ихэнх зардал энд ордог,
  //     тул дэд данс болгон задалж, одоогийн finance.js-ийн EXPENSE_CATS-той
  //     ирээдүйд шууд харьцуулж болохоор нэрлэв (Phase 2 mapping) ---
  { code: '7010', name: 'Цалин хөлс, шагнал урамшуулал',        category: 'expense', group: 'Ерөнхий удирдлагын зардал', official_code: '70' },
  { code: '7020', name: 'Нийгмийн даатгалын зардал',            category: 'expense', group: 'Ерөнхий удирдлагын зардал', official_code: '70' },
  { code: '7030', name: 'Засвар үйлчилгээний зардал',           category: 'expense', group: 'Ерөнхий удирдлагын зардал', official_code: '70' },
  { code: '7040', name: 'Түлш, эрчим хүчний зардал',            category: 'expense', group: 'Ерөнхий удирдлагын зардал', official_code: '70' },
  { code: '7050', name: 'Холбоо, ус, халаалтын зардал',         category: 'expense', group: 'Ерөнхий удирдлагын зардал', official_code: '70' },
  { code: '7060', name: 'Үндсэн хөрөнгийн элэгдэл (зардал)',    category: 'expense', group: 'Ерөнхий удирдлагын зардал', official_code: '70',
    note: 'Энэ зардлын эсрэг тал 2015 (Хуримтлагдсан элэгдэл) данс.' },
  { code: '7070', name: 'Томилолтын зардал',                    category: 'expense', group: 'Ерөнхий удирдлагын зардал', official_code: '70' },
  { code: '7080', name: 'Сургалтын зардал',                     category: 'expense', group: 'Ерөнхий удирдлагын зардал', official_code: '70' },
  { code: '7090', name: 'Бусад ерөнхий зардал',                 category: 'expense', group: 'Ерөнхий удирдлагын зардал', official_code: '70' },

  { code: '8700', name: 'Үндсэн бус үйл ажиллагааны ашиг (алдагдал)', category: 'income', group: 'Үндсэн бус үйл ажиллагаа', official_code: '87',
    note: 'Торгууль, ханшийн зөрүү, хөрөнгө худалдсаны ашиг/алдагдал зэрэг. Ашиг үед Кт, алдагдал үед Дт үлдэгдэлтэй байж болно.' },

  { code: '9200', name: 'Орлого, зарлагын нэгдсэн данс',        category: 'net_assets', group: 'Жилийн хаалтын данс', official_code: '92',
    note: 'Зөвхөн жилийн эцсийн хаалтын гүйлгээнд ашиглагдана (Phase 2) — бусад орлого/зардлын дансдыг энд хааж, дараа нь 4400 руу шилжүүлнэ.' },
];

// ============================================================
// Туслах функцууд
// ============================================================


function getAccountByCode(code) {
  return CHART_OF_ACCOUNTS.find(a => a.code === code) || null;
}


function getAccountsByCategory(category) {
  return CHART_OF_ACCOUNTS.filter(a => a.category === category);
}


function getAccountsByGroup(group) {
  return CHART_OF_ACCOUNTS.filter(a => a.group === group);
}

// Тухайн дансны "энгийн" тал (debit/credit) — Journal Entry-ийн Дт=Кт шалгалтад Phase 2-т ашиглагдана

function getNormalBalance(code) {
  const acc = getAccountByCode(code);
  if (!acc) return null;
  return ACCOUNT_CATEGORIES[acc.category].normal_balance;
}

// Дансны жагсаалтыг бүлгээр нь мод (tree) хэлбэрт оруулна — UI-д харуулахад бэлэн

function buildAccountTree() {
  const tree = {};
  for (const acc of CHART_OF_ACCOUNTS) {
    if (!tree[acc.group]) tree[acc.group] = [];
    tree[acc.group].push(acc);
  }
  return tree;
}

// ============================================================
// БҮТЦИЙН БАТАЛГААЖУУЛАЛТ (self-check) — модулийг ачаалах бүрт ажиллана.
// Алдаа илэрвэл консольд анхааруулна (production-д чимээгүй унтрана,
// учир нь энэ бол хөгжүүлэлтийн үеийн аюулгүй байдлын шалгалт).
// ============================================================

(function validateChartOfAccounts() {
  const errors = [];
  const seenCodes = new Set();

  for (const acc of CHART_OF_ACCOUNTS) {
    // 1. Кодын давхардал шалгах
    if (seenCodes.has(acc.code)) errors.push(`Давхардсан код: ${acc.code} (${acc.name})`);
    seenCodes.add(acc.code);

    // 2. Кодын формат шалгах (4 оронтой тоо байх ёстой)
    if (!/^\d{4}$/.test(acc.code)) errors.push(`Буруу форматтай код: ${acc.code} (${acc.name})`);

    // 3. category нь ACCOUNT_CATEGORIES-д заавал байх ёстой
    if (!ACCOUNT_CATEGORIES[acc.category]) errors.push(`Үл мэдэгдэх ангилал: ${acc.category} (${acc.code})`);

    // 4. Эхний цифр нь category-той нийцэж байгаа эсэх (1=хөрөнгө, 2=эргэлтийн бус хөрөнгө, 3=өр төлбөр, 4/9=цэвэр хөрөнгө, 5=орлого, 6-8=зардал/бусад)
    const firstDigit = acc.code[0];
    const expectedByDigit = {
      '1': ['asset', 'contra_asset'],
      '2': ['asset', 'contra_asset'],
      '3': ['liability'],
      '4': ['net_assets'],
      '5': ['income'],
      '6': ['expense'],
      '7': ['expense'],
      '8': ['income', 'expense'], // үндсэн бус ашиг/алдагдал хоёр чиглэлтэй байж болно
      '9': ['net_assets'],
    };
    if (expectedByDigit[firstDigit] && !expectedByDigit[firstDigit].includes(acc.category)) {
      errors.push(`Кодын эхний орон (${firstDigit}) ба ангилал (${acc.category}) зөрчилдөж байна: ${acc.code} (${acc.name})`);
    }
  }

  if (errors.length) {
    console.error('⚠️ Дансны жагсаалтын бүтцэд алдаа илэрлээ:\n' + errors.join('\n'));
  } else if (typeof console !== 'undefined' && console.info) {
    console.info(`✓ accounting.js: Дансны жагсаалт баталгаажлаа (${CHART_OF_ACCOUNTS.length} данс, алдаагүй).`);
  }
})();

// ============================================================
// PHASE 2 — JOURNAL ENTRIES (Ажил гүйлгээний бичилт, давхар бичилт)
// ============================================================
// Энэ хэсэг Phase 1 (Дансны жагсаалт)-ийн ДООР нэмэгдэнэ. Нягтлан бодох
// бүртгэлийн тухай хуулийн 14.1, мөн ТББ-д мөрдөх зааврын 3-р зүйлийн
// дагуу: "Аж ахуйн нэгж, байгууллага нь нягтлан бодох бүртгэлийн ажил
// гүйлгээг давхар бичилтийн хэлбэрээр бүртгэнэ" — өөрөөр хэлбэл гүйлгээ
// бүр дор хаяж нэг Дт, нэг Кт талтай байж, Дт нийлбэр = Кт нийлбэр байх
// ёстой. Энэ модуль яг үүнийг автоматаар шалгаж, зөрчилтэй бичилтийг
// (unbalanced entry) огт бүртгүүлэхгүй.
//
// suh.html-д ХАРААХАН ХОЛБООГҮЙ — тусад нь турших зорилготой (Phase 1-тэй адил).
// ============================================================


function getEntriesForAccount(code, { fromDate, toDate } = {}) {
  return JOURNAL_ENTRIES.filter(e => {
    if (fromDate && e.date < fromDate) return false;
    if (toDate && e.date > toDate) return false;
    return e.lines.some(l => l.account === code);
  });
}

// Дансны үлдэгдлийг тухайн дансны "энгийн тал"-ын (normal_balance) нэрлэсэн
// чиглэлээр эерэг тоогоор буцаана. Жишээ нь Хөрөнгийн данс Дт-гээ
// давамгайлбал эерэг, Орлогын данс Кт-гээ давамгайлбал эерэг гэх мэт.

function getAccountBalance(code, opts = {}) {
  const acc = getAccountByCode(code);
  if (!acc) return null;
  const normalSide = getNormalBalance(code);
  let debitSum = 0, creditSum = 0;
  for (const entry of getEntriesForAccount(code, opts)) {
    for (const line of entry.lines) {
      if (line.account === code) { debitSum += line.debit; creditSum += line.credit; }
    }
  }
  const balance = normalSide === 'debit' ? (debitSum - creditSum) : (creditSum - debitSum);
  return { code, name: acc.name, category: acc.category, normal_balance: normalSide, debitSum, creditSum, balance };
}

// ------------------------------------------------------------
// Тэнцэл шалгах хүснэгт (Trial Balance) — бүх дансны үлдэгдлийг жагсааж,
// Дт нийт = Кт нийт эсэхийг баталгаажуулна. Энэ бол Phase 3 (Тэнцэл,
// Санхүүгийн тайлан)-ын үндэс болно.
// ------------------------------------------------------------

function getTrialBalance(opts = {}) {
  const rows = [];
  let totalDebit = 0, totalCredit = 0;
  for (const acc of CHART_OF_ACCOUNTS) {
    const bal = getAccountBalance(acc.code, opts);
    if (bal.debitSum === 0 && bal.creditSum === 0) continue; // хөдөлгөөнгүй дансыг жагсаалтад оруулахгүй
    const debitCol = bal.normal_balance === 'debit' ? Math.max(bal.balance, 0) : Math.max(-bal.balance, 0);
    const creditCol = bal.normal_balance === 'credit' ? Math.max(bal.balance, 0) : Math.max(-bal.balance, 0);
    rows.push({ code: acc.code, name: acc.name, category: acc.category, debit: debitCol, credit: creditCol });
    totalDebit += debitCol;
    totalCredit += creditCol;
  }
  return { rows, totalDebit, totalCredit, balanced: Math.abs(totalDebit - totalCredit) < 0.01 };
}


function getPartyBalance(code, party, opts = {}) {
  const acc = getAccountByCode(code);
  if (!acc) return null;
  const normalSide = getNormalBalance(code);
  let debitSum = 0, creditSum = 0;
  for (const entry of getEntriesForAccount(code, opts)) {
    for (const line of entry.lines) {
      if (line.account === code && line.party === party) { debitSum += line.debit; creditSum += line.credit; }
    }
  }
  const balance = normalSide === 'debit' ? (debitSum - creditSum) : (creditSum - debitSum);
  return { code, party, debitSum, creditSum, balance };
}

// Тухайн авлагын дансны БҮХ талуудын (бүх resident/business) нээлттэй
// үлдэгдлийг жагсаана — "хэн хэдий хэмжээгээр өртэй" тайлан (aging).
// Зөвхөн 0-ээс их үлдэгдэлтэй (өрийг) харуулна.

function getAgingReport(code) {
  const parties = new Set();
  for (const entry of getEntriesForAccount(code)) {
    for (const line of entry.lines) {
      if (line.account === code && line.party) parties.add(line.party);
    }
  }
  const rows = [];
  for (const party of parties) {
    const bal = getPartyBalance(code, party);
    if (bal.balance > 0.01) rows.push(bal);
  }
  return rows.sort((a, b) => b.balance - a.balance);
}

// ------------------------------------------------------------
// АККРУЭЛ (нэхэмжлэх) — сар бүрийн эхэнд дуудна
// ------------------------------------------------------------

function getLedger(code, opts = {}) {
  const acc = getAccountByCode(code);
  if (!acc) return null;
  const normalSide = getNormalBalance(code);

  // Огноогоор эрэмбэлсэн хуулбар — эх JOURNAL_ENTRIES-ийг өөрчлөхгүй
  const entries = getEntriesForAccount(code, opts)
    .slice()
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.id - b.id));

  let running = 0;
  const rows = [];
  for (const entry of entries) {
    for (const line of entry.lines) {
      if (line.account !== code) continue;
      const delta = normalSide === 'debit' ? (line.debit - line.credit) : (line.credit - line.debit);
      running += delta;
      rows.push({
        date: entry.date, description: entry.description, reference: entry.reference,
        party: line.party || null, debit: line.debit, credit: line.credit,
        runningBalance: running,
      });
    }
  }

  return { code, name: acc.name, category: acc.category, normal_balance: normalSide, rows, endingBalance: running };
}

// ------------------------------------------------------------
// Ангилсан Тэнцэл шалгах тайлан — Хөрөнгө / Өр төлбөр / Цэвэр хөрөнгө /
// Орлого / Зардал гэсэн 5 бүлгээр бүлэглэж, бүлэг тус бүрийн дэд нийлбэрийг
// гаргана. Энэ бол Phase 4 (Тэнцэл, Орлогын тайлан)-ийн шууд суурь.
// ------------------------------------------------------------

function getCategorizedTrialBalance(opts = {}) {
  const tb = getTrialBalance(opts);
  const sections = {
    asset: { label: 'Хөрөнгө', rows: [], totalDebit: 0, totalCredit: 0 },
    contra_asset: { label: 'Хөрөнгийн хасагдуулга', rows: [], totalDebit: 0, totalCredit: 0 },
    liability: { label: 'Өр төлбөр', rows: [], totalDebit: 0, totalCredit: 0 },
    net_assets: { label: 'Цэвэр хөрөнгө', rows: [], totalDebit: 0, totalCredit: 0 },
    income: { label: 'Орлого', rows: [], totalDebit: 0, totalCredit: 0 },
    expense: { label: 'Зардал', rows: [], totalDebit: 0, totalCredit: 0 },
  };
  for (const row of tb.rows) {
    const section = sections[row.category];
    section.rows.push(row);
    section.totalDebit += row.debit;
    section.totalCredit += row.credit;
  }
  return { sections, totalDebit: tb.totalDebit, totalCredit: tb.totalCredit, balanced: tb.balanced };
}

// ------------------------------------------------------------
// ҮНДСЭН НЯГТЛАН БОДОХ БҮРТГЭЛИЙН ТЭГШИТГЭЛ (Accounting Equation):
//    Хөрөнгө (цэвэр) = Өр төлбөр + Цэвэр хөрөнгө + (Орлого - Зардал)
// Энэ нь Trial Balance-ийн Дт=Кт шалгалттай математикийн хувьд адилтгах ч,
// БҮРЭН ТУСДАА тооцоолол ашигладаг тул давхар-шалгалт (cross-check) болно —
// хэрэв аль нэг функцэд алдаа орсон бол хоёр аргаар тооцоход зөрүү гарна.
// ------------------------------------------------------------

function checkAccountingEquation() {
  let assets = 0, contraAssets = 0, liabilities = 0, netAssets = 0, income = 0, expense = 0;
  for (const acc of CHART_OF_ACCOUNTS) {
    const bal = getAccountBalance(acc.code).balance;
    if (acc.category === 'asset') assets += bal;
    else if (acc.category === 'contra_asset') contraAssets += bal;
    else if (acc.category === 'liability') liabilities += bal;
    else if (acc.category === 'net_assets') netAssets += bal;
    else if (acc.category === 'income') income += bal;
    else if (acc.category === 'expense') expense += bal;
  }
  const netAssetsSide = assets - contraAssets;
  const liabilitiesPlusEquitySide = liabilities + netAssets + (income - expense);
  const diff = +(netAssetsSide - liabilitiesPlusEquitySide).toFixed(2);
  return {
    assets, contraAssets, liabilities, netAssets, income, expense,
    netAssetsSide, liabilitiesPlusEquitySide, diff,
    equationHolds: Math.abs(diff) < 0.01,
  };
}

// ============================================================
// PHASE 4 — САНХҮҮГИЙН ТАЙЛАН (А МАЯГТ)
// ============================================================
// ЭХ СУРВАЛЖ: Сангийн сайдын 386 тоот тушаалын 3-р хавсралт "Санхүүгийн
// тайлангийн А маягт" (legalinfo.mn/mn/detail?lawId=208281) — мөрийн
// дугаар, нэршил албан ёсны эх хувиас яг хуулбарласан.
//
// ЦАР ХҮРЭЭ (энэ хувилбарт орсон): 2 гол тайлан —
//   1) САНХҮҮГИЙН БАЙДЛЫН ТАЙЛАН (Тэнцэл)
//   2) ҮР ДҮНГИЙН ТАЙЛАН (Орлогын тайлан)
// ОРООГҮЙ (Phase 4b-д шилжүүлэв, учир нь нэмэлт өгөгдлийн бүтэц шаардана):
//   - ЦЭВЭР ХӨРӨНГИЙН ӨӨРЧЛӨЛТИЙН ТАЙЛАН (өмнөх оны харьцуулалт хэрэгтэй)
//   - МӨНГӨН ГҮЙЛГЭЭНИЙ ТАЙЛАН (гүйлгээ бүрийг үндсэн/хөрөнгө оруулалт/
//     санхүүгийн үйл ажиллагаагаар ангилах шинэ логик хэрэгтэй)
//   - САНХҮҮГИЙН ТАЙЛАНГИЙН ТОДРУУЛГА (ихэнх нь код бус, байгууллагын
//     бодлогын тайлбар — нягтлан бодогч/удирдлага өөрөө бөглөх ёстой хэсэг)
// ============================================================


function generateBalanceSheetFormA(opts = {}) {
  const b = code => getAccountBalance(code, opts).balance;
  const sum = (...codes) => codes.reduce((s, c) => s + b(c), 0);

  // --- 1.1 Эргэлтийн хөрөнгө ---
  const l111 = sum('1010', '1020');            // Мөнгө, түүнтэй адилтгах хөрөнгө
  const l112 = sum('1030');                     // Богино хугацаат хөрөнгө оруулалт
  const l113 = sum('1110', '1120', '1130', '1140'); // Дансны авлага
  const l114 = -sum('1190');                    // Найдваргүй авлагын хасагдуулга (хасах тоогоор)
  const l115 = sum('1210', '1220', '1230');     // Бараа материал
  const l116 = sum('1400');                     // Урьдчилж төлсөн зардал/тооцоо
  const l117 = 0;                                // Бусад эргэлтийн хөрөнгө (одоогийн COA-д тусад нь байхгүй)
  const l118 = l111 + l112 + l113 + l114 + l115 + l116 + l117; // Эргэлтийн хөрөнгийн дүн

  // --- 1.2 Эргэлтийн бус хөрөнгө ---
  const l121 = sum('2010');                     // Үндсэн хөрөнгө
  const l122 = -sum('2015');                    // Хуримтлагдсан элэгдэл (хасах тоогоор)
  const l123 = 0;                                // Бусад үндсэн хөрөнгө
  const l124 = 0;                                // (Бусад үндсэн хөрөнгийн) хуримтлагдсан элэгдэл
  const l125 = sum('2100');                     // Биет бус хөрөнгө
  const l126 = 0;                                // Биет бус хөрөнгийн хуримтлагдсан элэгдэл (тусад нь дансгүй)
  const l127 = sum('2200');                     // Хөрөнгө оруулалт ба бусад хөрөнгө
  const l128 = l121 + l122 + l123 + l124 + l125 + l126 + l127; // Эргэлтийн бус хөрөнгийн дүн

  const l13 = l118 + l128; // НИЙТ ХӨРӨНГИЙН ДҮН

  // --- 2.1.1 Богино хугацаат өр төлбөр ---
  const l2111 = sum('3010');                    // Дансны өглөг
  const l2112 = sum('3030');                    // Цалингийн өглөг
  const l2113 = sum('3020');                    // Татварын өр
  const l2114 = 0;                               // Богино хугацаат зээл (одоогоор тусад нь дансгүй)
  const l2115 = sum('3050');                    // Урьдчилж орсон орлого
  const l2116 = sum('3040');                    // Бусад өглөг
  const l2117 = l2111 + l2112 + l2113 + l2114 + l2115 + l2116; // Богино хугацаат өр төлбөрийн дүн

  // --- 2.1.2 Урт хугацаат өр төлбөр ---
  const l2121 = sum('3900');                    // Урт хугацаат зээл
  const l2122 = 0;                               // Бусад урт хугацаат өр төлбөр
  const l2123 = l2121 + l2122;                   // Урт хугацаат өр төлбөрийн дүн

  const l22 = l2117 + l2123; // Өр төлбөрийн нийт дүн

  // --- 2.3 Цэвэр хөрөнгө ---
  const l231 = sum('4100');                     // Нөөц: а) хязгаарлалтгүй
  const l232 = 0;                                // б) хязгаарлалттай (тусад нь бүртгэдэггүй)
  const l233 = sum('4200');                     // Дахин үнэлгээний нэмэгдэл
  const l234 = 0;                                // Цэвэр хөрөнгийн бусад хэсэг
  // Хуримтлагдсан үр дүн = өмнөх жилүүдийн хаагдсан үр дүн (4400) + ЭНЭ ҮЕИЙН хаагдаагүй
  // орлого-зардлын цэвэр дүн (учир нь жилийн эцсийн хаалтын гүйлгээ хийгдэх хүртэл 5xxx/6xxx-8xxx
  // дансад "нээлттэй" хэвээр байдаг — Тэнцэл гаргахын тулд эдгээрийг цэвэр хөрөнгөд нэгтгэж харуулна).
  const currentPeriodNetResult = sum('5100','5200','5300','5400','5500','5600') // орлого
    - sum('6100','6200','6300','7010','7020','7030','7040','7050','7060','7070','7080','7090') // зардал
    + sum('8700'); // үндсэн бус ашиг(алдагдал)
  const l235 = sum('4400') + currentPeriodNetResult; // Хуримтлагдсан үр дүн
  const l236 = l231 + l232 + l233 + l234 + l235; // Цэвэр хөрөнгийн дүн

  const l24 = l22 + l236; // ӨР ТӨЛБӨР БА ЦЭВЭР ХӨРӨНГИЙН ДҮН — энэ 1.3-тай тэнцэх ёстой!

  return {
    asOfDate: opts.toDate || null,
    hurungu: {
      '1.1.1': l111, '1.1.2': l112, '1.1.3': l113, '1.1.4': l114, '1.1.5': l115, '1.1.6': l116, '1.1.7': l117,
      '1.1.8_ergeltiin_hurungu': l118,
      '1.2.1': l121, '1.2.2': l122, '1.2.3': l123, '1.2.4': l124, '1.2.5': l125, '1.2.6': l126, '1.2.7': l127,
      '1.2.8_ergeltiin_bus_hurungu': l128,
      '1.3_niit_hurungu': l13,
    },
    urTulbur_tsever_hurungu: {
      '2.1.1.1': l2111, '2.1.1.2': l2112, '2.1.1.3': l2113, '2.1.1.4': l2114, '2.1.1.5': l2115, '2.1.1.6': l2116,
      '2.1.1.7_bogino_ur_tulbur': l2117,
      '2.1.2.1': l2121, '2.1.2.2': l2122, '2.1.2.3_urt_ur_tulbur': l2123,
      '2.2_ur_tulbur_niit': l22,
      '2.3.1': l231, '2.3.2': l232, '2.3.3': l233, '2.3.4': l234, '2.3.5': l235,
      '2.3.6_tsever_hurungu': l236,
      '2.4_ur_tulbur_ba_tsever_hurungu_niit': l24,
    },
    balanced: Math.abs(l13 - l24) < 0.01, // ЭНЭ ХАМГИЙН ЧУХАЛ ШАЛГАЛТ: Тэнцэл тэнцэж байгаа эсэх
  };
}


function generateIncomeStatementFormA(opts = {}) {
  const b = code => getAccountBalance(code, opts).balance;

  // --- Орлого (мөр 2-7) ---
  const l2 = b('5100'), l3 = b('5200'), l4 = b('5300'), l5 = b('5400'), l6 = b('5500'), l7 = b('5600');
  const l8 = l2 + l3 + l4 + l5 + l6 + l7; // Үйл ажиллагааны орлогын нийт дүн

  // --- Зардал (мөр 10-31) ---
  const l10 = b('6100'); // Бэлэг, хандив ба тусламж (нийт — а/б/в задаргаа одоогоор тусад нь дансгүй)
  const l14 = b('6200'); // Хөтөлбөр хэрэгжүүлсний зардал
  const l15 = b('6300'); // Төсөл хэрэгжүүлсний зардал

  const l17 = b('7010'); // Цалин хөлс, шагнал
  const l18 = b('7020'); // Нийгмийн даатгалын шимтгэл
  const l19 = b('7030'); // Засвар үйлчилгээний зардал
  const l20 = b('7040'); // Ашиглалтын зардал (түлш, эрчим хүч)
  const l21 = 0;          // Түрээсийн зардал (тусад нь дансгүй)
  const l22 = b('7070'); // Албан томилолтын зардал
  const l23 = 0;          // Тээврийн зардал (тусад нь дансгүй)
  const l24 = b('7060'); // Элэгдлийн зардал
  const l25 = 0;          // Зар сурталчилгааны зардал
  const l26 = b('7050'); // Шуудан холбооны зардал
  const l27 = 0;          // Шатахууны зардал
  const l28 = 0;          // Найдваргүй авлагын зардал
  const l29 = 0;          // Шагнал, урамшууллын зардал
  const l30 = 0;          // Зээлийн хүүгийн зардал
  const l31 = b('7080') + b('7090'); // Бусад зардал
  const l16 = l17+l18+l19+l20+l21+l22+l23+l24+l25+l26+l27+l28+l29+l30+l31; // Ерөнхий удирдлагын зардал

  const l32 = l10 + l14 + l15 + l16; // Үндсэн үйл ажиллагааны зардлын дүн
  const l33 = l8 - l32; // Үндсэн үйл ажиллагааны үр дүн

  const l34 = b('8700'); // Үндсэн бус үйл ажиллагааны ашиг (алдагдал) — задаргаагүй нэгтгэсэн дүн
  const l41 = l33 + l34; // Тайлант үеийн цэвэр үр дүн

  return {
    orlogo: { '2': l2, '3': l3, '4': l4, '5': l5, '6': l6, '7': l7, '8_niit_orlogo': l8 },
    zardal: {
      '10': l10, '14': l14, '15': l15,
      '17': l17, '18': l18, '19': l19, '20': l20, '21': l21, '22': l22, '23': l23, '24': l24,
      '25': l25, '26': l26, '27': l27, '28': l28, '29': l29, '30': l30, '31': l31,
      '16_erunhii_udirdlaga': l16,
      '32_niit_zardal': l32,
    },
    '33_undsen_uil_ajillagaanii_ur_dun': l33,
    '34_undsen_bus_ashig_aldagdal': l34,
    '41_tailant_ueiin_tsever_ur_dun': l41,
  };
}

// ============================================================
// PHASE 4b — МӨНГӨН ГҮЙЛГЭЭНИЙ ТАЙЛАН (Cash Flow Statement, шууд арга)
// ============================================================
// ЭХ СУРВАЛЖ: Сангийн сайдын 386 тоот тушаалын 3-р хавсралт, "МӨНГӨН
// ГҮЙЛГЭЭНИЙ ТАЙЛАН" хэсэг (legalinfo.mn/mn/detail?lawId=208281).
//
// АРГА: "Шууд арга" (direct method) — мөнгөн хөрөнгийн (1010/1020) дансны
// мөр бүрийг эсрэг талын дансаар нь ангилж, тохирох мөрөнд нэгтгэнэ.
// Элэгдэл (7060/2015) зэрэг мөнгөн бус зүйл мөнгөн дансад хэзээ ч
// хөдөлгөөн хийдэггүй тул автоматаар тайланд ОРОХГҮЙ (шууд аргын давуу тал).
//
// suh.html-д ХАРААХАН ХОЛБООГҮЙ.
// ============================================================

// Данс бүрийг Мөнгөн гүйлгээний тайлангийн аль мөрөнд ангилахыг тодорхойлно.
// party нь 'resident:...' эсвэл 'business:...' эсэхээс шалтгаалж зарим
// дансны ангилал өөрчлөгдөнө (жиш: 1110/3050 нь party-гаас хамаарч
// "гишүүдийн татвар" эсвэл "түрээс" аль нэгэнд ордог).

function _cashFlowClassify(account, party) {
  const isBusinessParty = party && party.startsWith('business:');
  const map = {
    '5100': { activity: 'operating', line: '1.1.a', label: 'Гишүүдийн татвараас орсон мөнгө' },
    '1110': { activity: 'operating', line: '1.1.a', label: 'Гишүүдийн татвараас орсон мөнгө' },
    '5200': { activity: 'operating', line: '1.1.b', label: 'Төсөл, хөтөлбөрөөс орсон мөнгө' },
    '5300': { activity: 'operating', line: '1.1.c', label: 'Бэлэг, хандив, тусламж' },
    '5400': { activity: 'operating', line: '1.1.d', label: 'Түрээсийн орлогод хүлээн авсан мөнгө' },
    '1120': { activity: 'operating', line: '1.1.d', label: 'Түрээсийн орлогод хүлээн авсан мөнгө' },
    '5500': { activity: 'operating', line: '1.1.e', label: 'Бусад' },
    '5600': { activity: 'operating', line: '1.1.e', label: 'Бусад' },
    '7010': { activity: 'operating', line: '1.2.a', label: 'Ажиллагчдад төлсөн' },
    '7020': { activity: 'operating', line: '1.2.b', label: 'Нийгмийн даатгалын байгууллагад төлсөн' },
    '1210': { activity: 'operating', line: '1.2.c', label: 'Бараа материал худалдан авахад төлсөн' },
    '1220': { activity: 'operating', line: '1.2.c', label: 'Бараа материал худалдан авахад төлсөн' },
    '1230': { activity: 'operating', line: '1.2.c', label: 'Бараа материал худалдан авахад төлсөн' },
    '7040': { activity: 'operating', line: '1.2.d', label: 'Ашиглалтын зардалд төлсөн' },
    '7050': { activity: 'operating', line: '1.2.d', label: 'Ашиглалтын зардалд төлсөн' },
    '7070': { activity: 'operating', line: '1.2.e', label: 'Түлш шатахуун, тээврийн хөлс, сэлбэг хэрэгсэлд төлсөн' },
    '3010': { activity: 'operating', line: '1.2.f', label: 'Бэлтгэн нийлүүлэгчдэд төлсөн бусад мөнгө' },
    '7030': { activity: 'operating', line: '1.2.f', label: 'Бэлтгэн нийлүүлэгчдэд төлсөн бусад мөнгө' },
    '7080': { activity: 'operating', line: '1.2.f', label: 'Бэлтгэн нийлүүлэгчдэд төлсөн бусад мөнгө' },
    '7090': { activity: 'operating', line: '1.2.f', label: 'Бэлтгэн нийлүүлэгчдэд төлсөн бусад мөнгө' },
    // interest expense — тус дансгүй тул одоогоор ашиглагдахгүй, ирээдүйд нэмэгдвэл 1.2.g
    '3020': { activity: 'operating', line: '1.2.h', label: 'Татварын байгууллагад төлсөн' },
    '2010': { activity: 'investing', line: '2.buy', label: 'Худалдаж авсан урт хугацаат хөрөнгө' },
    '2200': { activity: 'investing', line: '2.invest_buy', label: 'Худалдаж авсан хөрөнгө оруулалт' },
    '3900': { activity: 'financing', line: '3.loan', label: 'Банкнаас авсан зээл / Зээлийн төлөлт' },
    '3050': isBusinessParty
      ? { activity: 'operating', line: '1.1.d', label: 'Түрээсийн орлогод хүлээн авсан мөнгө (урьдчилгаа)' }
      : { activity: 'operating', line: '1.1.a', label: 'Гишүүдийн татвараас орсон мөнгө (урьдчилгаа)' },
  };
  return map[account] || { activity: 'operating', line: '1.1.e', label: 'Бусад (ангилаагүй)' };
}


function generateCashFlowStatement(opts = {}) {
  const cashAccounts = ['1010', '1020'];
  const buckets = {}; // line -> {label, activity, amount}

  function addToBucket(cls, amount) {
    if (!buckets[cls.line]) buckets[cls.line] = { line: cls.line, label: cls.label, activity: cls.activity, amount: 0 };
    buckets[cls.line].amount += amount;
  }

  for (const cashCode of cashAccounts) {
    for (const entry of getEntriesForAccount(cashCode, opts)) {
      const cashLines = entry.lines.filter(l => cashAccounts.includes(l.account));
      const otherLines = entry.lines.filter(l => !cashAccounts.includes(l.account));
      const cashNet = cashLines.reduce((s, l) => s + (l.debit - l.credit), 0); // + = орлого, - = зарлага
      if (cashNet === 0 || otherLines.length === 0) continue;

      // Энгийн тохиолдол: бүх эсрэг мөр ижил ангилалд ордог бол — cashNet-ийг тэр ангилалд бүхэлд нь оруулна.
      // (Манай recordResidentPayment/recordBusinessPayment зэрэг функц үргэлж НЭГ л party
      //  төрлийн (resident эсвэл business) мөрүүд үүсгэдэг тул энэ таамаглал бидний системд үргэлж зөв.)
      const classified = otherLines.map(l => _cashFlowClassify(l.account, l.party));
      const primary = classified[0];
      addToBucket(primary, cashNet);
    }
  }

  const opRows = Object.values(buckets).filter(b => b.activity === 'operating');
  const invRows = Object.values(buckets).filter(b => b.activity === 'investing');
  const finRows = Object.values(buckets).filter(b => b.activity === 'financing');

  const opTotal = opRows.reduce((s, r) => s + r.amount, 0);
  const invTotal = invRows.reduce((s, r) => s + r.amount, 0);
  const finTotal = finRows.reduce((s, r) => s + r.amount, 0);
  const netChange = opTotal + invTotal + finTotal;

  // Эхний ба эцсийн мөнгөн үлдэгдэл (opts.fromDate-ээс ӨМНӨХ = эхний, opts.toDate хүртэлх = эцсийн)
  const beginningBalance = opts.fromDate
    ? cashAccounts.reduce((s, c) => s + getAccountBalance(c, { toDate: _dayBefore(opts.fromDate) }).balance, 0)
    : 0;
  const endingBalance = cashAccounts.reduce((s, c) => s + getAccountBalance(c, { toDate: opts.toDate }).balance, 0);

  return {
    operating: { rows: opRows, total: opTotal },
    investing: { rows: invRows, total: invTotal },
    financing: { rows: finRows, total: finTotal },
    '4_niit_tsever_mungun_guilgee': netChange,
    '5_ehnii_uldegdel': beginningBalance,
    '6_etssiin_uldegdel': endingBalance,
    reconciles: Math.abs((beginningBalance + netChange) - endingBalance) < 0.01,
  };
}


function _dayBefore(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

// ============================================================
// ХУУДАС ИНИЦИАЛИЗАЦИ БА TAB СОЛИХ
// ============================================================
async function renderAccountingPage() {
  const ok = await loadJournalData();
  if (!ok) return;
  renderBalanceSheetTab();
  renderIncomeStatementTab();
  renderCashFlowTab();
  populateLedgerAccountSelect();
  renderJournalLedgerTab();
  renderTaxTab();
}

function switchAccountingTab(name, el) {
  ['acct-balance-sheet','acct-income-statement','acct-cash-flow','acct-ledger','acct-tax'].forEach(id => {
    const e = document.getElementById(id); if (e) e.style.display = 'none';
  });
  document.getElementById('acct-' + name).style.display = 'block';
  document.querySelectorAll('#accounting-tabs .tab').forEach(t => t.classList.remove('active'));
  if (el) el.classList.add('active');
}

function _acctRow(label, value, opts = {}) {
  const bold = opts.bold ? 'font-weight:700' : '';
  const indent = opts.indent ? 'padding-left:' + (opts.indent * 16) + 'px' : '';
  return `<div class="summary-row" style="${bold}"><span class="summary-key" style="${indent}">${esc(label)}</span><span class="summary-val">${fmt(value)}</span></div>`;
}

// ============================================================
// TAB 1: ТЭНЦЭЛ (Balance Sheet Form A)
// ============================================================
function renderBalanceSheetTab() {
  const el = document.getElementById('acct-balance-sheet');
  if (!el) return;
  const bs = generateBalanceSheetFormA();
  const h = bs.hurungu, u = bs.urTulbur_tsever_hurungu;

  el.innerHTML = `
    <div class="flex-between mb-16">
      <div style="font-size:15px;font-weight:700">Санхүүгийн байдлын тайлан (Тэнцэл)</div>
      <span class="tag ${bs.balanced ? 'tag-success' : 'tag-danger'}">${bs.balanced ? '✓ Тэнцэж байна' : '✗ ТЭНЦЭХГҮЙ БАЙНА'}</span>
    </div>
    <div class="card mb-16">
      <div style="font-weight:700;margin-bottom:8px">1. ХӨРӨНГӨ</div>
      <div style="font-size:12px;color:var(--text-muted);margin:6px 0 2px">1.1 Эргэлтийн хөрөнгө</div>
      ${_acctRow('Мөнгө, түүнтэй адилтгах хөрөнгө', h['1.1.1'], { indent: 1 })}
      ${_acctRow('Богино хугацаат хөрөнгө оруулалт', h['1.1.2'], { indent: 1 })}
      ${_acctRow('Дансны авлага', h['1.1.3'], { indent: 1 })}
      ${_acctRow('Найдваргүй авлагын хасагдуулга', -h['1.1.4'], { indent: 1 })}
      ${_acctRow('Бараа материал', h['1.1.5'], { indent: 1 })}
      ${_acctRow('Урьдчилж төлсөн зардал/тооцоо', h['1.1.6'], { indent: 1 })}
      ${_acctRow('Эргэлтийн хөрөнгийн дүн', h['1.1.8_ergeltiin_hurungu'], { bold: true, indent: 1 })}
      <div style="font-size:12px;color:var(--text-muted);margin:10px 0 2px">1.2 Эргэлтийн бус хөрөнгө</div>
      ${_acctRow('Үндсэн хөрөнгө', h['1.2.1'], { indent: 1 })}
      ${_acctRow('Хуримтлагдсан элэгдэл', -h['1.2.2'], { indent: 1 })}
      ${_acctRow('Биет бус хөрөнгө', h['1.2.5'], { indent: 1 })}
      ${_acctRow('Хөрөнгө оруулалт ба бусад хөрөнгө', h['1.2.7'], { indent: 1 })}
      ${_acctRow('Эргэлтийн бус хөрөнгийн дүн', h['1.2.8_ergeltiin_bus_hurungu'], { bold: true, indent: 1 })}
      <div style="border-top:1px solid var(--border);margin-top:8px"></div>
      ${_acctRow('НИЙТ ХӨРӨНГИЙН ДҮН', h['1.3_niit_hurungu'], { bold: true })}
    </div>
    <div class="card">
      <div style="font-weight:700;margin-bottom:8px">2. ӨР ТӨЛБӨР БА ЦЭВЭР ХӨРӨНГӨ</div>
      <div style="font-size:12px;color:var(--text-muted);margin:6px 0 2px">2.1 Богино хугацаат өр төлбөр</div>
      ${_acctRow('Дансны өглөг', u['2.1.1.1'], { indent: 1 })}
      ${_acctRow('Цалингийн өглөг', u['2.1.1.2'], { indent: 1 })}
      ${_acctRow('Татварын өр', u['2.1.1.3'], { indent: 1 })}
      ${_acctRow('Урьдчилж орсон орлого', u['2.1.1.5'], { indent: 1 })}
      ${_acctRow('Бусад өглөг', u['2.1.1.6'], { indent: 1 })}
      ${_acctRow('Богино хугацаат өр төлбөрийн дүн', u['2.1.1.7_bogino_ur_tulbur'], { bold: true, indent: 1 })}
      ${_acctRow('Өр төлбөрийн нийт дүн', u['2.2_ur_tulbur_niit'], { bold: true })}
      <div style="font-size:12px;color:var(--text-muted);margin:10px 0 2px">2.3 Цэвэр хөрөнгө</div>
      ${_acctRow('Нөөц', u['2.3.1'], { indent: 1 })}
      ${_acctRow('Дахин үнэлгээний нэмэгдэл', u['2.3.3'], { indent: 1 })}
      ${_acctRow('Хуримтлагдсан үр дүн', u['2.3.5'], { indent: 1 })}
      ${_acctRow('Цэвэр хөрөнгийн дүн', u['2.3.6_tsever_hurungu'], { bold: true, indent: 1 })}
      <div style="border-top:1px solid var(--border);margin-top:8px"></div>
      ${_acctRow('ӨР ТӨЛБӨР БА ЦЭВЭР ХӨРӨНГИЙН ДҮН', u['2.4_ur_tulbur_ba_tsever_hurungu_niit'], { bold: true })}
    </div>`;
}

// ============================================================
// TAB 2: ҮР ДҮНГИЙН ТАЙЛАН (Income Statement Form A)
// ============================================================
function renderIncomeStatementTab() {
  const el = document.getElementById('acct-income-statement');
  if (!el) return;
  const is = generateIncomeStatementFormA();

  el.innerHTML = `
    <div style="font-size:15px;font-weight:700;margin-bottom:16px">Үр дүнгийн тайлан (Орлого-Зарлага)</div>
    <div class="card mb-16">
      <div style="font-weight:700;margin-bottom:8px">Орлого</div>
      ${_acctRow('Гишүүдийн хураамж', is.orlogo['2'], { indent: 1 })}
      ${_acctRow('Хөтөлбөр, төслийн орлого', is.orlogo['3'], { indent: 1 })}
      ${_acctRow('Бэлэг, хандив, тусламжийн орлого', is.orlogo['4'], { indent: 1 })}
      ${_acctRow('Түрээсийн орлого', is.orlogo['5'], { indent: 1 })}
      ${_acctRow('Хөрөнгө оруулалтын орлого', is.orlogo['6'], { indent: 1 })}
      ${_acctRow('Бусад орлого', is.orlogo['7'], { indent: 1 })}
      ${_acctRow('Нийт орлого', is.orlogo['8_niit_orlogo'], { bold: true })}
    </div>
    <div class="card mb-16">
      <div style="font-weight:700;margin-bottom:8px">Зардал</div>
      ${_acctRow('Бэлэг, хандив ба тусламж', is.zardal['10'], { indent: 1 })}
      ${_acctRow('Хөтөлбөр хэрэгжүүлсний зардал', is.zardal['14'], { indent: 1 })}
      ${_acctRow('Төсөл хэрэгжүүлсний зардал', is.zardal['15'], { indent: 1 })}
      <div style="font-size:12px;color:var(--text-muted);margin:8px 0 2px">Ерөнхий удирдлагын зардал:</div>
      ${_acctRow('Цалин хөлс, шагнал', is.zardal['17'], { indent: 2 })}
      ${_acctRow('Нийгмийн даатгалын шимтгэл', is.zardal['18'], { indent: 2 })}
      ${_acctRow('Засвар үйлчилгээний зардал', is.zardal['19'], { indent: 2 })}
      ${_acctRow('Ашиглалтын зардал', is.zardal['20'], { indent: 2 })}
      ${_acctRow('Албан томилолтын зардал', is.zardal['22'], { indent: 2 })}
      ${_acctRow('Элэгдлийн зардал', is.zardal['24'], { indent: 2 })}
      ${_acctRow('Шуудан холбооны зардал', is.zardal['26'], { indent: 2 })}
      ${_acctRow('Бусад зардал', is.zardal['31'], { indent: 2 })}
      ${_acctRow('Ерөнхий удирдлагын зардлын дүн', is.zardal['16_erunhii_udirdlaga'], { bold: true, indent: 1 })}
      ${_acctRow('Нийт зардал', is.zardal['32_niit_zardal'], { bold: true })}
    </div>
    <div class="card">
      ${_acctRow('Үндсэн үйл ажиллагааны үр дүн', is['33_undsen_uil_ajillagaanii_ur_dun'], { bold: true })}
      ${_acctRow('Үндсэн бус үйл ажиллагааны ашиг (алдагдал)', is['34_undsen_bus_ashig_aldagdal'])}
      <div style="border-top:1px solid var(--border);margin-top:8px"></div>
      ${_acctRow('ТАЙЛАНТ ҮЕИЙН ЦЭВЭР ҮР ДҮН', is['41_tailant_ueiin_tsever_ur_dun'], { bold: true })}
    </div>`;
}

// ============================================================
// TAB 3: МӨНГӨН ГҮЙЛГЭЭНИЙ ТАЙЛАН (Cash Flow Statement)
// ============================================================
function renderCashFlowTab() {
  const el = document.getElementById('acct-cash-flow');
  if (!el) return;
  const cf = generateCashFlowStatement();

  const rowsHtml = (rows) => rows.map(r => _acctRow(r.label, r.amount, { indent: 1 })).join('');

  el.innerHTML = `
    <div class="flex-between mb-16">
      <div style="font-size:15px;font-weight:700">Мөнгөн гүйлгээний тайлан</div>
      <span class="tag ${cf.reconciles ? 'tag-success' : 'tag-danger'}">${cf.reconciles ? '✓ Тохирч байна' : '✗ ЗӨРҮҮТЭЙ БАЙНА'}</span>
    </div>
    <div class="card mb-16">
      <div style="font-weight:700;margin-bottom:8px">1. Үндсэн үйл ажиллагааны мөнгөн гүйлгээ</div>
      ${rowsHtml(cf.operating.rows)}
      ${_acctRow('Үндсэн үйл ажиллагааны цэвэр мөнгөн гүйлгээ', cf.operating.total, { bold: true })}
    </div>
    <div class="card mb-16">
      <div style="font-weight:700;margin-bottom:8px">2. Хөрөнгө оруулалтын үйл ажиллагааны мөнгөн гүйлгээ</div>
      ${cf.investing.rows.length ? rowsHtml(cf.investing.rows) : '<div class="empty-state" style="padding:6px 0">Хөдөлгөөнгүй</div>'}
      ${_acctRow('Хөрөнгө оруулалтын цэвэр мөнгөн гүйлгээ', cf.investing.total, { bold: true })}
    </div>
    <div class="card mb-16">
      <div style="font-weight:700;margin-bottom:8px">3. Санхүүгийн үйл ажиллагааны мөнгөн гүйлгээ</div>
      ${cf.financing.rows.length ? rowsHtml(cf.financing.rows) : '<div class="empty-state" style="padding:6px 0">Хөдөлгөөнгүй</div>'}
      ${_acctRow('Санхүүгийн цэвэр мөнгөн гүйлгээ', cf.financing.total, { bold: true })}
    </div>
    <div class="card">
      ${_acctRow('Бүх цэвэр мөнгөн гүйлгээ', cf['4_niit_tsever_mungun_guilgee'], { bold: true })}
      ${_acctRow('Мөнгөний эхний үлдэгдэл', cf['5_ehnii_uldegdel'])}
      <div style="border-top:1px solid var(--border);margin-top:8px"></div>
      ${_acctRow('Мөнгөний эцсийн үлдэгдэл', cf['6_etssiin_uldegdel'], { bold: true })}
    </div>`;
}

// ============================================================
// TAB 4: ЖУРНАЛ / ДЭВТЭР (General Journal + Ledger by account)
// ============================================================
function populateLedgerAccountSelect() {
  const sel = document.getElementById('acct-ledger-account-select');
  if (!sel) return;
  const grouped = buildAccountTree();
  sel.innerHTML = Object.keys(grouped).map(group =>
    `<optgroup label="${esc(group)}">${grouped[group].map(a => `<option value="${a.code}">${a.code} — ${esc(a.name)}</option>`).join('')}</optgroup>`
  ).join('');
}

function renderJournalLedgerTab() {
  renderLedgerForSelectedAccount();
  renderGeneralJournal();
}

function renderLedgerForSelectedAccount() {
  const sel = document.getElementById('acct-ledger-account-select');
  const el = document.getElementById('acct-ledger-table');
  if (!sel || !el) return;
  const code = sel.value;
  if (!code) { el.innerHTML = ''; return; }
  const ledger = getLedger(code);
  if (!ledger.rows.length) {
    el.innerHTML = '<div class="empty-state">Энэ дансанд хөдөлгөөн алга</div>';
    return;
  }
  el.innerHTML = `
    <table>
      <thead><tr><th>Огноо</th><th>Тайлбар</th><th>Хэн</th><th style="text-align:right">Дт</th><th style="text-align:right">Кт</th><th style="text-align:right">Үлдэгдэл</th></tr></thead>
      <tbody>
        ${ledger.rows.map(r => `<tr>
          <td class="dt-text dt-mono">${esc(r.date)}</td>
          <td class="dt-text">${esc(r.description)}</td>
          <td class="dt-muted">${esc(r.party) || '—'}</td>
          <td class="dt-mono" style="text-align:right">${r.debit ? fmt(r.debit) : ''}</td>
          <td class="dt-mono" style="text-align:right">${r.credit ? fmt(r.credit) : ''}</td>
          <td class="dt-mono" style="text-align:right;font-weight:700">${fmt(r.runningBalance)}</td>
        </tr>`).join('')}
      </tbody>
    </table>
    <div style="padding:10px 0;text-align:right;font-weight:700">Эцсийн үлдэгдэл: ${fmt(ledger.endingBalance)}</div>`;
}

function renderGeneralJournal() {
  const el = document.getElementById('acct-general-journal');
  if (!el) return;
  if (!JOURNAL_ENTRIES.length) { el.innerHTML = '<div class="empty-state">Гүйлгээ алга</div>'; return; }
  el.innerHTML = JOURNAL_ENTRIES.slice().reverse().map(e => `
    <div style="padding:10px 0;border-bottom:1px solid var(--border)">
      <div class="flex-between" style="font-size:12px;color:var(--text-muted)">
        <span>${esc(e.date)} · ${esc(e.description)}</span>
        <span>${esc(e.reference) || ''}</span>
      </div>
      ${e.lines.map(l => `<div style="display:flex;gap:10px;font-size:12px;padding:2px 0 2px 16px">
        <span style="width:70px" class="dt-mono">${esc(l.account)}</span>
        <span style="flex:1;color:var(--text-muted)">${esc(l.party) || ''}</span>
        <span style="width:100px;text-align:right" class="dt-mono">${l.debit ? fmt(l.debit) : ''}</span>
        <span style="width:100px;text-align:right" class="dt-mono">${l.credit ? fmt(l.credit) : ''}</span>
      </div>`).join('')}
    </div>`).join('');
}

// ============================================================
// "НББ ТОХИРГОО" — Админ хуудас: татвар/шимтгэлийн CRUD
// ============================================================
let editingTaxTypeCode = null;

async function renderTaxSettingsPage() {
  const el = document.getElementById('tax-types-list');
  if (!el) return;
  el.innerHTML = '<div class="empty-state">Ачаалж байна...</div>';
  const { data, error } = await sb.from('tax_types').select('*').order('code');
  if (error) { el.innerHTML = '<div class="empty-state">Ачаалахад алдаа гарлаа</div>'; return; }

  if (!data.length) { el.innerHTML = '<div class="empty-state">Татвар/шимтгэл бүртгэгдээгүй байна</div>'; return; }

  el.innerHTML = data.map(t => `
    <div class="card mb-16">
      <div class="flex-between mb-16">
        <div>
          <div style="font-weight:700">${esc(t.name)}</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:2px">Код: ${esc(t.code)} · Суурь данс: ${esc(t.base_account) || '—'}</div>
        </div>
        <div style="display:flex;gap:8px;align-items:center">
          <span class="tag ${t.enabled ? 'tag-success' : ''}" style="cursor:pointer" onclick="toggleTaxTypeEnabled('${esc(t.code)}', ${!t.enabled})">${t.enabled ? 'Идэвхтэй' : 'Идэвхгүй'}</span>
          <button class="btn btn-ghost btn-sm" onclick='openEditTaxType(${JSON.stringify(t).replace(/'/g, "&apos;")})' style="padding:4px;display:inline-flex;align-items:center;color:var(--text-muted)" title="Засах"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 1 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
          <button class="btn btn-ghost btn-sm" onclick="deleteTaxType('${esc(t.code)}')" style="padding:4px;display:inline-flex;align-items:center;color:var(--danger)" title="Устгах"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg></button>
        </div>
      </div>
      ${t.calculation_type === 'split'
        ? `<div class="summary-row"><span class="summary-key" style="padding-left:16px">Ажилтны хувь хэмжээ</span><span class="summary-val">${t.employee_rate_percent}%</span></div>
           <div class="summary-row"><span class="summary-key" style="padding-left:16px">Ажил олгогчийн хувь хэмжээ</span><span class="summary-val">${t.employer_rate_percent}%</span></div>`
        : `<div class="summary-row"><span class="summary-key" style="padding-left:16px">Хувь хэмжээ</span><span class="summary-val">${t.rate_percent}%</span></div>`}
      ${t.note ? `<div style="font-size:11px;color:var(--text-muted);margin-top:8px;line-height:1.5">⚠️ ${esc(t.note)}</div>` : ''}
    </div>`).join('');
}

function onTaxCalcTypeChange() {
  const isSplit = document.getElementById('tax-type-calc-type').value === 'split';
  document.getElementById('tax-type-simple-rate-group').style.display = isSplit ? 'none' : 'block';
  document.getElementById('tax-type-split-rate-group').style.display = isSplit ? 'block' : 'none';
}

function populateTaxBaseAccountSelect(selectedCode) {
  const sel = document.getElementById('tax-type-base-account');
  if (!sel) return;
  const grouped = buildAccountTree();
  sel.innerHTML = '<option value="">— Сонгох —</option>' + Object.keys(grouped).map(group =>
    `<optgroup label="${esc(group)}">${grouped[group].map(a =>
      `<option value="${a.code}" ${a.code === selectedCode ? 'selected' : ''}>${a.code} — ${esc(a.name)}</option>`).join('')}</optgroup>`
  ).join('');
}

function openAddTaxType() {
  editingTaxTypeCode = null;
  document.getElementById('modal-tax-type-title').textContent = 'Шинэ татвар нэмэх';
  document.getElementById('tax-type-code-original').value = '';
  document.getElementById('tax-type-code').value = '';
  document.getElementById('tax-type-code').disabled = false;
  document.getElementById('tax-type-name').value = '';
  document.getElementById('tax-type-calc-type').value = 'simple';
  document.getElementById('tax-type-rate').value = '';
  document.getElementById('tax-type-employee-rate').value = '';
  document.getElementById('tax-type-employer-rate').value = '';
  document.getElementById('tax-type-enabled').checked = false;
  document.getElementById('tax-type-note').value = '';
  populateTaxBaseAccountSelect(null);
  onTaxCalcTypeChange();
  openModal('modal-tax-type');
}

function openEditTaxType(t) {
  editingTaxTypeCode = t.code;
  document.getElementById('modal-tax-type-title').textContent = 'Татвар засах';
  document.getElementById('tax-type-code-original').value = t.code;
  document.getElementById('tax-type-code').value = t.code;
  document.getElementById('tax-type-code').disabled = true; // код — PK тул засварлахгүй
  document.getElementById('tax-type-name').value = t.name;
  document.getElementById('tax-type-calc-type').value = t.calculation_type;
  document.getElementById('tax-type-rate').value = t.rate_percent || '';
  document.getElementById('tax-type-employee-rate').value = t.employee_rate_percent || '';
  document.getElementById('tax-type-employer-rate').value = t.employer_rate_percent || '';
  document.getElementById('tax-type-enabled').checked = !!t.enabled;
  document.getElementById('tax-type-note').value = t.note || '';
  populateTaxBaseAccountSelect(t.base_account);
  onTaxCalcTypeChange();
  openModal('modal-tax-type');
}

async function saveTaxType() {
  const code = document.getElementById('tax-type-code').value.trim();
  const name = document.getElementById('tax-type-name').value.trim();
  if (!code || !name) { toast('Код болон нэрийг бөглөнө үү', 'error'); return; }
  const calcType = document.getElementById('tax-type-calc-type').value;
  const row = {
    code, name, calculation_type: calcType,
    rate_percent: calcType === 'simple' ? (+document.getElementById('tax-type-rate').value || null) : null,
    employee_rate_percent: calcType === 'split' ? (+document.getElementById('tax-type-employee-rate').value || null) : null,
    employer_rate_percent: calcType === 'split' ? (+document.getElementById('tax-type-employer-rate').value || null) : null,
    base_account: document.getElementById('tax-type-base-account').value || null,
    enabled: document.getElementById('tax-type-enabled').checked,
    note: document.getElementById('tax-type-note').value.trim() || null,
  };
  if (calcType === 'simple' && !row.rate_percent) { toast('Хувь хэмжээг оруулна уу', 'error'); return; }
  if (calcType === 'split' && (!row.employee_rate_percent || !row.employer_rate_percent)) { toast('Хоёр талын хувь хэмжээг оруулна уу', 'error'); return; }

  const { error } = await sb.from('tax_types').upsert(row, { onConflict: 'code' });
  if (error) { toast('Хадгалахад алдаа гарлаа: ' + error.message, 'error'); return; }
  closeModal('modal-tax-type');
  toast('Хадгалагдлаа', 'success');
  renderTaxSettingsPage();
}

async function toggleTaxTypeEnabled(code, newValue) {
  const { error } = await sb.from('tax_types').update({ enabled: newValue }).eq('code', code);
  if (error) { toast('Шинэчлэхэд алдаа гарлаа: ' + error.message, 'error'); return; }
  renderTaxSettingsPage();
}

async function deleteTaxType(code) {
  if (!confirm('Энэ татвар/шимтгэлийг устгах уу?')) return;
  const { error } = await sb.from('tax_types').delete().eq('code', code);
  if (error) { toast('Устгахад алдаа гарлаа: ' + error.message, 'error'); return; }
  toast('Устгагдлаа', 'success');
  renderTaxSettingsPage();
}

// ============================================================
// ⚠️ ЭНЭ МОДУЛЬ ЗӨВХӨН ТООЦООЛОЛ ХАРУУЛНА — ямар ч journal entry
// автоматаар үүсгэдэггүй (татварын өглөгийг гараар бүртгэнэ). Учир нь
// нийлбэр дүн дээр суурилсан тооцоолол нь ажилтан бүрийн НДШ хуваарилалт
// тооцоогүй тул ОЙРОЛЦОО байдалтай — нягтлан бодогч эцсийн дүнг хянах ёстой.
async function renderTaxTab() {
  const el = document.getElementById('acct-tax');
  if (!el) return;
  const { data: taxTypes, error } = await sb.from('tax_types').select('*').order('code');
  if (error) { el.innerHTML = '<div class="empty-state">Татварын тохиргоо ачаалахад алдаа гарлаа</div>'; return; }

  const rows = (taxTypes || []).map(t => {
    const base = t.base_account ? getAccountBalance(t.base_account).balance : 0;
    if (t.calculation_type === 'split') {
      const employeeAmt = +(base * (t.employee_rate_percent || 0) / 100).toFixed(2);
      const employerAmt = +(base * (t.employer_rate_percent || 0) / 100).toFixed(2);
      return `
      <div class="card mb-16" style="opacity:${t.enabled ? 1 : 0.55}">
        <div class="flex-between mb-16">
          <div style="font-weight:700">${esc(t.name)}</div>
          <span class="tag ${t.enabled ? 'tag-success' : ''}">${t.enabled ? 'Идэвхтэй' : 'Идэвхгүй'}</span>
        </div>
        ${_acctRow('Суурь данс (' + (t.base_account || '—') + ') үлдэгдэл', base, { indent: 1 })}
        <div class="summary-row"><span class="summary-key" style="padding-left:16px">Ажилтны хувь (${t.employee_rate_percent}%)</span><span class="summary-val">${fmt(employeeAmt)}</span></div>
        <div class="summary-row"><span class="summary-key" style="padding-left:16px">Ажил олгогчийн хувь (${t.employer_rate_percent}%)</span><span class="summary-val">${fmt(employerAmt)}</span></div>
        <div style="border-top:1px solid var(--border);margin:8px 0"></div>
        ${_acctRow('ОЙРОЛЦОО тооцоолсон нийт', employeeAmt + employerAmt, { bold: true })}
        ${t.note ? `<div style="font-size:11px;color:var(--text-muted);margin-top:8px;line-height:1.5">⚠️ ${esc(t.note)}</div>` : ''}
      </div>`;
    }
    const estimate = +(base * (t.rate_percent || 0) / 100).toFixed(2);
    return `
    <div class="card mb-16" style="opacity:${t.enabled ? 1 : 0.55}">
      <div class="flex-between mb-16">
        <div style="font-weight:700">${esc(t.name)}</div>
        <span class="tag ${t.enabled ? 'tag-success' : ''}">${t.enabled ? 'Идэвхтэй' : 'Идэвхгүй'}</span>
      </div>
      ${_acctRow('Суурь данс (' + (t.base_account || '—') + ') үлдэгдэл', base, { indent: 1 })}
      <div class="summary-row"><span class="summary-key" style="padding-left:16px">Хувь хэмжээ</span><span class="summary-val">${t.rate_percent}%</span></div>
      <div style="border-top:1px solid var(--border);margin:8px 0"></div>
      ${_acctRow('ОЙРОЛЦОО тооцоолсон татвар', estimate, { bold: true })}
      ${t.note ? `<div style="font-size:11px;color:var(--text-muted);margin-top:8px;line-height:1.5">⚠️ ${esc(t.note)}</div>` : ''}
    </div>`;
  }).join('');

  el.innerHTML = `
    <div style="font-size:15px;font-weight:700;margin-bottom:6px">Татварын тайлан (ойролцоо тооцоолол)</div>
    <div style="font-size:12px;color:var(--text-muted);margin-bottom:16px">
      Эдгээр тоо баримт нь ЗӨВХӨН тооцооллын зориулалттай — ямар ч journal entry автоматаар үүсгэдэггүй.
      Татварын өглөгийг (3020 данс) бодит гэрээ/тайлангийн дагуу гараар бүртгэнэ.
    </div>
    ${rows || '<div class="empty-state">Татварын тохиргоо алга</div>'}`;
}

