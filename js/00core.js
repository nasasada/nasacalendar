// 00core.js - 共通カレンダー描画・イベント処理

const now = new Date();
let currentYear = now.getFullYear();
let currentMonth = now.getMonth(); // 0-11
const calendarEl = document.getElementById("calendar"); // クラス名に合わせて修正

// Google Calendar API
let calendarId;
let apiKey;
const holidayCalendarId = "japanese__ja@holiday.calendar.google.com";

const colorMap = {
  "1": "#2952A3",  // 青
  "4": "#d94e3b",  // 朱色
  "5": "#FBD75B",  // 黄
  "6": "#FF9900",  // オレンジ
  "9": "#4A86E8",  // 水色
  "11": "#A7A7A7"  // 灰色
};

const THUMBS = {
  "nasa": "https://github.com/nasasada/nasacalendar/raw/main/nasa.jpg",
  "dot-blue": "https://github.com/nasasada/nasacalendar/raw/main/img/dotblue3.jpg",
  "room": "https://github.com/nasasada/nasacalendar/raw/main/img/room.jpg" ,
  "buzz": "https://github.com/nasasada/nasacalendar/raw/main/img/BUZZ.jpg"
};

const excludeHolidays = ["節分","雛祭り","母の日","七夕","七五三","クリスマス","銀行休業日"];

// --- API Fetch ---
async function fetchEvents(year, month) {
  const startDate = new Date(year, month, -6);
  const endDate = new Date(year, month + 1, 7);
  startDate.setHours(0,0,0,0);
  endDate.setHours(23,59,59,999);

  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?key=${apiKey}&timeMin=${startDate.toISOString()}&timeMax=${endDate.toISOString()}&singleEvents=true&orderBy=startTime`;
  const res = await fetch(url);
  const data = await res.json();
  return data.items;
}

async function fetchHolidays(year, month) {
  const startDate = new Date(year, month, 1).toISOString();
  const endDate = new Date(year, month + 1, 0).toISOString();
  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(holidayCalendarId)}/events?key=${apiKey}&timeMin=${startDate}&timeMax=${endDate}&singleEvents=true&orderBy=startTime`;
  const res = await fetch(url);
  const data = await res.json();
  return data.items.filter(ev => !excludeHolidays.includes(ev.summary));
}

// --- Utils ---
function formatDateKey(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth()+1).padStart(2,'0');
  const dd = String(date.getDate()).padStart(2,'0');
  return `${yyyy}-${mm}-${dd}`;
}



// --- カレンダー描画 ---
async function renderCalendar(year, month){
  calendarEl.innerHTML="";

  // 曜日ヘッダー
  const weekdays = ["月","火","水","木","金","土","日"];
  const headerRow = document.createElement("div");
  headerRow.className = "weekday-row";

  weekdays.forEach((day,i)=>{
    const header = document.createElement("div");
    header.className="weekday-header";
    if(i===5) header.classList.add("sat");
    if(i===6) header.classList.add("sun");
    header.textContent=day;
    headerRow.appendChild(header);
  });
  
  calendarEl.appendChild(headerRow);

  const firstDay = new Date(year, month, 1);
  const startDay = (firstDay.getDay() + 6) % 7; // 月曜始まり
  const daysInMonth = new Date(year, month+1,0).getDate();

  document.getElementById("monthYear").textContent = `${year}.${month+1}`;

  // 📌 カレンダー本体を週ごとに包む
  let weekEl = document.createElement("div");
  weekEl.className = "calendar-week";


  // 前月残り日
  const prevMonth = month-1 <0 ? 11 : month-1;
  const prevYear = month-1<0 ? year-1 : year;
  const prevMonthLastDate = new Date(prevYear, prevMonth+1,0).getDate();
  // 前月残り日生成ループ
  for(let i=0;i<startDay;i++){
    const date=new Date(prevYear, prevMonth, prevMonthLastDate-startDay+i+1);
    addDayCell(date, true, weekEl);
  }

  // 当月
  for(let d=1; d<=daysInMonth; d++){
    const date = new Date(year, month, d);
    addDayCell(date, false, weekEl);

    // 日曜で週を閉じる
    if(date.getDay() === 0){
      calendarEl.appendChild(weekEl);
      weekEl = document.createElement("div");
      weekEl.className = "calendar-week";
    }
  }

  // 最後の週が残ってたら追加
  if(weekEl.children.length>0){
    calendarEl.appendChild(weekEl);
  }


  // イベント・祝日取得
  const events = await fetchEvents(year, month);

  // 単日イベントと複数日イベントで分ける
  events.forEach(ev=>{
    const startDate = new Date(ev.start.dateTime || ev.start.date);
    const endDate = new Date(ev.end.dateTime || ev.end.date);
    if(!ev.start.dateTime && !ev.end.dateTime) endDate.setDate(endDate.getDate()-1);

    if(formatDateKey(startDate) !== formatDateKey(endDate)){
      renderMultiDayEvents(ev);  // 帯描画
    } else {
      renderSingleEvent(ev);      // 既存の renderEvents() 処理
    }
  });

  const holidays = await fetchHolidays(year, month);
  markHolidays(holidays);


  markToday();          // 本日マーク
  adjustWeekHeights();  // 週ごと高さ調整
  addPopupListeners();  // ポップアップ

}






// --- 日セル生成 ---
// 追加引数 weekDiv を受け取る
function addDayCell(date, isPrevNext=false, weekEl){
  const div = document.createElement("div");
  div.className="day";
  if(isPrevNext) div.classList.add("other-month");
  div.setAttribute("data-day", formatDateKey(date));

  const dow = date.getDay();
  if(dow===0) div.classList.add("sun");
  if(dow===6) div.classList.add("sat");

  const labelWrapper = document.createElement("div");
  labelWrapper.className="date-label-wrapper";
  const dateNumber = document.createElement("span");
  dateNumber.className="date-number";
  dateNumber.textContent=date.getDate();
  labelWrapper.appendChild(dateNumber);
  div.appendChild(labelWrapper);
  
  // 複数日イベント用コンテナ
  const multiContainer = document.createElement("div");
  multiContainer.className="multi-day-container";
  div.appendChild(multiContainer);

  // 単日イベント用コンテナ
  const singleContainer = document.createElement("div");
  singleContainer.className="single-event-container";
  div.appendChild(singleContainer);

  weekEl.appendChild(div);
}











// --- 単日イベント描画 ---
function renderSingleEvent(ev){
  const start = ev.start.dateTime || ev.start.date;
  let startDate;
  if(ev.start.dateTime){
    // 時間指定イベント → UTC→JST補正
    startDate = new Date(new Date(start).getTime() + 9*60*60*1000);
  }else{
    // 終日イベント → JSTそのまま
    startDate = new Date(start + "T00:00:00+09:00");
  }

  const key = formatDateKey(startDate);
  const cell = document.querySelector(`.day[data-day="${key}"] .single-event-container`);
  
  if(!cell) return;

  const eventEl = document.createElement("div");
  eventEl.className="event";

  const titleEl = document.createElement("div");
  titleEl.className = "event-title";
  titleEl.textContent = ev.summary;
  eventEl.appendChild(titleEl);

  // サムネ追加
  if(ev.description){
  const desc = ev.description.toLowerCase();
  for(const keyword in THUMBS){
    if(desc.includes(keyword)){
      const img = document.createElement("img");
      img.src = THUMBS[keyword];
      img.className = "thumbnail"; // ← CSSクラス適用
      eventEl.appendChild(img);

      // ★ サムネがある場合は親にクラス追加
      eventEl.classList.add("has-thumbnail");
    }
  }
}

  // タイトル文字列で色分け
    let bgColor;
    if(ev.summary.includes("昼")){
      bgColor = "#FF9900";   // オレンジ
    } else if(ev.summary.includes("夕方")){
      bgColor = "#d94e3b";   // 赤
    } else {
      bgColor = "#2952A3";   // 夜＝青
    }
    eventEl.style.background = bgColor;

    eventEl.addEventListener("click", ()=>{ showEventPopup(ev); });

    // 昼→夕方→夜の順で並べる
    if(bgColor === "#FF9900"){          // 昼
      cell.insertBefore(eventEl, cell.firstChild);
    } else if(bgColor === "#d94e3b"){   // 夕方
      const firstNight = Array.from(cell.children).find(c=>c.style.background==="#2952A3");
      if(firstNight){
        cell.insertBefore(eventEl, firstNight);
      } else {
        cell.appendChild(eventEl);
      }
    } else {                             // 夜
      cell.appendChild(eventEl);
    }


  }






// --- 複数日イベント帯描画（週を跨ぐ対応・日付下に帯表示） ---
function renderMultiDayEvents(ev) {
  const startDate = new Date(ev.start.dateTime || ev.start.date);
  const endDate = new Date(ev.end.dateTime || ev.end.date);

  // 終日イベント補正（Googleカレンダーは終日の終わりが翌日にずれる）
  if(!ev.start.dateTime && !ev.end.dateTime){
    endDate.setDate(endDate.getDate()-1);
  }

  let current = new Date(startDate);
  let firstWeek = true; // ★タイトル表示用フラグ

  while (current <= endDate) {
    // 今の週の weekEl を取得
    const weekEl = getWeekElement(current);
    if (!weekEl) break;
    
    weekEl.style.position = "relative"; // 週全体を relative に

    const days = Array.from(weekEl.querySelectorAll(".day"));
    if (!days.length) break;

    const weekStart = new Date(days[0].dataset.day);
    const weekEnd = new Date(days[days.length - 1].dataset.day);

    // 週内の表示範囲
    const displayStart = current > weekStart ? current : weekStart;
    const displayEnd = endDate < weekEnd ? endDate : weekEnd;

    const startIndex = days.findIndex(d => d.dataset.day === formatDateKey(displayStart));
    const endIndex = days.findIndex(d => d.dataset.day === formatDateKey(displayEnd));


    if (startIndex >= 0 && endIndex >= 0) {

      // --- 帯作成 ---
      const band = document.createElement("div");
      band.className = "multi-day-band";
      band.textContent = firstWeek ? ev.summary : "";

      // -------------------------
      // ★ カッコよくする装飾追加
      // -------------------------
      band.style.position = "absolute";
      band.style.zIndex = 1000; // 単日イベントより前面
      band.style.padding = "2px 6px";
      band.style.borderRadius = "6px";
      band.style.boxShadow = "0 2px 6px rgba(0,0,0,0.2)";
      band.style.fontWeight = "600";
      band.style.textShadow = "1px 1px 2px rgba(0,0,0,0.4)";
      band.style.minHeight = "15px";
      band.style.height = "auto";
      band.style.lineHeight = "1.2";

      // ★日付ラベル直下に固定
      const dateLabel = days[startIndex].querySelector(".date-label-wrapper");
      const baseTop = dateLabel ? dateLabel.offsetHeight + 6 : 2;
      band.style.top = baseTop + "px";

      // 左端・幅を計算
      let left = 0;
      for (let i = 0; i < startIndex; i++) left += days[i].getBoundingClientRect().width;
      let width = 0;
      for (let i = startIndex; i <= endIndex; i++) width += days[i].getBoundingClientRect().width;

      band.style.left = left + "px";
      
      width -= 12;// 右端を15px短くする
      band.style.width = width + "px";




      // タイトルに応じてグラデーション色分け
      if (ev.summary.includes("東京")) {
        band.style.background = "linear-gradient(90deg, rgba(82, 61, 6, 0.6), rgba(209, 168, 33, 0.6))";
        band.style.color = "#f4e8d0";
      } else if (ev.summary.includes("山梨")) {
        band.style.background = "linear-gradient(90deg, rgba(2, 80, 22, 0.6), rgba(102, 199, 128, 0.6))";
        band.style.color = "#e0f0d0";
      } else {
        band.style.background = "linear-gradient(90deg, rgba(41,82,163,0.6), rgba(100,140,220,0.6))";
        band.style.color = "#ffffff";
      }


      // 週コンテナ直下に追加
      weekEl.appendChild(band);

      // --- その週の全日セルの単日イベントを帯分だけ下げる ---
      days.forEach(day => {
        const singleContainer = day.querySelector(".single-event-container");
        if(singleContainer){
          singleContainer.style.marginTop = band.offsetHeight + "px";
        }
      });
    }

    // 翌週に進む
    current = new Date(weekEnd);
    current.setDate(current.getDate() + 1);
    firstWeek = false; // 2週目以降はタイトル非表示
  }

}



// 週の DOM を取得
function getWeekElement(date){
  const allWeeks = document.querySelectorAll(".calendar-week");
  for(const week of allWeeks){
    const days = week.querySelectorAll(".day");
    if(days.length){
      const first = new Date(days[0].getAttribute("data-day"));
      const last = new Date(days[days.length-1].getAttribute("data-day"));
      if(date >= first && date <= last) return week;
    }
  }
  return null;
}

// 週の開始日(月曜)を返す
function getWeekStartDate(date){
  const day = date.getDay();
  const diff = (day+6)%7; // 月曜=0
  const monday = new Date(date);
  monday.setDate(monday.getDate()-diff);
  return monday;
}









// --- イベント本文整形（URLリンク・画像・YouTube埋め込み対応） ---
// --- イベント本文整形（画像サムネ・URLリンク対応） ---
function formatEventContent(description) {
  if (!description) return "";

  let html = description;

  // --- 画像URLをサムネに置換（クリックで元URLに飛ぶ） ---
  const imgPlaceholders = [];
  html = html.replace(/(https?:\/\/\S+\.(?:jpg|jpeg|png|gif|webp))/gi, (match) => {
    const url = match.trim();
    const placeholder = `%%IMG_PLACEHOLDER_${imgPlaceholders.length}%%`;
    imgPlaceholders.push(`<div style="text-align:center; margin:6px 0;">
                            <a href="${url}" target="_blank">
                              <img src="${url}" style="max-width:90%; height:auto; display:inline-block; border-radius:4px;">
                            </a>
                          </div>`);
    return placeholder;
  });

  // --- URLをリンク化（画像は除外済み） ---
  html = html.replace(/(https?:\/\/[^\s<>"'()]+)/g, (url) => {
    return `<a href="${url}" target="_blank" style="color:#ffe; text-decoration:underline;">${url}</a>`;
  });

  // --- 改行を <br> に変換 ---
  html = html.replace(/\n/g, "<br>");

  // --- プレースホルダーを元に戻す ---
  imgPlaceholders.forEach((imgHtml, index) => {
    const placeholder = `%%IMG_PLACEHOLDER_${index}%%`;
    html = html.replace(placeholder, imgHtml);
  });

  return html;
}











// --- ポップアップ ---
function showEventPopup(ev){
  const popup = document.getElementById("popup");
  const overlay = document.getElementById("overlay");
  const content = document.getElementById("popup-content");

  // ★ NEW: formatEventContent を使って本文を整形
  content.innerHTML = `<h3>${ev.summary}</h3><p>${formatEventContent(ev.description)}</p>`;

  popup.style.display="block";
  overlay.style.display="block";
}

function addPopupListeners() {
  const popupClose = document.getElementById("popup-close");
  const overlay = document.getElementById("overlay");
  if(popupClose && overlay){
    popupClose.addEventListener("click", ()=>{ hidePopup(); });
    overlay.addEventListener("click", ()=>{ hidePopup(); });
  }
}
function hidePopup(){
  document.getElementById("popup").style.display="none";
  document.getElementById("overlay").style.display="none";
  document.getElementById("popup-content").innerHTML="";
}

// --- 祝日描画 ---
function markHolidays(holidays){
  holidays.forEach(holiday=>{
    const start = new Date(holiday.start.date);
    const dayKey = formatDateKey(start);
    const cell = document.querySelector(`.day[data-day="${dayKey}"]`);
    if (cell) {
      cell.classList.add("holiday");

      const wrapper = cell.querySelector(".date-label-wrapper");
      if (wrapper && !wrapper.querySelector(".holiday-label")) {
        const holidayLabel = document.createElement("span");
        holidayLabel.className = "holiday-label";
        holidayLabel.textContent = holiday.summary;
        wrapper.appendChild(holidayLabel);
      }
    }
  });
}

// 🎯 本日マークは別処理（祝日と共存可）
function markToday() {
  const today = new Date();
  const todayKey = formatDateKey(today);
  const todayCell = document.querySelector(`.day[data-day="${todayKey}"]`);
  if (todayCell) {
    todayCell.classList.add("today"); // セル背景
    const wrapper = todayCell.querySelector(".date-label-wrapper");
    if (wrapper && !wrapper.querySelector(".today-label")) {
      const todayLabel = document.createElement("span");
      todayLabel.className = "today-label";
      todayLabel.textContent = "本日";
      wrapper.appendChild(todayLabel);
    }
  }
}

// --- 週の高さ調整 ---
// イベントがある週は高さ広め、無ければ狭めに
function adjustWeekHeights() {
  const weeks = document.querySelectorAll(".calendar-week");
  const isMobile = window.innerWidth <= 600; // 600px以下はスマホ扱い
  weeks.forEach(week => {
    // 単日イベントのみチェック（帯は含めない）
    const hasSingleEvent = week.querySelector(".event") !== null;
    
    if(hasSingleEvent) {
      week.style.minHeight = isMobile ? "100px" : "160px"; // イベント週
    } else {
      week.style.minHeight = isMobile ? "50px" : "80px";   // 単日イベントなし週（帯だけでも低く）
    }

    // 日付セルも同じ高さに
    week.querySelectorAll('.day').forEach(day => {
      day.style.minHeight = week.style.minHeight;
    });
  });
}

// ページロード時とリサイズ時に高さを再調整
window.addEventListener("DOMContentLoaded", adjustWeekHeights);
window.addEventListener('load', adjustWeekHeights);
window.addEventListener('resize', adjustWeekHeights);


// --- 月移動 ---
window.changeMonth = function(diff){
  currentMonth += diff;
  if(currentMonth<0){ currentMonth=11; currentYear--; }
  if(currentMonth>11){ currentMonth=0; currentYear++; }
  renderCalendar(currentYear, currentMonth);
};

document.getElementById("prevMonth").addEventListener("click",()=>{ changeMonth(-1); });
document.getElementById("nextMonth").addEventListener("click",()=>{ changeMonth(1); });

// 初期表示
window.addEventListener("DOMContentLoaded", async () => {
  await renderCalendar(currentYear, currentMonth);
});
