// 임시 진단 3: 우리동네GS 웹(woodongs.com)의 공개 JS 번들에서 API 서버·행사 관련 경로를 찾는다 (읽기만).
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130 Safari/537.36";
const get = async (u) => { const r = await fetch(u, { headers: { "User-Agent": UA } }); return [r.status, await r.text()]; };

const [, html] = await get("https://www.woodongs.com/");
console.log("== 메인 HTML (앞 1500자) ==\n" + html.replace(/\s+/g, " ").slice(0, 1500));
const [, land] = await get("https://www.woodongs.com/landing/index.html");
console.log("\n== landing HTML (앞 1500자) ==\n" + land.replace(/\s+/g, " ").slice(0, 1500));

const scripts = [...new Set([...(html + land).matchAll(/src="([^"]+\.js)"/g)].map((m) => new URL(m[1], "https://www.woodongs.com/").href))];
console.log("\n== 스크립트 ==", scripts.join(" "));
for (const s of scripts) {
  const [st, js] = await get(s);
  console.log(`\n## ${s} (${st}, ${js.length}자)`);
  const hosts = [...new Set(js.match(/https?:\/\/[a-z0-9.\-]+(?:woodongs|gsretail|gs25|gsshop)[a-z0-9.\-]*[^"'`\s]{0,80}/gi) || [])];
  console.log("  호스트:", hosts.slice(0, 40).join(" "));
  const paths = [...new Set(js.match(/["'`]\/[a-zA-Z0-9_\-\/{}.:]{3,120}["'`]/g) || [])].filter((p) => /api|event|goods|product|promo|deal|plus|gift|benefit|item|store/i.test(p));
  console.log(`  경로(${paths.length}):`, paths.slice(0, 120).join(" "));
  const ctx = (js.match(/.{0,80}(?:eventGoods|event_goods|evtGoods|ONE_TO_ONE|TWO_TO_ONE|oneToOne|1\+1).{0,120}/g) || []).slice(0, 8);
  if (ctx.length) console.log("  행사 문맥:", ctx.join(" ||| "));
  const env = (js.match(/.{0,40}(?:API_URL|apiUrl|BASE_URL|baseURL|REACT_APP_[A-Z_]+).{0,120}/g) || []).slice(0, 10);
  if (env.length) console.log("  설정:", env.join(" ||| "));
}
