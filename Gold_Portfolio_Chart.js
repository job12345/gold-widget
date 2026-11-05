/*
 GOLD PORTFOLIO CHART
 Scriptable iOS - Medium Widget
 Version 2.1
 MasterDiY by.วชิร อัคร
 https://job12345.github.io/gold-widget/
 ข้อมูลพอร์ตเก็บในเครื่องเท่านั้น ไม่ใช่ราคาซื้อขายทองไทย
 FX: https://www.exchangerate-api.com (อัตราอ้างอิงรายวัน)

 ต้นทุนรวม USD + จำนวนทอง Troy oz
 จำนวนทองต้องเป็นออนซ์เทียบเท่าทองบริสุทธิ์
*/

const fm = FileManager.local();
const dir = fm.documentsDirectory();

const settingsPath = fm.joinPath(dir, "gold-settings.json");
const historyPath = fm.joinPath(dir, "gold-history.json");
const cachePath = fm.joinPath(dir, "gold-cache.json");

const DEFAULTS = {
  name: "MY GOLD PORTFOLIO",
  cost: 0,
  oz: 0
};

const C = {
  bg: "#091727",
  bg2: "#12344D",
  gold: "#F3CB78",
  white: "#FFFFFF",
  muted: "#A8C0D3",
  green: "#69F0AE",
  red: "#FF8585",
  grid: "#34516A"
};

function readJSON(path, fallback) {
  try {
    if (fm.fileExists(path)) {
      return JSON.parse(fm.readString(path));
    }
  } catch (e) {
    console.log("Read error: " + e.message);
  }
  return fallback;
}

function writeJSON(path, data) {
  fm.writeString(path, JSON.stringify(data));
}

function fmt(n, digits = 2) {
  return Number(n).toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
}

function signed(n, digits = 2) {
  return (n >= 0 ? "+" : "-") +
    fmt(Math.abs(n), digits);
}

async function fetchJSON(url) {
  const r = new Request(url);
  r.timeoutInterval = 15;
  return await r.loadJSON();
}

async function fetchMarket() {
  const cache = readJSON(cachePath, {}) || {};
  let { gold, fx, updated, fxUpdated } = cache;
  let goldLive = false, fxLive = false;
  // ดึงสองแหล่งพร้อมกัน และเก็บเวลาของแต่ละแหล่งแยกกัน
  await Promise.all([
    (async () => {
      try {
        const r = await fetchJSON("https://api.gold-api.com/price/XAU");
        if (Number.isFinite(r.price) && r.price > 0 && Number.isFinite(Date.parse(r.updatedAt))) {
          gold = r.price; updated = r.updatedAt; goldLive = true;
        }
      } catch (e) { console.log("Gold API: " + e.message); }
    })(),
    (async () => {
      try {
        const r = await fetchJSON("https://open.er-api.com/v6/latest/USD");
        if (r.result === "success" && Number.isFinite(r.rates?.THB) && r.rates.THB > 0 && r.time_last_update_unix > 0) {
          fx = r.rates.THB;
          fxUpdated = new Date(r.time_last_update_unix * 1000).toISOString();
          fxLive = true;
        }
      } catch (e) { console.log("FX API: " + e.message); }
    })()
  ]);
  writeJSON(cachePath, { gold, fx, updated, fxUpdated });
  if (!(Number.isFinite(gold) && gold > 0 && Number.isFinite(fx) && fx > 0)) return null;
  const stale = !goldLive || !fxLive || !Number.isFinite(Date.parse(updated)) ||
    Date.now() - Date.parse(updated) > 3600000 ||
    !Number.isFinite(Date.parse(fxUpdated)) || Date.now() - Date.parse(fxUpdated) > 48 * 3600000;
  return { gold, fx, updated, fxUpdated, goldLive, fxLive, stale };
}

function saveHistory(price, timestamp) {
  let history = readJSON(historyPath, []);

  if (!Array.isArray(history)) history = [];

  const now = Date.now();
  const ts = Date.parse(timestamp || "");

  const time = Number.isFinite(ts) ? ts : now;
  if (time < now - 7 * 86400000 || time > now + 60000) return history;

  history = history.filter(p =>
    Number.isFinite(p.t) &&
    Number.isFinite(p.p) &&
    p.p > 0 &&
    p.t >= now - 7 * 86400000 &&
    p.t <= now + 60000
  );

  const last = history[history.length - 1];

  if (!last || time - last.t >= 10 * 60000) {
    history.push({ t: time, p: price });
  } else if (time >= last.t) {
    history[history.length - 1] = {
      t: time,
      p: price
    };
  }

  history.sort((a, b) => a.t - b.t);

  // จำกัดข้อมูลเพื่อไม่ให้ไฟล์ใหญ่เกินไป
  if (history.length > 1200) {
    history = history.slice(-1200);
  }

  writeJSON(historyPath, history);
  return history;
}

async function editSettings(old) {
  const a = new Alert();
  a.title = "ตั้งค่าพอร์ตทองคำ";
  a.message =
    "กรอกต้นทุนรวม USD และจำนวนทอง Troy oz";

  a.addTextField("ชื่อพอร์ต", old.name);
  a.addTextField("ต้นทุนรวม USD", String(old.cost));
  a.addTextField("จำนวนทอง Troy oz", String(old.oz));

  a.addAction("บันทึก");
  a.addCancelAction("ยกเลิก");

  if (await a.presentAlert() === -1) return old;

  const next = {
    name: a.textFieldValue(0).trim() ||
      DEFAULTS.name,
    cost: a.textFieldValue(1).trim() === "" ? NaN : Number(
      a.textFieldValue(1).replace(/,/g, "")
    ),
    oz: Number(
      a.textFieldValue(2).replace(/,/g, "")
    )
  };

  if (!Number.isFinite(next.cost) ||
      next.cost < 0 ||
      !Number.isFinite(next.oz) ||
      next.oz <= 0) {
    const error = new Alert();
    error.title = "ข้อมูลไม่ถูกต้อง";
    error.message = "กรุณากรอกตัวเลขใหม่";
    error.addAction("ตกลง");
    await error.presentAlert();
    return old;
  }

  writeJSON(settingsPath, next);
  return next;
}

function text(stack, value, size, color, bold = false) {
  const t = stack.addText(String(value));
  t.font = bold
    ? Font.boldSystemFont(size)
    : Font.systemFont(size);
  t.textColor = new Color(color);
  t.lineLimit = 1;
  t.minimumScaleFactor = 0.6;
  return t;
}

// สร้างกราฟด้วย DrawContext
function createChart(history, currentPrice) {
  const width = 640;
  const height = 160;

  const dc = new DrawContext();
  dc.size = new Size(width, height);
  dc.opaque = false;
  dc.respectScreenScale = true;

  if (history.length < 2) {
    dc.setTextColor(new Color(C.muted));
    dc.setFont(Font.systemFont(22));
    dc.drawTextInRect(
      "กำลังสะสมข้อมูลกราฟ...",
      new Rect(110, 60, 440, 45)
    );
    return dc.getImage();
  }

  const prices = history.map(x => x.p);
  let min = Math.min(...prices);
  let max = Math.max(...prices);

  const range = max - min || 1;
  const padding = range * 0.18;

  min -= padding;
  max += padding;

  const left = 5;
  const right = width - 10;
  const top = 10;
  const bottom = height - 12;

  const firstT = history[0].t;
  const lastT = history[history.length - 1].t;
  const duration = Math.max(lastT - firstT, 1);

  function xy(item) {
    const x = left +
      (item.t - firstT) / duration *
      (right - left);

    const y = bottom -
      (item.p - min) / (max - min) *
      (bottom - top);

    return new Point(x, y);
  }

  // เส้น Grid
  dc.setStrokeColor(new Color(C.grid, 0.45));
  dc.setLineWidth(1);

  for (let i = 1; i <= 3; i++) {
    const y = top + (bottom - top) * i / 4;
    const line = new Path();
    line.move(new Point(left, y));
    line.addLine(new Point(right, y));
    dc.addPath(line);
    dc.strokePath();
  }

  // พื้นที่ใต้กราฟ ไล่ระดับความเข้ม
  const points = history.map(xy);

  const area = new Path();
  area.move(new Point(points[0].x, bottom));

  for (const p of points) {
    area.addLine(p);
  }

  area.addLine(
    new Point(points[points.length - 1].x, bottom)
  );
  area.closeSubpath();

  dc.addPath(area);
  dc.setFillColor(new Color(C.gold, 0.13));
  dc.fillPath();

  // เส้นกราฟสีทอง
  const path = new Path();
  path.move(points[0]);

  for (let i = 1; i < points.length; i++) {
    path.addLine(points[i]);
  }

  dc.addPath(path);
  dc.setStrokeColor(new Color(C.gold));
  dc.setLineWidth(4);
  dc.strokePath();

  // จุดราคาล่าสุด
  const last = points[points.length - 1];

  dc.setFillColor(new Color(C.gold, 0.18));
  dc.fillEllipse(
    new Rect(last.x - 12, last.y - 12, 24, 24)
  );

  dc.setFillColor(new Color(C.gold));
  dc.fillEllipse(
    new Rect(last.x - 5, last.y - 5, 10, 10)
  );

  return dc.getImage();
}

function createWidget(settings, market, history) {
  const w = new ListWidget();

  w.setPadding(10, 14, 10, 14);
  w.url = "scriptable:///run?scriptName=" + encodeURIComponent(Script.name());
  w.refreshAfterDate = new Date(Date.now() + 15 * 60 * 1000);
  if (!(settings.oz > 0)) {
    w.backgroundColor = new Color(C.bg);
    text(w, "✦ GOLD PORTFOLIO", 14, C.gold, true);
    w.addSpacer(12);
    text(w, "แตะเพื่อตั้งค่าพอร์ตของคุณ", 14, C.white);
    text(w, "ต้นทุนรวม USD • จำนวนทอง Troy oz", 10, C.muted);
    return w;
  }

  const bg = new LinearGradient();
  bg.colors = [
    new Color(C.bg),
    new Color(C.bg2),
    new Color(C.bg)
  ];
  bg.locations = [0, 0.5, 1];
  w.backgroundGradient = bg;

  const header = w.addStack();
  header.centerAlignContent();

  text(
    header,
    "✦ GOLD PORTFOLIO",
    13,
    C.gold,
    true
  );

  header.addSpacer();

  text(
    header,
    market && !market.stale ? "● อ้างอิง" : "● ข้อมูลเก่า",
    9,
    market && !market.stale ? C.green : C.gold,
    true
  );

  w.addSpacer(5);

  if (!market) {
    text(
      w,
      "ไม่สามารถโหลดราคาทองคำได้",
      13,
      C.red
    );
    text(
      w,
      "ตรวจสอบอินเทอร์เน็ต",
      11,
      C.muted
    );
    return w;
  }

  const value = market.gold * settings.oz;
  const profit = value - settings.cost;
  const profitTHB = profit * market.fx;

  const percent = settings.cost > 0
    ? profit / settings.cost * 100
    : null;

  const profitColor = profit >= 0
    ? C.green
    : C.red;

  const topRow = w.addStack();
  topRow.layoutHorizontally();
  topRow.bottomAlignContent();

  const priceCol = topRow.addStack();
  priceCol.layoutVertically();

  text(
    priceCol,
    "XAU / USD · SPOT",
    9,
    C.muted
  );

  text(
    priceCol,
    "$" + fmt(market.gold),
    22,
    C.white,
    true
  );

  topRow.addSpacer();

  const gainCol = topRow.addStack();
  gainCol.layoutVertically();

  text(
    gainCol,
    "กำไร / ขาดทุน",
    9,
    C.muted
  );

  text(
    gainCol,
    signed(profit),
    18,
    profitColor,
    true
  );

  w.addSpacer(3);

  const chartImage = createChart(
    history,
    market.gold
  );

  const chart = w.addImage(chartImage);
  chart.imageSize = new Size(280, 38);
  chart.centerAlignImage();

  w.addSpacer(3);

  const info = w.addStack();
  info.layoutHorizontally();

  const left = info.addStack();
  left.layoutVertically();

  text(
    left,
    "≈ ฿" + fmt(market.gold * market.fx) +
    " / oz",
    10,
    C.muted
  );

  text(
    left,
    "ทุน $" + fmt(settings.cost) +
    " · " + fmt(settings.oz, 5) + " oz",
    10,
    C.gold
  );

  info.addSpacer();

  const right = info.addStack();
  right.layoutVertically();

  text(
    right,
    signed(profitTHB) + " ฿",
    12,
    profitColor,
    true
  );

  text(
    right,
    percent === null
      ? "ผลตอบแทน —"
      : signed(percent) + "%",
    10,
    profitColor
  );

  w.addSpacer(4);

  const footer = w.addStack();
  footer.layoutHorizontally();

  text(
    footer,
    "USD/THB " + fmt(market.fx, 4),
    9,
    C.muted
  );

  footer.addSpacer();

  let updatedText = "ไม่ทราบเวลา";

  if (market.updated) {
    const date = new Date(market.updated);

    if (!isNaN(date.getTime())) {
      updatedText = date.toLocaleString("th-TH", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
      });
    }
  }

  text(
    footer,
    "ทอง " + updatedText,
    9,
    C.muted
  );

  w.url =
    "scriptable:///run?scriptName=" +
    encodeURIComponent(Script.name());

  w.refreshAfterDate = new Date(
    Date.now() + 15 * 60 * 1000
  );

  text(w, "FX " + (market.fxUpdated ? new Date(market.fxUpdated).toLocaleDateString("th-TH", {day:"2-digit", month:"2-digit"}) : "ไม่ทราบวันที่"), 8, C.muted);
  return w;
}

// MAIN
let settings = readJSON(settingsPath, null);

if (!settings || !Number.isFinite(settings.cost) || settings.cost < 0 || !Number.isFinite(settings.oz) || settings.oz <= 0 || typeof settings.name !== "string") {
  if (config.runsInWidget) {
    settings = DEFAULTS;
  } else {
    settings = await editSettings(DEFAULTS);
  }
} else if (!config.runsInWidget) {
  const menu = new Alert();
  menu.title = "Gold Portfolio";
  menu.message = "จัดการพอร์ตทองคำของคุณ";

  menu.addAction("แก้ไขต้นทุน / จำนวนทอง");
  menu.addAction("ดูวิดเจ็ต");
  menu.addCancelAction("ยกเลิก");

  const choice = await menu.presentSheet();

  if (choice === 0) {
    settings = await editSettings(settings);
  } else if (choice === -1) {
    Script.complete();
    return;
  }
}

const market = settings.oz > 0 ? await fetchMarket() : null;

let history = readJSON(historyPath, []);
if (!Array.isArray(history)) history = [];
history = history.filter(p => p && Number.isFinite(p.t) && Number.isFinite(p.p) && p.p > 0 && p.t >= Date.now() - 7 * 86400000 && p.t <= Date.now() + 60000).sort((a,b) => a.t-b.t);

if (market && market.goldLive) {
  history = saveHistory(
    market.gold,
    market.updated
  );
}

const widget = createWidget(
  settings,
  market,
  history
);

if (config.runsInWidget) {
  Script.setWidget(widget);
} else {
  await widget.presentMedium();
}

Script.complete();

