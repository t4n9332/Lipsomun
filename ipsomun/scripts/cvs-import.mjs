#!/usr/bin/env node
/**
 * 편의점 행사 데이터를 CSV/JSON 에서 불러온다 — 주로 '지난달' 데이터를 채워 버프/너프를 바로 켜는 용도.
 *
 * 공식 사이트에는 이번 달 행사만 떠 있어서, 수집을 처음 시작한 달에는 비교할 지난달이 없다.
 * 지난달 목록(엑셀에서 정리한 표 등)을 CSV 로 저장해 넣으면 그 즉시 /cvs/patch 와 쇼츠가 열린다.
 *
 *   node scripts/cvs-import.mjs 지난달.csv                 # → data/cvs/previous.json (월은 이번 달의 전달)
 *   node scripts/cvs-import.mjs 지난달.csv --month=2026-10
 *   node scripts/cvs-import.mjs 이번달수정.csv --target=current   # 이번 달 데이터를 손으로 고칠 때
 *
 * CSV 형식 (UTF-8, 첫 줄은 머리글 — 열 순서는 상관없음)
 *   편의점,상품명,가격,행사
 *   GS25,몬스터 울트라 355ml,2700,1+1
 *   CU,핫식스 더킹 355ml,1900,2+1
 *
 *   편의점: GS25 / CU / 세븐일레븐(세븐, 7-11) / 이마트24(emart24)
 *   행사:   1+1 / 2+1 / 3+1 / 덤(증정)
 * JSON 이면 [{ "b": "gs25", "n": "...", "p": 2700, "t": "1+1" }] 또는 { "items": [...] }.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data", "cvs");
const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--"));
const flag = (k) => args.find((a) => a.startsWith(`--${k}=`))?.split("=")[1];
const target = flag("target") === "current" ? "current" : "previous";

if (!file || !fs.existsSync(file)) {
  console.error("사용법: node scripts/cvs-import.mjs <파일.csv|json> [--month=YYYY-MM] [--target=current]");
  process.exit(1);
}

const BRAND = (s) => {
  const v = String(s).toLowerCase().replace(/[\s\-_]/g, "");
  if (/^(gs25|gs|지에스)/.test(v)) return "gs25";
  if (/^(cu|씨유)/.test(v)) return "cu";
  if (/^(세븐|seven|711|7eleven|세븐일레븐)/.test(v)) return "seven";
  if (/^(이마트|emart)/.test(v)) return "emart24";
  return null;
};
const TYPE = (s) => {
  const m = String(s).replace(/\s/g, "").match(/([123])\+1/);
  return m ? `${m[1]}+1` : "덤";
};

/** 따옴표·쉼표가 섞인 CSV 한 줄 파싱 */
function splitCsv(line) {
  const out = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function readItems() {
  const raw = fs.readFileSync(file, "utf8").replace(/^﻿/, ""); // 엑셀 BOM
  if (file.toLowerCase().endsWith(".json")) {
    const j = JSON.parse(raw);
    return (Array.isArray(j) ? j : j.items || []).map((x) => ({
      b: BRAND(x.b ?? x.brand ?? x.편의점), n: String(x.n ?? x.name ?? x.상품명 ?? "").trim(),
      p: Number(String(x.p ?? x.price ?? x.가격 ?? "").replace(/[^0-9]/g, "")), t: TYPE(x.t ?? x.type ?? x.행사),
      ...(x.img ? { img: x.img } : {}),
    }));
  }
  const lines = raw.split(/\r?\n/).filter((l) => l.trim());
  const head = splitCsv(lines[0]).map((h) => h.replace(/\s/g, ""));
  const col = (...names) => head.findIndex((h) => names.includes(h));
  const ib = col("편의점", "브랜드", "brand", "b");
  const iname = col("상품명", "상품", "name", "n");
  const ip = col("가격", "정가", "price", "p");
  const it = col("행사", "행사종류", "type", "t");
  if ([ib, iname, ip, it].some((i) => i < 0)) {
    console.error(`머리글에 편의점·상품명·가격·행사 열이 모두 있어야 합니다. 지금: ${head.join(", ")}`);
    process.exit(1);
  }
  return lines.slice(1).map((l) => {
    const c = splitCsv(l);
    return { b: BRAND(c[ib]), n: c[iname], p: Number(String(c[ip]).replace(/[^0-9]/g, "")), t: TYPE(c[it]) };
  });
}

const all = readItems();
const items = all.filter((x) => x.b && x.n && x.p > 0);
const skipped = all.length - items.length;
if (!items.length) {
  console.error("읽은 상품이 없습니다 — 형식을 확인하세요.");
  process.exit(1);
}

const cur = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "current.json"), "utf8"));
const prevMonth = (m) => {
  if (!m) return "";
  const [y, mo] = m.split("-").map(Number);
  return mo === 1 ? `${y - 1}-12` : `${y}-${String(mo - 1).padStart(2, "0")}`;
};
const month = flag("month") || (target === "previous" ? prevMonth(cur.month) : cur.month);
if (!/^\d{4}-\d{2}$/.test(month || "")) {
  console.error("월을 알 수 없습니다 — --month=YYYY-MM 으로 지정하세요.");
  process.exit(1);
}

const outFile = path.join(DATA_DIR, `${target}.json`);
fs.writeFileSync(
  outFile,
  JSON.stringify({ month, generated_at: new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 16) + "+09:00", items })
);
const by = items.reduce((m, x) => ((m[x.b] = (m[x.b] || 0) + 1), m), {});
console.log(`저장: ${path.relative(process.cwd(), outFile)} — ${month}, ${items.length}개`, by);
if (skipped) console.warn(`⚠ 형식이 맞지 않아 건너뛴 줄 ${skipped}개 (편의점 이름·가격 확인)`);
