
const BASE = "https://lucky-numbers.ru";
const LATEST = BASE + "/lottery/ru/keno2/latest-result";
const MONTHS = {"января":"01","февраля":"02","марта":"03","апреля":"04","мая":"05","июня":"06","июля":"07","августа":"08","сентября":"09","октября":"10","ноября":"11","декабря":"12"};

function textFromHtml(html) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}
function parseDate(s) {
  const m = s.match(/(\d{1,2})\s+([а-яё]+)\s+(\d{4})/i);
  if (!m) return "";
  return m[1].padStart(2,"0")+"."+(MONTHS[m[2].toLowerCase()]||"01")+"."+m[3];
}
function parsePage(html, url) {
  const text = textFromHtml(html);
  const dm = text.match(/Результаты\s+тиража\s*№\s*([\d\s]+)/i);
  if (!dm) throw new Error("Не найден номер тиража");
  const draw = Number(dm[1].replace(/\s/g,""));
  const meta = text.match(/Тираж\s*№\s*[\d\s]+\s+лотереи\s+КЕНО\s+от\s+(.+?)\s+в\s+(\d{1,2}:\d{2})/i);
  const date = meta ? parseDate(meta[1]) : "";
  const time = meta ? meta[2] : "";
  const nm = text.match(/Выпавшие\s+числа\s+((?:\d{1,2}\s+){19}\d{1,2})/i);
  if (!nm) throw new Error("Не найдены 20 чисел тиража " + draw);
  const balls = nm[1].trim().split(/\s+/).map(Number);
  let prevUrl = "";
  const re = /href=["']([^"']+)["'][^>]*>\s*(?:<[^>]+>\s*)*Тираж\s*№\s*([\d\s]+)/gi;
  let m;
  while ((m = re.exec(html))) {
    const linked = Number(m[2].replace(/\s/g,""));
    if (linked === draw - 1) {
      prevUrl = m[1].startsWith("http") ? m[1] : BASE + (m[1].startsWith("/") ? "" : "/") + m[1];
      break;
    }
  }
  return {draw,date,time,balls,sourceUrl:url,prevUrl};
}
async function getHtml(url) {
  const r = await fetch(url,{headers:{"user-agent":"Mozilla/5.0 PozitronKeno/3.0","accept-language":"ru-RU,ru;q=0.9"},redirect:"follow"});
  if (!r.ok) throw new Error("Lucky Numbers ответил " + r.status);
  return r.text();
}
exports.handler = async (event) => {
  const headers = {"content-type":"application/json; charset=utf-8","access-control-allow-origin":"*","cache-control":"no-store"};
  try {
    const after = Math.max(0,Number(event.queryStringParameters?.after||0));
    const max = Math.min(40,Math.max(1,Number(event.queryStringParameters?.max||25)));
    const draws=[]; let url=LATEST; const visited=new Set();
    for (let i=0;i<max && url && !visited.has(url);i++) {
      visited.add(url);
      const item=parsePage(await getHtml(url),url);
      if (item.draw<=after) break;
      draws.push({draw:item.draw,date:item.date,time:item.time,balls:item.balls,sourceUrl:item.sourceUrl});
      url=item.prevUrl;
    }
    draws.sort((a,b)=>a.draw-b.draw);
    return {statusCode:200,headers,body:JSON.stringify({ok:true,count:draws.length,draws,checkedAt:new Date().toISOString()})};
  } catch (e) {
    return {statusCode:502,headers,body:JSON.stringify({ok:false,error:e.message,checkedAt:new Date().toISOString()})};
  }
};
