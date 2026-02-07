/* =========================
   main.js (요청사항 반영)
   1) 이름: 영어만 안내 + 실제 검증(영문만 허용)
   2) 레이아웃: (CSS/HTML에서 반영) top 2칸 / status 1칸 / bottom 2칸
   3) CPU 합계: "첫 숫자 + ?" 표시 (해결 시 전체 합)
   4) 제목: CPU / Player (HTML 반영)
   5) 안내 하단 "게임 설명" 버튼 → 팝업(알림 모달)로 설명 출력
========================= */

/* ===== 쿠키 ===== */
function setCookie(name, value, days = 365) {
  const d = new Date();
  d.setTime(d.getTime() + days * 24 * 60 * 60 * 1000);
  document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; expires=${d.toUTCString()}; path=/`;
}
function getCookie(name) {
  const n = `${encodeURIComponent(name)}=`;
  return document.cookie.split(";").map(v => v.trim()).find(v => v.startsWith(n))?.slice(n.length) ?? "";
}

/* ===== 유틸 ===== */
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
function sum(arr){ return arr.reduce((a,x)=>a+x,0); }

/* ===== 덱 ===== */
function buildChipDeck() {
  const deck = [];
  const pushN = (v, n) => { for (let i = 0; i < n; i++) deck.push(v); };
  pushN(1,4); pushN(2,4); pushN(3,4); pushN(4,3); pushN(5,3);
  pushN(6,2); pushN(7,2); pushN(8,2); pushN(9,1); pushN(10,1);
  return deck;
}

const ITEM_TYPES = [
  { name:"엘더사인", count:1, desc:"내 합계 ±11 또는 ±1" },
  { name:"촉수", count:1, desc:"상대 합계 ±11 또는 ±1" },
  { name:"해골", count:4, desc:"이번 라운드: 상대 아이템 1회 차단" },
  { name:"추종자", count:4, desc:"다음 칩: 4 이하" },
  { name:"옛것", count:4, desc:"이번 턴 뽑은 칩 되돌리고 재뽑기" },
  { name:"석판", count:4, desc:"다음 칩: 4 이상" },
  { name:"축복", count:4, desc:"내 +2 또는 상대 +2" },
  { name:"저주", count:4, desc:"내 -2 또는 상대 -2" },
  { name:"서리", count:4, desc:"손 아이템 전부 교체" },
];
function buildItemDeck(){
  const deck = [];
  for (const t of ITEM_TYPES) for (let i=0;i<t.count;i++) deck.push({ type: t.name });
  return deck;
}
function itemDesc(type){ return ITEM_TYPES.find(x=>x.name===type)?.desc ?? ""; }

/* ===== 상태 ===== */
function sideState(){
  return {
    life: 5,
    chips: [],
    items: [],
    stood: false,
    skullActive: false,
    blockUsed: false,
    nextChipRule: null,   // "le4"|"ge4"|null
    lastDrawnIndexThisTurn: null,
    sumDelta: 0,
  };
}

const state = {
  playerName: "",
  matches: 0, w:0, d:0, l:0,

  round: 0,
  turn: "player",
  phase: "idle", // idle|round|cpu_stood|player_stood|resolving|gameover

  chipDeck: [],
  itemDeck: [],
  itemDiscard: [],

  player: sideState(),
  cpu: sideState(),

  playerFinalDrawUsed: false,
};

/* ===== DOM ===== */
const $ = (s)=>document.querySelector(s);
const ui = {
  round: $("#uiRound"),
  turn: $("#uiTurn"),
  phase: $("#uiPhase"),
  chipLeft: $("#uiChipLeft"),
  itemLeft: $("#uiItemLeft"),
  itemDiscard: $("#uiItemDiscard"), // ✅ 추가
  hint: $("#uiHint"),


  name: $("#uiName"),
  matches: $("#uiMatches"),
  w: $("#uiW"),
  d: $("#uiD"),
  l: $("#uiL"),
  wr: $("#uiWR"),

  cpuLife: $("#uiCpuLife"),
  playerLife: $("#uiPlayerLife"),
  cpuSum: $("#uiCpuSum"),
  playerSum: $("#uiPlayerSum"),

  cpuChips: $("#cpuChips"),
  playerChips: $("#playerChips"),
  cpuItems: $("#cpuItems"),
  playerItems: $("#playerItems"),

  cpuFlags: $("#uiCpuFlags"),
  playerFlags: $("#uiPlayerFlags"),

  btnStart: $("#btnStart"),
  btnDrawChip: $("#btnDrawChip"),
  btnStand: $("#btnStand"),
  btnReset: $("#btnReset"),

  btnHowTo: $("#btnHowTo"),
  btnItemInfo: $("#btnItemInfo"),

  btnChangeName: $("#btnChangeName"),

  nameModal: $("#nameModal"),
  nameInput: $("#nameInput"),
  btnSaveName: $("#btnSaveName"),
  btnCancelName: $("#btnCancelName"),

  actionModal: $("#actionModal"),
  actionTitle: $("#actionTitle"),
  actionDesc: $("#actionDesc"),
  actionChoices: $("#actionChoices"),
  btnActionCancel: $("#btnActionCancel"),

  alertModal: $("#alertModal"),
  alertTitle: $("#alertTitle"),
  alertMsg: $("#alertMsg"),
  btnAlertOk: $("#btnAlertOk"),
};

/* ===== 전적 저장 ===== */
function loadRecord(){
  try{
    const raw = localStorage.getItem("gsoe_record_v3");
    if(!raw) return;
    const r = JSON.parse(raw);
    state.matches = r.matches ?? 0;
    state.w = r.w ?? 0;
    state.d = r.d ?? 0;
    state.l = r.l ?? 0;
  }catch{}
}
function saveRecord(){
  localStorage.setItem("gsoe_record_v3", JSON.stringify({
    matches: state.matches, w: state.w, d: state.d, l: state.l
  }));
}

/* ===== 알림 모달 ===== */
let alertResolve = null;
function showAlert(title, msg){
  ui.alertTitle.textContent = title;
  ui.alertMsg.textContent = msg;
  ui.alertModal.classList.add("show");
  ui.alertModal.setAttribute("aria-hidden","false");
  return new Promise((resolve)=>{ alertResolve = resolve; });
}
function closeAlert(){
  ui.alertModal.classList.remove("show");
  ui.alertModal.setAttribute("aria-hidden","true");
  if (alertResolve){ alertResolve(); alertResolve = null; }
}
ui.btnAlertOk.addEventListener("click", closeAlert);

/* ===== 아이템 선택 모달(추가 필요) ===== */
function openActionModal(title, desc, choices, onPick){
  ui.actionTitle.textContent = title;
  ui.actionDesc.textContent = desc;
  ui.actionChoices.innerHTML = "";

  for (const c of choices){
    const b = document.createElement("button");
    b.type = "button";
    b.className = "choiceBtn";
    b.textContent = c.label;
    b.addEventListener("click", () => {
      closeActionModal();
      onPick(c.value);
    });
    ui.actionChoices.appendChild(b);
  }

  ui.actionModal.classList.add("show");
  ui.actionModal.setAttribute("aria-hidden","false");
}

function closeActionModal(){
  ui.actionModal.classList.remove("show");
  ui.actionModal.setAttribute("aria-hidden","true");
}

ui.btnActionCancel.addEventListener("click", closeActionModal);


/* ===== 이름(영문만) ===== */
function openNameModal(prefill=""){
  ui.nameModal.classList.add("show");
  ui.nameModal.setAttribute("aria-hidden","false");
  ui.nameInput.value = prefill;
  ui.nameInput.focus();
}
function closeNameModal(){
  ui.nameModal.classList.remove("show");
  ui.nameModal.setAttribute("aria-hidden","true");
}
function isEnglishOnlyName(v){
  // 영어만 허용 (A-Z, a-z) / 공백, 숫자, 특수문자 불가
  return /^[A-Za-z]{1,12}$/.test(v);
}
function ensureName(){
  const saved = getCookie("gsoe_player_name");
  if (saved){
    state.playerName = saved;
    ui.name.textContent = saved;
    return true;
  }
  openNameModal("");
  return false;
}

ui.btnSaveName.addEventListener("click", async () => {
  const v = ui.nameInput.value.trim();
  if (!isEnglishOnlyName(v)){
    await showAlert("이름 규칙", "이름은 영어(A~Z)만 입력해 주세요.\n숫자/공백/특수문자는 사용할 수 없습니다.");
    ui.nameInput.focus();
    return;
  }
  state.playerName = v;
  setCookie("gsoe_player_name", v, 365);
  ui.name.textContent = v;
  closeNameModal();
});
ui.btnCancelName.addEventListener("click", () => {
  // 최초는 필수 → 취소 불가
  if (!state.playerName) return;
  closeNameModal();
});
ui.btnChangeName.addEventListener("click", () => {
  openNameModal(state.playerName || "");
});

/* ===== 안내: 게임 설명 버튼 ===== */
ui.btnHowTo.addEventListener("click", async () => {
  const msg =
`진행 방식
- 라운드 시작 시 CPU/Player가 숫자칩 1개씩 받습니다.
- 내 턴에 '숫자칩 뽑기'로 칩을 추가하거나 '라운드 종료'로 멈춥니다.
- CPU가 먼저 종료 선언하면, 나는 딱 1번만 더 뽑거나 바로 종료할 수 있습니다.

승리 조건
- 각 라운드마다 21에 더 가까운 합계가 승리합니다.
- 21을 넘으면 Bust로 즉시 패배합니다.
- 둘 다 Bust 또는 같은 수면 무승부입니다.
- 패배한 쪽은 목숨 1을 잃고, 목숨이 0이면 게임 종료입니다.

주의 사항
- CPU의 전체 합은 라운드 결과에서 공개됩니다.
- 아이템은 상황에 맞게 사용하세요(해골은 상대 아이템 1회 차단).`;

  await showAlert("게임 설명", msg);
});

ui.btnItemInfo.addEventListener("click", async () => {
  const msg =
`엘더사인: 내 합계 ±11 또는 ±1
촉수: 상대 합계 ±11 또는 ±1
축복: 내/상대 합계 +2
저주: 내/상대 합계 -2
해골: 상대 아이템 1회 차단
추종자: 다음 칩 4 이하
석판: 다음 칩 4 이상
옛것: 이번 턴 칩 재뽑기
서리: 손 아이템 교체`;

  await showAlert("아이템 설명", msg);
});

/* ===== 계산 ===== */
function currentSum(side){
  const p = state[side];
  return sum(p.chips) + p.sumDelta;
}
function isBust(side){ return currentSum(side) > 21; }
function hearts(n){
  let html = "";
  for(let i=0;i<5;i++){
    if(i < n) html += `<span class="heart heart--on">♥</span>`;
    else html += `<span class="heart heart--off">♡</span>`;
  }
  return html;
}

function flagsText(side){
  const p = state[side];
  const parts = [];
  if (p.skullActive && !p.blockUsed) parts.push("해골: 차단 준비");
  if (p.nextChipRule === "le4") parts.push("다음 칩: 4이하");
  if (p.nextChipRule === "ge4") parts.push("다음 칩: 4이상");
  return parts.length ? parts.join(" / ") : "";
}

/* ===== 렌더 ===== */
function makeChipEl(text, hidden){
  const d = document.createElement("div");
  d.className = "chip" + (hidden ? " hidden" : "");
  d.textContent = text;
  return d;
}
function makeItemEl({type, desc}, isCpu, index){
  const card = document.createElement("div");
  card.className = "item" + (isCpu ? " cpu" : "");
  const t = document.createElement("div");
  t.className = "itemTitle";
  t.textContent = type;
  const m = document.createElement("div");
  m.className = "itemMeta";
  m.textContent = desc;
  card.appendChild(t);
  card.appendChild(m);
  if (!isCpu) card.addEventListener("click", () => onClickPlayerItem(index));
  return card;
}

// CPU가 이번 턴에 사용한 아이템 이름(없으면 null)
state.cpuUsedItemThisTurn = null;

// 조사(을/를) 자동
function objParticle(word){
  const ch = word[word.length - 1];
  const code = ch.charCodeAt(0) - 0xAC00;
  if (code < 0 || code > 11171) return "를"; // 한글 아니면 기본
  const jong = code % 28;
  return jong === 0 ? "를" : "을";
}

// "내 턴입니다" 문구를 통일해서 찍는 함수
function setPlayerTurnText(){
  if (state.cpuUsedItemThisTurn){
    const item = state.cpuUsedItemThisTurn;
    ui.hint.innerHTML =
      `내 턴입니다, <span class="cpuItemMsg">CPU가 ${item}${objParticle(item)} 사용했습니다.</span>`;
  } else {
    ui.hint.textContent = "내 턴입니다";
  }
}


function render(){
  ui.round.textContent = String(state.round);
  ui.turn.textContent = state.turn === "player" ? "Player" : "CPU";
  ui.phase.textContent = state.phase;
  ui.chipLeft.textContent = `${state.chipDeck.length}장`;
  ui.itemLeft.textContent = `${state.itemDeck.length}장`;
  ui.itemDiscard.textContent = `${state.itemDiscard.length}장`;


  ui.cpuLife.innerHTML = hearts(state.cpu.life);
  ui.playerLife.innerHTML = hearts(state.player.life);

  ui.playerSum.textContent = String(currentSum("player"));

  // (요청) CPU 합계 표시: "첫 숫자 + ?" / 해결 시 전체 합
  if (state.phase === "resolving" || state.phase === "gameover") {
    ui.cpuSum.textContent = String(currentSum("cpu"));
  } else {
    const first = state.cpu.chips.length ? state.cpu.chips[0] : "-";
    ui.cpuSum.textContent = (first === "-") ? "-" : `${first} + ?`;
  }

  ui.cpuFlags.textContent = flagsText("cpu");
  ui.playerFlags.textContent = flagsText("player");

  // 버튼
  const inRound = (state.phase === "round" || state.phase === "cpu_stood" || state.phase === "player_stood");
  const playerTurn = state.turn === "player";
  const canFinalDraw = (state.phase !== "cpu_stood") || (state.phase === "cpu_stood" && !state.playerFinalDrawUsed);

  ui.btnDrawChip.disabled = !(inRound && playerTurn && canFinalDraw);
  ui.btnStand.disabled = !(inRound && playerTurn);
  ui.btnStart.disabled = inRound || state.phase === "resolving";
  ui.btnReset.disabled = false;

  // 칩 렌더
  ui.cpuChips.innerHTML = "";
  for (let i=0;i<state.cpu.chips.length;i++){
    const v = state.cpu.chips[i];
    const revealAll = (state.phase === "resolving" || state.phase === "gameover");
    const visible = revealAll || i === 0;
    ui.cpuChips.appendChild(makeChipEl(visible ? String(v) : "CHIP", !visible));
  }

  ui.playerChips.innerHTML = "";
  for (const v of state.player.chips){
    ui.playerChips.appendChild(makeChipEl(String(v), false));
  }

  // 아이템 렌더
  ui.cpuItems.innerHTML = "";
  const cpuItemCount = state.cpu.items.length;
  ui.cpuItems.appendChild(
    makeItemEl(
      { type: "아이템(비공개)", desc: `x${cpuItemCount}` },  // ✅ 카드 나열 대신 개수만
      true
    )
  );


  ui.playerItems.innerHTML = "";
  for (let i=0;i<state.player.items.length;i++){
    const it = state.player.items[i];
    ui.playerItems.appendChild(makeItemEl({type:it.type, desc:itemDesc(it.type)}, false, i));
  }

  // 전적
  ui.matches.textContent = String(state.matches);
  ui.w.textContent = String(state.w);
  ui.d.textContent = String(state.d);
  ui.l.textContent = String(state.l);
  const wr = state.matches ? Math.round((state.w / state.matches) * 100) : 0;
  ui.wr.textContent = `${wr}%`;
}

/* ===== 플레이어 아이템 사용(추가 필요) ===== */
function onClickPlayerItem(index){
  // 내 턴 + 라운드 진행 중에만 사용 가능
  if (state.turn !== "player") return;
  if (!(state.phase === "round" || state.phase === "cpu_stood" || state.phase === "player_stood")) return;

  const item = state.player.items[index];
  if (!item) return;

  const t = item.type;

  // 해골: 방어 1회 차단 준비
  if (t === "해골"){
    state.player.skullActive = true;
    removeItem("player", index);
    ui.hint.textContent = "해골 사용: 이번 라운드 동안 상대 아이템 1회를 차단합니다.";
    render();
    return;
  }

  // 추종자: 다음 칩 4 이하
  if (t === "추종자"){
    state.player.nextChipRule = "le4";
    removeItem("player", index);
    ui.hint.textContent = "추종자 사용: 다음 숫자칩은 4 이하입니다.";
    render();
    return;
  }

  // 석판: 다음 칩 4 이상
  if (t === "석판"){
    state.player.nextChipRule = "ge4";
    removeItem("player", index);
    ui.hint.textContent = "석판 사용: 다음 숫자칩은 4 이상입니다.";
    render();
    return;
  }

  // 옛것: 이번 턴에 뽑은 칩을 되돌리고 재뽑기
  if (t === "옛것"){
    const idx = state.player.lastDrawnIndexThisTurn;
    if (idx == null){
      ui.hint.textContent = "옛것: 이번 턴에 뽑은 칩이 없습니다.";
      return;
    }
    const v = state.player.chips[idx];
    state.player.chips.splice(idx, 1);
    state.chipDeck.push(v);
    shuffle(state.chipDeck);

    dealChipTo("player"); // 재뽑기
    removeItem("player", index);

    ui.hint.textContent = "옛것 사용: 방금 뽑은 칩을 되돌리고 새로 뽑았습니다.";
    render();
    return;
  }

  // 서리: 손에 있는 아이템 전부 교체
  if (t === "서리") {
    // 1) 서리 1장 소비(손에서 제거)
    removeItem("player", index);

    // 2) 남아있는 모든 아이템을 더미로 되돌리기
    const returned = state.player.items.length;

    // ✅ 교체되는 카드들은 버림더미로
    state.itemDiscard.push(...state.player.items);

    // 손 비우기
    state.player.items = [];

    // ✅ 같은 장수만큼 다시 받기
    const got = dealItemTo("player", returned);

    ui.hint.textContent = `서리 사용: 아이템 ${returned}장을 버리고 ${got}장을 새로 받았습니다.`;
    render();
    return;
  }


  // 엘더사인: 내 합계 ±11/±1
  if (t === "엘더사인"){
    openActionModal(
      "엘더사인",
      "내 합계를 조정합니다.",
      [
        {label:"+11", value:+11},
        {label:"+1", value:+1},
        {label:"-11", value:-11},
        {label:"-1", value:-1},
      ],
      (delta) => {
        removeItem("player", index);
        applyDelta("player", delta);
        ui.hint.textContent = `엘더사인: 내 합계 ${delta>=0?"+":""}${delta}`;
        render();
      }
    );
    return;
  }

  // 촉수: CPU 합계 ±11/±1 (CPU 해골이면 차단)
  if (t === "촉수"){
    openActionModal(
      "촉수",
      "CPU 합계를 조정합니다.",
      [
        {label:"+11", value:+11},
        {label:"+1", value:+1},
        {label:"-11", value:-11},
        {label:"-1", value:-1},
      ],
      (delta) => {
        removeItem("player", index);

        if (tryBlockBySkull("cpu")){
          ui.hint.textContent = "CPU 해골로 차단되었습니다.";
          render();
          return;
        }

        applyDelta("cpu", delta);
        ui.hint.textContent = `촉수: CPU 합계 ${delta>=0?"+":""}${delta}`;
        render();
      }
    );
    return;
  }

  // 축복: +2 (내 또는 CPU) / CPU 대상이면 해골로 차단 가능
  if (t === "축복"){
    openActionModal(
      "축복",
      "합계 +2를 누구에게 적용할까요?",
      [
        {label:"내 합계 +2", value:"me"},
        {label:"CPU 합계 +2", value:"cpu"},
      ],
      (target) => {
        removeItem("player", index);

        if (target === "cpu" && tryBlockBySkull("cpu")){
          ui.hint.textContent = "CPU 해골로 차단되었습니다.";
          render();
          return;
        }

        if (target === "me") applyDelta("player", +2);
        else applyDelta("cpu", +2);

        ui.hint.textContent = `축복: ${target==="me"?"내":"CPU"} 합계 +2`;
        render();
      }
    );
    return;
  }

  // 저주: -2 (내 또는 CPU) / CPU 대상이면 해골로 차단 가능
  if (t === "저주"){
    openActionModal(
      "저주",
      "합계 -2를 누구에게 적용할까요?",
      [
        {label:"내 합계 -2", value:"me"},
        {label:"CPU 합계 -2", value:"cpu"},
      ],
      (target) => {
        removeItem("player", index);

        if (target === "cpu" && tryBlockBySkull("cpu")){
          ui.hint.textContent = "CPU 해골로 차단되었습니다.";
          render();
          return;
        }

        if (target === "me") applyDelta("player", -2);
        else applyDelta("cpu", -2);

        ui.hint.textContent = `저주: ${target==="me"?"내":"CPU"} 합계 -2`;
        render();
      }
    );
    return;
  }
}


/* ===== 덱 뽑기 ===== */
function drawChipWithRule(side){
  if (state.chipDeck.length === 0) return null;
  const p = state[side];
  const rule = p.nextChipRule;

  if (!rule) return state.chipDeck.pop();

  for (let i = state.chipDeck.length - 1; i >= 0; i--){
    const v = state.chipDeck[i];
    if (rule === "le4" && v <= 4) {
      state.chipDeck.splice(i,1);
      p.nextChipRule = null;
      return v;
    }
    if (rule === "ge4" && v >= 4) {
      state.chipDeck.splice(i,1);
      p.nextChipRule = null;
      return v;
    }
  }
  p.nextChipRule = null;
  return state.chipDeck.pop();
}
function dealChipTo(side){
  const v = drawChipWithRule(side);
  if (v == null) return;
  const p = state[side];
  p.chips.push(v);
  p.lastDrawnIndexThisTurn = p.chips.length - 1;
}

function refillItemDeckIfNeeded(){
  if (state.itemDeck.length > 0) return;
  if (state.itemDiscard.length === 0) return;

  // ✅ 버림더미 전부 회수해서 섞고, 뽑을더미로 만들기
  state.itemDeck = shuffle(state.itemDiscard);
  state.itemDiscard = [];
}

function dealItemTo(side, n){
  const p = state[side];
  let got = 0;

  for (let i=0;i<n;i++){
    refillItemDeckIfNeeded();
    if (state.itemDeck.length === 0) break;

    p.items.push(state.itemDeck.pop());
    got += 1;
  }
  render();
  return got; // ✅ 실제로 받은 장수 리턴
}

/* ===== 아이템 공통 ===== */
function removeItem(side, idx){
  const removed = state[side].items.splice(idx, 1)[0];
  if (removed) state.itemDiscard.push(removed); // ✅ 사용한 카드는 버림더미로
  render();
}
function applyDelta(side, delta){ state[side].sumDelta += delta; }
function tryBlockBySkull(defenderSide){
  const d = state[defenderSide];
  if (d.skullActive && !d.blockUsed){
    d.blockUsed = true;
    return true;
  }
  return false;
}

/* ===== 게임 초기화/라운드 ===== */
function resetAll(){
  state.round = 0;
  state.turn = "player";
  state.phase = "idle";
  state.chipDeck = [];
  state.itemDeck = [];
  state.player = sideState();
  state.cpu = sideState();
  state.playerFinalDrawUsed = false;

  ui.hint.textContent = "시작을 눌러 게임을 시작하세요.";
  render();
}

async function startGame(){
  if (!ensureName()) return;

  state.player = sideState();
  state.cpu = sideState();

  state.round = 1;
  state.phase = "round";
  state.turn = "player";
  state.playerFinalDrawUsed = false;

  state.chipDeck = shuffle(buildChipDeck());
  state.itemDeck = shuffle(buildItemDeck());

  // 시작: 칩 1개씩
  dealChipTo("player");
  dealChipTo("cpu");

  // 1R 시작: 아이템 3장씩
  const pAdd = dealItemTo("player", 3);
  const cAdd = dealItemTo("cpu", 5); // ✅ 3 + 2

  await showAlert(
    "라운드 시작",
    `라운드 1이 시작되었습니다.\nCPU 아이템 +${cAdd} 추가\nPlayer 아이템 +${pAdd} 추가\n내 턴입니다.`
  );
  ui.hint.textContent = "내 턴입니다.";
  render();
}

async function nextRound(){
  // 칩 회수/재셔플(아이템 유지)
  state.player.chips = [];
  state.cpu.chips = [];
  state.player.sumDelta = 0;
  state.cpu.sumDelta = 0;
  state.player.stood = false;
  state.cpu.stood = false;

  state.player.skullActive = false; state.player.blockUsed = false; state.player.nextChipRule=null; state.player.lastDrawnIndexThisTurn=null;
  state.cpu.skullActive = false; state.cpu.blockUsed = false; state.cpu.nextChipRule=null; state.cpu.lastDrawnIndexThisTurn=null;

  state.playerFinalDrawUsed = false;

  state.chipDeck = shuffle(buildChipDeck());

  // 라운드 시작마다 아이템 1장씩
  const pAdd = dealItemTo("player", 2);
  const cAdd = dealItemTo("cpu", 4); // ✅ 2 + 2

  // 라운드 시작: 칩 1개씩
  dealChipTo("player");
  dealChipTo("cpu");

  state.round += 1;
  state.phase = "round";
  state.turn = "player";


    await showAlert(
      "라운드 시작",
      `라운드 ${state.round}이 시작되었습니다.\nCPU 아이템 +${cAdd} 추가\nPlayer 아이템 +${pAdd} 추가\n내 턴입니다.`
    );
  ui.hint.textContent = "내 턴입니다.";
  render();
}

/* ===== 라운드 판정 ===== */
function resolveRoundText(pSum, cSum, pBust, cBust){
  if (pBust && cBust) return "둘 다 Bust! 무승부";
  if (pBust && !cBust) return "플레이어 Bust! 라운드 패배";
  if (!pBust && cBust) return "CPU Bust! 라운드 승리";
  const pDist = 21 - pSum;
  const cDist = 21 - cSum;
  if (pDist === cDist) return "동점! 무승부";
  return (pDist < cDist) ? "21에 더 가까워 승리!" : "상대가 21에 더 가까워 패배";
}

async function resolveRound(reason=""){
  state.phase = "resolving";
  render();

  const pSum = currentSum("player");
  const cSum = currentSum("cpu");
  const pBust = pSum > 21;
  const cBust = cSum > 21;

  let winner = "draw"; // player|cpu|draw
  if (pBust && cBust) winner = "draw";
  else if (pBust && !cBust) winner = "cpu";
  else if (!pBust && cBust) winner = "player";
  else {
    const pDist = 21 - pSum;
    const cDist = 21 - cSum;
    if (pDist === cDist) winner = "draw";
    else winner = (pDist < cDist) ? "player" : "cpu";
  }

  if (winner === "player") state.cpu.life = Math.max(0, state.cpu.life - 1);
  if (winner === "cpu") state.player.life = Math.max(0, state.player.life - 1);

  render();

  const fightResult = resolveRoundText(pSum, cSum, pBust, cBust);

  const msg =
  "사유 : " + (reason || "-") + "\n" +
  "CPU : " + cSum + "\n" +
  "Player : " + pSum + "\n" +
  "\"" + fightResult + "\"";

  await showAlert("라운드 결과", msg);

  // 게임 종료 체크
  if (state.player.life === 0 || state.cpu.life === 0) {
    state.phase = "gameover";
    render();

    state.matches += 1;
    let gameRes = "D";
    if (state.cpu.life === 0 && state.player.life > 0) { state.w += 1; gameRes = "W"; }
    else if (state.player.life === 0 && state.cpu.life > 0) { state.l += 1; gameRes = "L"; }
    else { state.d += 1; gameRes = "D"; }
    saveRecord();
    render();

    const endMsg = (gameRes === "W") ? "최종 승리! CPU 목숨이 0이 되었습니다."
                 : (gameRes === "L") ? "최종 패배... Player 목숨이 0이 되었습니다."
                 : "최종 무승부";

    await showAlert("게임 종료", endMsg);
    ui.hint.textContent = "게임이 종료되었습니다. 시작을 눌러 새 게임을 하세요.";
    return;
  }

  await nextRound();
}

/* ===== CPU AI: 플레이어 정보를 참조하지 않음 ===== */
function hasItem(sideObj, type){ return sideObj.items.some(x => x.type === type); }
function consumeItem(sideObj, type){
  const idx = sideObj.items.findIndex(x => x.type === type);
  if (idx >= 0){
    const removed = sideObj.items.splice(idx, 1)[0];
    if (removed) state.itemDiscard.push(removed); // ✅ CPU 사용 카드도 버림더미로
    render();
  }
}

function cpuMaybeUseItem(){

  const c = state.cpu;
  const s = currentSum("cpu");

  // 내부 유틸: CPU가 아이템 사용했다는 안내문 표시
  const hint = (name) => { ui.hint.textContent = `CPU가 ${name}을 사용했습니다.`; };

  // 1) 해골: 초반에 조금 더 자주(0.25 -> 0.35)
  if (!c.skullActive && c.chips.length <= 2 && hasItem(c, "해골") && Math.random() < 0.35){
    consumeItem(c, "해골");
    c.skullActive = true;
    state.cpuUsedItemThisTurn = "해골";
    return;
  }

  // 2) Bust 방어: 엘더사인 우선
  if (s > 21 && hasItem(c, "엘더사인")){
    consumeItem(c, "엘더사인");
    const over = s - 21;
    const delta = (over >= 11) ? -11 : -1;
    applyDelta("cpu", delta);
    state.cpuUsedItemThisTurn = "엘더사인";
    return;
  }

  // 3) 높으면 저주로 내려서 안정화(확률 0.35 -> 0.45)
  if (s >= 20 && hasItem(c, "저주") && Math.random() < 0.45){
    consumeItem(c, "저주");
    // CPU는 자기 합을 낮추는 용도로 사용
    applyDelta("cpu", -2);
    state.cpuUsedItemThisTurn = "저주";
    return;
  }

  // 4) 낮으면 축복으로 끌어올리기(확률 0.35 -> 0.45)
  if (s <= 15 && hasItem(c, "축복") && Math.random() < 0.45){
    consumeItem(c, "축복");
    // CPU는 자기 합을 올리는 용도로 사용
    applyDelta("cpu", +2);
    state.cpuUsedItemThisTurn = "축복";
    return;
  }

  // 5) 다음 칩 규칙: 위험하면 추종자(4이하), 낮으면 석판(4이상) (0.35 -> 0.45)
  if (c.nextChipRule == null){
    if (s >= 19 && hasItem(c, "추종자") && Math.random() < 0.45){
      consumeItem(c, "추종자");
      c.nextChipRule = "le4";
      state.cpuUsedItemThisTurn = "추종자";
      return;
    }
    if (s <= 14 && hasItem(c, "석판") && Math.random() < 0.45){
      consumeItem(c, "석판");
      c.nextChipRule = "ge4";
      state.cpuUsedItemThisTurn = "석판";
      return;
    }
  }

  // 6) 옛것: 이번 턴에 뽑은 칩이 너무 위험하면(20~23) 되돌리고 재뽑기 (0.45 -> 0.55)
  if (hasItem(c, "옛것") && c.lastDrawnIndexThisTurn != null){
    const cs = currentSum("cpu");
    if (cs >= 20 && cs <= 23 && state.chipDeck.length > 0 && Math.random() < 0.55){
      consumeItem(c, "옛것");

      const idx = c.lastDrawnIndexThisTurn;
      const v = c.chips[idx];
      c.chips.splice(idx, 1);

      state.chipDeck.push(v);
      shuffle(state.chipDeck);

      dealChipTo("cpu"); // 재뽑기
      state.cpuUsedItemThisTurn = "옛것";
      return;
    }
  }

  // 7) 서리: 손패가 많으면 교체(0.20 -> 0.30)
  if (c.items.length >= 6 && hasItem(c, "서리") && Math.random() < 0.30) {
    // 1) 서리 1장 소비
    consumeItem(c, "서리");

    // 2) 남아있는 모든 아이템을 더미로 되돌리기
    const returned = c.items.length;

    // ✅ 교체되는 카드들은 버림더미로
    state.itemDiscard.push(...c.items);

    // 손 비우기
    c.items = [];

    // ✅ CPU는 받을 때마다 +2 더
    dealItemTo("cpu", returned + 2);

    state.cpuUsedItemThisTurn = "서리";
    return;
  }

  // 8) 촉수: 플레이어 정보는 참조하지 않고, 랜덤으로 상대 합계 조작 (0.18 -> 0.28)
  if (hasItem(c, "촉수") && Math.random() < 0.28){
    consumeItem(c, "촉수");

    const options = [+1, -1, +11, -11];
    const delta = options[Math.floor(Math.random() * options.length)];

    // 플레이어가 해골 준비 중이면 차단
    if (tryBlockBySkull("player")){
      ui.hint.textContent = "CPU가 촉수를 사용했지만 해골로 차단되었습니다.";
      return;
    }

    applyDelta("player", delta);
    state.cpuUsedItemThisTurn = "촉수";
    return;
  }
}


async function cpuTakeTurn(){
  state.cpuUsedItemThisTurn = null;

  cpuMaybeUseItem();

  if (isBust("cpu")) {
    await resolveRound("CPU Bust");
    return;
  }

  const cSum = currentSum("cpu");

  // 플레이어 스탠드 후: CPU 마지막 선택
  if (state.phase === "player_stood") {
    if (cSum < 17 && state.chipDeck.length > 0) dealChipTo("cpu");
    cpuMaybeUseItem();
    await resolveRound("플레이어 종료 선언 이후 CPU 최종");
    return;
  }

  // 일반 턴: 16 이하면 뽑기, 18 이상이면 스탠드, 17은 50%
  let wantDraw = false;
  if (cSum <= 16) wantDraw = true;
  else if (cSum >= 18) wantDraw = false;
  else wantDraw = Math.random() < 0.5;

  if (wantDraw && state.chipDeck.length > 0) {
    dealChipTo("cpu");
    cpuMaybeUseItem();

    if (isBust("cpu")) {
      await resolveRound("CPU Bust");
      return;
    }

    state.turn = "player";
    setPlayerTurnText();
    render();
    return;

  }

  // CPU 스탠드 선언
  state.cpu.stood = true;
  state.phase = "cpu_stood";
  state.turn = "player";
  state.playerFinalDrawUsed = false;
  render();

  await showAlert(
    "CPU 라운드 종료 선언",
    "CPU가 라운드 종료를 선언했습니다.\n플레이어는 숫자칩을 딱 1번 더 뽑거나, 바로 라운드를 종료할 수 있습니다."
  );
  setPlayerTurnText();
  render();
}

/* ===== 버튼 ===== */
ui.btnStart.addEventListener("click", startGame);

ui.btnReset.addEventListener("click", () => {
  resetAll();
});

ui.btnDrawChip.addEventListener("click", async () => {
  if (state.turn !== "player") return;
  if (!(state.phase === "round" || state.phase === "cpu_stood")) return;

  // CPU 스탠드 상태면 1회 제한 + 뽑으면 즉시 결과
  if (state.phase === "cpu_stood") {
    if (state.playerFinalDrawUsed) return;
    state.playerFinalDrawUsed = true;

    dealChipTo("player");
    render();
    await resolveRound("CPU 종료 선언 이후 플레이어 마지막 1뽑");
    return;
  }

  // 일반 라운드
  dealChipTo("player");
  render();

  if (isBust("player")) {
    await resolveRound("Player Bust");
    return;
  }

  state.turn = "cpu";
  render();
  await cpuTakeTurn();
});

ui.btnStand.addEventListener("click", async () => {
  if (state.turn !== "player") return;

  // CPU 스탠드 상태에서 플레이어도 종료 -> 즉시 결과
  if (state.phase === "cpu_stood") {
    await resolveRound("CPU 종료 선언 이후 Player 즉시 종료");
    return;
  }

  if (state.phase !== "round") return;

  // 플레이어 스탠드 선언
  state.player.stood = true;
  state.phase = "player_stood";
  state.turn = "cpu";
  render();

  await showAlert("라운드 종료 선언", "Player가 라운드 종료를 선언했습니다.\nCPU가 마지막 선택을 진행합니다.");
  await cpuTakeTurn();
});

/* ===== 초기화 ===== */
function init(){
  loadRecord();
  ensureName();
  if (state.playerName) ui.name.textContent = state.playerName;
  resetAll();
  render();
}
init();
