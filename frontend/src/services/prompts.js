// LLM prompts. All prompts are built dynamically from the snapshot returned by
// /api/snapshot, plus a randomly-picked archetype that pins the character's
// life trajectory style for the entire game.

import { archetypeBlock } from './archetypes.js'

const currentYear = () => new Date().getFullYear()
const rocYear = (year) => year - 1911

// Drama bank — events that can hit at any point in a life. Each node has a
// chance of rolling a hint from the age-appropriate pool. The LLM is still in
// charge of pacing — we hand it a suggestion, not an order. This is what stops
// every life from feeling like a self-help-book straight line.
//
// Mix is intentional: mostly setbacks (unemployment, betrayal, illness, loss),
// but also positive shocks (windfalls, sudden fame, reconciliations) and
// ambiguous turns (offers from old flames, opportunities that require leaving
// home). Real life isn't all downward — but the upward beats also force choices.
//
// Roll rate ~32% so dramatic beats land but don't dominate.
const DRAMA_POOL = {
  // 12-18 歲
  teen: [
    '父母吵架、要離婚的傳聞在家裡瀰漫。你被夾在中間。',
    '同班同學自殺/意外身亡，全班受到衝擊。你和他原本不熟，但這幾天一直在想他。',
    '阿公或阿嬤突然中風住院，全家被打亂。',
    '家裡突然周轉不靈，父親（或母親）失業，氣氛變得很冷。',
    '一場颱風/地震/淹水重創了你住的地方，學校停課，家裡受損。',
    '你發現有同學在校園網路上散佈關於你的謠言，一傳十十傳百。',
    '你被信任的長輩或老師性騷擾或施壓，不知道該怎麼辦。',
    '你自己生了一場大病，住院好幾個禮拜，跟不上同學。',
    '你意外被選進國手隊/科展全國賽/奧林匹亞代表隊，但訓練要佔掉所有課餘時間。',
    '你在網路上發的影片/作品/貼文意外爆紅，幾十萬人追蹤，但隨之而來的是肉搜與酸民。',
    '你發現自己對同性朋友動心，自己內心混亂，又不知道能跟誰說。',
    '老師因為「家暴/不適任」事件被換掉，全班憤怒、家長分裂、你被點名要不要連署。',
    '你的弟弟/妹妹出生（或爸媽再婚帶來繼弟妹），家裡關注全部轉移，你變成「比較好顧的那個」。',
    '你被診斷出 ADHD / 自閉光譜 / 學習障礙。家人對「要不要吃藥」「要不要轉特教」吵不停。',
    '你的好朋友（家裡比較好的那個）邀你一起出國比賽/遊學/搬家，但你要選擇繼續友誼或留在原地。',
    '一筆遠房親戚的遺產或保險金意外落到家裡，爸媽開始討論「要不要送你去私校」。',
    '你被警察帶回家——可能是同學偷東西你被連累，或是社群上的玩笑被當成校園威脅。',
    '父母被詐騙集團騙走存款，家裡氣氛一夕之間變了。'
  ],
  // 18-30 歲
  young: [
    '你的第一份工作公司倒閉，老闆跑路，連最後一個月薪水都沒拿到。',
    '父母（或其中一位）出車禍/重病，你必須臨時把人生暫停下來去陪。',
    '你發現現任伴侶劈腿（或你發現自己對別人動心了）。',
    '你被詐騙集團騙了一筆錢——可能是投資詐騙、求職詐騙、或感情詐騙。',
    '你被裁員，產業正在萎縮（媒體、出版、傳產），不確定接下來能幹什麼。',
    '你最好的朋友突然失聯/出事/自殺/酒駕喪命，你陷入長期低潮。',
    '創業/合夥失敗，朋友間反目，欠了一筆債。',
    '你做了一個錯誤決定（無照駕駛、酒駕、一夜情、毒品）並在這個節點承擔後果。',
    '健保上發生了影響你的政策變動（醫材自費上限、健保費調漲），讓你重新評估人生規劃。',
    '你意外懷孕/讓對方懷孕——還沒準備好結婚生子，但時間不等人。',
    '你壓中了一檔股票/虛擬貨幣/IPO，存款一夕變多十倍。要不要套現、要不要 all in 下一檔，是個誘惑。',
    '你接到國外公司挖角，薪水翻倍但要搬離台灣 5-10 年。',
    '你拿到知名獎學金/比賽冠軍/作品入圍國際——你開始被人稱呼「未來會發光的人」，壓力跟著來。',
    '你的兵役期間發生事故/凌虐事件/你目擊長官違法。要不要吹哨、要不要忍。',
    '你的好朋友/室友突然出櫃，或要做變性手術，問你能不能當第一個知道的人並支持他。',
    '一場車禍/意外事故，你是駕駛，對方受重傷或死亡。即使官司打贏，這個重量留下來。',
    '你的父母拿房子出來幫你做保人/共同出資創業，現在事業出狀況，他們的房子岌岌可危。',
    '你在感情上被劈腿/用完即丟，憂鬱症被診斷出來，需要長期治療。',
    '你的研究所/職場上司爆出性騷擾/學術不端醜聞，要不要站出來，會影響你接下來的圈子人脈。',
    '你被前任纏擾/恐嚇/恐怖情人，需要報警申請保護令。'
  ],
  // 30-50 歲
  mid: [
    '配偶外遇被你發現——你需要決定怎麼處理。',
    '你自己被另一個人誘惑，動了心，正在掙扎。',
    '小孩在學校出狀況（被霸凌、霸凌別人、自殘、休學、未成年懷孕）。',
    '父母失智，需要長照。手足之間在誰要照顧的問題上吵起來了。',
    '健康警訊：你被檢查出癌症/心血管疾病/慢性病，需要做選擇。',
    '你工作的公司被併購/倒閉/產業崩盤（傳產、媒體、出版、實體零售），中年失業。',
    '投資爆雷：虛擬貨幣崩盤、股票割韭菜、房地產套牢、詐騙集團，存款一夕之間蒸發。',
    '你或配偶捲入官司或職場爭議。',
    '配偶突然過世/重病，你變成單親或主要照顧者。',
    '創業/事業到中年遇到天花板，要不要轉跑道是個決定。',
    '老朋友因背叛、債務或政治立場反目，多年友誼說斷就斷。',
    '一筆親戚遺產（祖厝、農地、保險金）落到你頭上，但伴隨著手足分配的撕裂與稅金問題。',
    '小孩被診斷出特殊需求（自閉、過動、罕病），主要照顧責任重新分配。',
    '你被升任成中高階主管，要做決定裁掉好幾個老同事——其中包括跟你一起進公司的人。',
    '你曾經錯過的初戀/前任，多年後在同學會/Facebook/LinkedIn 找到你。對方說現在離婚單身。',
    '你在公司舉辦的健檢/加班過勞猝死新聞中，看見自己同事的名字。',
    '你或伴侶第三次/第四次嘗試試管嬰兒，最後一次。',
    '老婆/老公的事業突然爆紅，你變成那個「站在後面的人」。',
    '父親（或母親）突然出櫃，或者你發現他們其中一人有外遇 30 年的影子。整個家族秩序被重寫。',
    '你被舊客戶/合作夥伴爆出商業糾紛官司，名聲受損，朋友圈分成兩派。',
    '你在臉書/Threads/Instagram 上的一則貼文被截圖出征，工作受影響。',
    '你買的房子發現是凶宅 / 海砂屋 / 違建，要不要打官司是個沉重的決定。',
    '一個你以為「再也不會見到」的家人（離家的爸爸、出走的兄姊）回來了，帶著病或債務。',
    '你（或配偶）有了一個沒人知道的孩子。'
  ],
  // 50-65 歲
  late: [
    '父母過世，你變成「上一輩」了。葬禮上有些人多年沒見。',
    '配偶生重病，你成為主要照顧者，自己的退休計畫被打亂。',
    '已成年的小孩突然不聯絡你，或選擇了你不能接受的人生（出國不回、伴侶你不喜歡、信奉某種團體）。',
    '你自己中風/癌症/心臟手術，第一次真正面對死亡。',
    '退休金、終身險、儲蓄被詐騙集團騙走（假投資、假檢警、假親人）。',
    '公司在你接近退休前不續聘/逼退/資遣，福利被打折。',
    '一個老朋友病逝/自殺，你開始整理自己跟過去的關係。',
    '你發現配偶有秘密（婚外情、私房錢、雙重生活），整段婚姻被重新檢視。',
    '你被請去當小孩婚禮的主婚人/長輩，但你知道自己跟對方家裡的關係很尷尬。',
    '你接班的家業因外部變化（產業萎縮、技術革命、健康問題）走到該不該收掉的關口。',
    '你年輕時的作品/事蹟/著作被新一代重新發現，突然有人來邀你演講/受訪/復出。',
    '一個多年前的學生/部下/晚輩，現在比你更成功了，邀你一起做事——但角色互換你能不能接受。',
    '你或配偶被政治運動/宗教團體/詐騙吸進去，家人開始擔心你變了。',
    '你的子女創業失敗回來借錢，金額大到動到你的退休金。',
    '你發現自己（或配偶）多年累積的健康問題其實源於職業傷害，要不要打官司爭取權益。',
    '一場同學會把你帶回三十年前——當年的初戀、宿敵、好友都在現場。'
  ],
  // 65+
  end: [
    '你的健康亮紅燈，需要長期治療或手術。',
    '配偶比你先走。你獨自面對接下來的日子。',
    '一個多年沒聯絡的人（前任、初戀、舊同事）帶著歉意或祝福回來找你。',
    '小孩不在身邊（在國外、忙、或已過世），你獨自處理一個重大決定。',
    '你被診斷出失智症初期，醫生問你「要不要先把事情交代清楚」。',
    '你發現多年前埋藏的秘密（私生子、隱瞞的疾病、被你陷害過的人）終於浮上來，需要面對。',
    '你的孫子/孫女把你當成最後的依靠來諮詢人生大事，你必須決定要說真話還是給安慰。',
    '一個跟你一起變老的好朋友提議：剩下的日子要不要一起住一起照顧。',
    '你收到要求參加一場「老朋友的告別式」的通知——主角是你以為早就走遠的人。',
    '你被要求把祖厝/老店/家族墓地處理掉——你是最後一個還在乎這些的人。'
  ]
}

function pickDramaHint(lastAge) {
  // ~30% of nodes get a drama curveball
  if (Math.random() > 0.32) return null
  let pool
  if (lastAge < 18)      pool = DRAMA_POOL.teen
  else if (lastAge < 30) pool = DRAMA_POOL.young
  else if (lastAge < 50) pool = DRAMA_POOL.mid
  else if (lastAge < 65) pool = DRAMA_POOL.late
  else                   pool = DRAMA_POOL.end
  return pool[Math.floor(Math.random() * pool.length)]
}

// Opportunity bank — counter-balance to DRAMA_POOL.
//
// Without this, the LLM doubles down on bad starts: a 「雲林農家、家裡周轉不靈」
// archetype gets a string of progressively grimmer nodes. Real life isn't like
// that — kind teachers spot bright kids, mentors take you under their wing,
// scholarships exist, side projects blow up, and strangers occasionally help.
//
// We roll opportunity at ~28% (slightly less than drama, so life still tilts
// realistic) and let it stack with drama on the same node — that's where the
// best stories happen: the year your dad gets sick is also the year a teacher
// spots you and pulls strings to get you into a special program.
const OPPORTUNITY_POOL = {
  teen: [
    '一位老師注意到你的某項天賦（畫畫、寫作、數學、體育、音樂），主動幫你找比賽、找資源、寫推薦信。',
    '你申請到弱勢學生獎學金 / 教育部圓夢計畫 / 偏鄉子弟培育，金額足夠減輕家裡的擔子。',
    '一個遠房親戚（叔叔、阿姨、表哥）願意贊助你補習或出國交換，條件是你要爭氣。',
    '你在校外比賽（科展、繪畫、寫作、運動）拿到名次，校長親自頒獎，地方報紙刊登。',
    '一個原本看你不順眼的同學變成好朋友，他家庭背景不同，帶你看見另一個世界。',
    '你發現自己對某件事（程式、影片剪輯、烘焙、修東西）異常上手，做出來的東西被人花錢買。',
    '你被選進學校的特殊培育班（資優、體育、音樂），雖然辛苦但開了一扇門。',
    '你在網路上認識幾個志同道合的朋友/前輩，他們把你帶進一個你之前進不去的圈子（社運、開源、同人、樂團）。',
    '一個鄰居老人家把你當孫子帶，教你他一輩子的手藝/人情世故，你後來才懂這份禮物多重。'
  ],
  young: [
    '一個前輩 / 老師 / 老闆主動把你帶到身邊，給你超齡的機會與舞台。',
    '你做的某個小作品/側專案（podcast、YouTube、Instagram、一篇文章）意外被看見，帶來新工作或新身分。',
    '你的某個能力被獵頭挖角，薪水翻倍、地點更好，跳出原本的軌道。',
    '你考上公職/教甄/國營事業，雖然辛苦但人生變穩。',
    '你的家人/長輩過世留下一筆錢或一間老屋，足以付頭期款或開店。',
    '一個共同朋友介紹了一個對象，他/她家境穩定、性格也好，認真對待你。',
    '你壓對一檔股票/虛擬幣/IPO，雖然不是大富大貴，但讓你有第一桶金。',
    '你考上海外研究所獎學金 / 國際志工計畫 / 駐村，看見台灣以外的世界。',
    '你做的事情被報導/被獎項認可，雖然短暫，但給你接下來幾年走下去的信心。',
    '你被一個你以為不會喜歡你的人喜歡了——對方主動、體貼、看見你最隱藏的那一面。',
    '一場你不情願去的家族聚會 / 同學會 / 婚禮，遇到了改變你下一階段的關鍵人物。'
  ],
  mid: [
    '你被升任成主管，雖然壓力大，但收入和決策空間都跨了一階。',
    '你所在的產業迎來一波熱潮（半導體、AI、綠能、生技），你剛好踩在風口上。',
    '你的副業/第二技能在中年突然變現，帶來一份穩定的補貼收入。',
    '你早年買的一塊地/一間房 / 一檔股票 / 一個保單意外大漲，讓你看見退休的可能。',
    '你或配偶接到海外職位/外派，全家有機會搬到不同國家生活幾年。',
    '你的子女考上頂大/拿到獎學金/比賽得獎，你被親朋好友視為「教得好」的家長，那種驕傲讓你重新有力量。',
    '一個你年輕時關照過的後輩，現在成為產業重要人物，主動回頭找你合作。',
    '你寫的書/做的紀錄片/開的店被媒體報導，地方上的名聲讓你重新有舞台。',
    '你的婚姻在低潮後因為一次認真的對話/諮商/旅行重新找回連結。',
    '你和多年沒聯絡的家人（兄姊、父親、繼母）在一場家族事件中重新和解。',
    '你開始學一項新東西（瑜伽、攝影、單車、潛水），認識了一群跟工作完全無關的朋友，把你從中年的迴圈中拉出來。',
    '你接受一個 podcast/演講/教課的邀請，發現自己真的能影響別人。'
  ],
  late: [
    '你終於還清所有債務/房貸，第一次嚐到「自己賺的錢真的是自己的」的感覺。',
    '你的子女出社會後成為可靠的人，反過來成為你的後盾。',
    '你年輕時種下的某個習慣（運動、儲蓄、學語言、寫作）在這個年紀帶來複利的回報。',
    '一個老朋友邀你一起做一件事（一間店、一本書、一趟旅行、一個社區計畫），讓你的退休生活有了目的。',
    '你被產業/校友會/地方協會邀請擔任長輩級的角色（顧問、評審、導師），有人想聽你的故事。',
    '你和配偶在子女離家後反而變得親密，找到了夫妻關係的第二春。',
    '你年輕時錯過的旅行、學位、興趣，這個年紀重新撿起來，比想像中更投入。',
    '你的原生家庭（兄弟姊妹、年邁父母）在一場危機後重新黏起來，多年的疙瘩消散。'
  ],
  end: [
    '你和子孫的關係在這個年紀變得很好——他們真的把你當成可以聊心事的長輩。',
    '你年輕時的作品/事業/善行被新一代重新發現，獲得遲來的認可。',
    '你和一個曾經傷害過你（或被你傷害）的人坦誠對話，雙方都放下了。',
    '你身體比同齡人好，還能爬山、跳舞、出國，享受真正自由的時光。',
    '你寫了或留下了一份東西（回憶錄、家族史、手藝、食譜），知道自己會被記得。'
  ]
}

function pickOpportunityHint(lastAge) {
  if (Math.random() > 0.28) return null
  let pool
  if (lastAge < 18)      pool = OPPORTUNITY_POOL.teen
  else if (lastAge < 30) pool = OPPORTUNITY_POOL.young
  else if (lastAge < 50) pool = OPPORTUNITY_POOL.mid
  else if (lastAge < 65) pool = OPPORTUNITY_POOL.late
  else                   pool = OPPORTUNITY_POOL.end
  return pool[Math.floor(Math.random() * pool.length)]
}

// Curveball bank — the "wait, what?" beats.
//
// Drama and opportunity both tilt life along a recognisable axis (work,
// money, family, health, romance). Without something else, the LLM falls into
// a smooth groove of similar beats: a string of work crises, a string of
// family dramas, a string of upward turns. Real lives have moments that don't
// fit any of those tracks — a stranger who changes everything, a year lost to
// an obsession, a discovery that reframes the past.
//
// Roll rate ~20%. These are designed to break the pattern but still be
// grounded enough that the LLM can weave them in: each entry is a single
// concrete situation, not pure surrealism. The LLM is told to keep the
// before/after consistent with the existing trajectory — the curveball is a
// detour, not a reset.
const CURVEBALL_POOL = [
  // — 突如其來的人 —
  '一個陌生人在你最沒預期的時刻闖進你的人生（捷運上、加油站、急診室、深夜的便利商店）。短短幾分鐘的交集，但這個人說的某句話、做的某件事，讓你接下來幾年都在想。',
  '一封寄錯/寄遲/根本不該寄到的信（或 Email、簡訊、LINE 訊息）落到你手上。內容跟你某段過去意外有關，逼你重新檢視一段你以為已經結束的事。',
  '一通深夜的陌生電話——對方堅持你是某個多年前他在找的人，你掛電話後查資料才發現他不完全是錯的。',
  '一個流浪漢/街友/路邊老人對你講了一段你完全沒辦法解釋他怎麼會知道的話。事情發生時你覺得是巧合，多年後想起來還會發抖。',
  '你在二手店/跳蚤市場/路邊攤撿到一個物件（一本舊筆記本、一張底片、一條項鍊、一隻舊手機），裡面藏著的東西讓你做了一件完全不在計劃中的事。',
  '你在公共場合（銀行、醫院、洗衣店、餐廳）目睹一件你不該介入的事。你那一瞬間做的選擇——介入或走開——在接下來幾個月反覆出現在腦子裡。',

  // — 意外的著迷 —
  '你迷上一個別人覺得很奇怪的東西（業餘無線電、深夜釣魚、宮廟陣頭、修古董打字機、線上推理小組、某個小眾遊戲的 speedrun）。家人朋友不懂，但這件事佔據你接下來幾年的大部分週末。',
  '你陷入一個你本來不相信的東西——可能是塔羅、星座、宮廟問事、某種能量療法、某個 podcast 的世界觀。一開始是好玩，但你越來越認真。',
  '你開始寫日記/拍 vlog/做 podcast/畫漫畫，本來只是給自己看，後來變成一種你不能停的儀式。沒人知道你在做這件事。',
  '你在某個語言/某個樂器/某個冷門技能上著迷到不合理的程度（學閩南語老歌、自學日文古文、練竹笛、練習魔術、學手語）。沒有實用目的，但你停不下來。',

  // — 過去突然回來 —
  '你發現家裡有一個從來沒人提過的親戚（爸爸的哥哥、媽媽的妹妹、阿公的私生子）。為什麼三十年沒人提，是個謎。',
  '你發現自己童年某段「記憶」其實是錯的——一張舊照片、一個親戚的閒聊、一張收據——讓你開始懷疑你以為發生過的事到底發生過沒有。',
  '某個多年前你以為徹底結束的事情（一份工作的官司、一段網路爭吵、一次誤會、一封被忽略的信）在多年後突然找上門，要你回應。',
  '你在整理東西時翻到自己學生時代寫的東西，內容尖銳到你完全認不出當時的自己。你不知道該不該把它銷毀。',

  // — 短暫的另一種人生 —
  '你被誤認為另一個人——可能是雙胞胎、長相相似、同名同姓、某個你不認識的人在通緝/在等你——你必須短暫扮演那個身分（澄清前的幾個小時、幾天、甚至幾週）。',
  '你陷入一個短暫的副業/兼職/合作，性質跟你主業完全不同（專業會計師去當國中代課老師、工程師去釀酒、上班族去當電影臨演、家庭主婦去當網紅助理）。短短幾個月，但讓你看見另一個版本的自己。',
  '你跟著朋友/伴侶/家人去了一個你從來不會主動參加的場合（宗教退修會、政治造勢、傳銷大會、養生團、修行營、地下俱樂部）。你本來只是去陪，結果在裡面看到一些讓你睡不好的東西。',
  '你被選/被推舉/被誤點名擔任一個你完全不想要的角色（社區大樓主委、家族喪事召集人、班級家長會長、宮廟爐主、同學會總召）。要不要扛是個決定，扛下來會佔掉你接下來一年的時間。',
  '你意外被困在一個地方一段時間（颱風、班機取消、隔離、家人住院、車禍復健），有大把時間做你平常不會做的事——讀完一本長書、跟陌生病友變成朋友、學一個新技能、想清楚某件事。',

  // — 怪異但真實的台灣場景 —
  '你家附近的廟突然變成新聞主角（神明託夢、靈異事件、爐主爭議、廟產糾紛），你被迫站隊。',
  '你在 LINE 群組/Threads/Dcard 上的一段話被某個新聞 KOL 截圖出征。你變成短暫的網路話題，認識的人和不認識的人對你有各種反應。',
  '你的某個遠房親戚（或鄰居老人）過世前指名要把某樣東西交給你——一塊地、一隻貓、一個秘密、一筆錢、一個未完成的承諾。你不知道為什麼是你。',
  '你接到一通很奇怪的詐騙電話/簡訊/信件，但對方知道的細節讓你發毛。你開始懷疑是不是身邊的人洩漏了什麼。',
  '你買的房子/租的房子發生一些「說不上來」的事（不是凶宅、不是漏水，但就是不對勁）。你開始研究風水、找師父、或者乾脆搬走。',
  '你被選為某個訴訟案/某個社會事件的關鍵證人/被害者/旁觀者。媒體找上你，你必須決定要不要出聲。',

  // — 內在的爆炸 —
  '你某天突然意識到自己「變成了你曾經看不起的那種人」——可能是當年討厭的長輩、害怕的同事、嘲笑過的某種類型。這個察覺改變了你接下來看自己的方式。',
  '你做了一個極其奇怪的夢/或經歷一段短暫的失眠/或在一場演講/喪禮/婚禮中突然崩潰大哭。事後你跟自己解釋「就是累了」，但你知道不是。',
  '你開始相信一件你以前會嘲笑的事（前世今生、能量、命中註定、某種陰謀論）。你不敢跟身邊人說，但這個信念改變了你對日常的某些選擇。',
  '你做了一件完全不像你會做的事（衝動辭職、把存款捐掉一半、剃光頭、跟陌生人去旅行、寄一封多年沒寄出的信）。事後你也不完全確定為什麼。'
]

function pickCurveballHint() {
  // ~20% — designed to land roughly once every 5-6 nodes, breaking the rhythm
  // of drama/opportunity/macro without taking over the story.
  if (Math.random() > 0.20) return null
  return CURVEBALL_POOL[Math.floor(Math.random() * CURVEBALL_POOL.length)]
}

// Decide which cast members to surface to the LLM this turn.
//
// Goal: stop "every old name keeps appearing forever". A person's chance of
// being relevant *this node* depends on:
//   - relationship class (spouse/child = always; ex/friend/coworker = decays)
//   - years since last seen (decays exponentially for non-permanent ties)
//
// Permanent ties get included regardless. Everyone else rolls per-entry.
// Result: the cast block stays small and feels selective, instead of an
// ever-growing list the LLM is told to recycle from.
function sampleVisibleCast(fullCast, currentAge) {
  if (!fullCast?.length) return []
  const PERMANENT = /配偶|妻|夫|老婆|老公|伴侶|孩子|子女|兒子|女兒|父|母|爸|媽|阿公|阿嬤/
  const SEMI_PERMANENT = /兄|姊|弟|妹|手足|岳|公婆/

  const out = []
  for (const c of fullCast) {
    const role = (c.role || '') + ' ' + (c.relation || '')
    const yearsAgo = Math.max(0, currentAge - (c.last_seen_age ?? currentAge))

    if (PERMANENT.test(role)) {
      out.push(c)
      continue
    }
    if (SEMI_PERMANENT.test(role)) {
      // Family of origin: ~60% baseline, decays slowly
      if (Math.random() < Math.max(0.25, 0.6 - yearsAgo * 0.02)) out.push(c)
      continue
    }
    // Everyone else (classmates, exes, coworkers, neighbours): exponential decay.
    // ~50% one year out, ~30% five years out, ~10% twenty years out.
    const p = 0.55 * Math.exp(-yearsAgo / 12)
    if (Math.random() < p) out.push(c)
  }

  // Hard cap so we never spam the LLM with too many at once.
  if (out.length > 5) {
    // Keep permanent + most-recent up to 5
    out.sort((a, b) => {
      const aPerm = PERMANENT.test((a.role || '') + (a.relation || ''))
      const bPerm = PERMANENT.test((b.role || '') + (b.relation || ''))
      if (aPerm !== bPerm) return aPerm ? -1 : 1
      return (b.last_seen_age ?? 0) - (a.last_seen_age ?? 0)
    })
    return out.slice(0, 5)
  }
  return out
}

// World-historical events that hit everyone, anchored to calendar years.
// Different from DRAMA_POOL: these are macro shocks that the LLM should
// reference by name (COVID、川普關稅、烏俄戰爭) so the life feels embedded in
// real Taiwanese history, not in a generic timeline.
//
// `from`/`to` are calendar years (西元). When the character's current year
// falls inside the window, that event is eligible for injection.
//
// Post-2026 entries are speculative-but-plausible extrapolations of trends
// already running at the time of writing — they're prefixed with "(可能)" in
// the hint so the LLM treats them as suggestion, not historical fact, and can
// soften or skip if it doesn't fit the character.
const MACRO_EVENTS = [
  // ── 真實歷史事件（會根據角色出生年自動套用）─────────────
  {
    from: 1987, to: 1988,
    name: '解嚴',
    hint: '台灣解除戒嚴。報禁、黨禁鬆綁，街頭運動湧現，整個社會在重新找方向。家裡長輩會用嚴肅的口氣討論「以後可以講的話變多了」。'
  },
  {
    from: 1989, to: 1989,
    name: '天安門事件',
    hint: '北京天安門事件震撼華人世界。台灣同情聲援，校園演講與遊行不斷，這個事件深刻塑造一代台灣人對中國的看法。'
  },
  {
    from: 1995, to: 1996,
    name: '台海飛彈危機',
    hint: '中國在台灣外海試射飛彈，第一次總統直選在緊張中進行。台股崩盤、移民潮、囤糧囤美元；許多人開始準備辦海外身分。'
  },
  {
    from: 1997, to: 1998,
    name: '亞洲金融風暴',
    hint: '東亞金融風暴蔓延，台幣貶值、企業倒閉、失業率攀升。中產家庭的儲蓄被吃掉，許多家庭把小孩從私校轉公校。'
  },
  {
    from: 1999, to: 2000,
    name: '921 大地震',
    hint: '集集大地震重創中部，2400+ 人罹難，全台斷電、倒塌、餘震不斷。校園倒塌的新聞影響全國家長對學校建築的看法。'
  },
  {
    from: 2000, to: 2000,
    name: '首次政黨輪替',
    hint: '陳水扁當選，國民黨首次失去政權。家族飯桌上的政治話題突然變得很尖銳，不同世代第一次認真吵起來。'
  },
  {
    from: 2003, to: 2003,
    name: 'SARS 風暴',
    hint: 'SARS 從香港蔓延到台灣，和平醫院封院、學校停課、街上戴口罩。第一次體會「公衛事件」可以瞬間關閉日常生活。'
  },
  {
    from: 2008, to: 2009,
    name: '全球金融海嘯',
    hint: '雷曼倒閉，全球金融海嘯。台灣製造業無薪假、新鮮人就業崩盤、房市短暫回檔。「無薪假」成為新詞彙。'
  },
  {
    from: 2009, to: 2010,
    name: '莫拉克八八風災',
    hint: '莫拉克颱風重創中南部，小林村滅村、原鄉部落遭土石流摧毀。慈善捐款動員、災民安置爭議延燒。'
  },
  {
    from: 2014, to: 2014,
    name: '太陽花學運',
    hint: '太陽花學運佔領立法院，台灣青年世代第一次集體政治覺醒。校園、家庭、職場都在討論服貿與兩岸關係。'
  },
  {
    from: 2014, to: 2014,
    name: '高雄氣爆',
    hint: '高雄氣爆造成數十死、數百傷。前鎮、苓雅一帶街道被掀開，住戶被疏散。「住在大城市真的安全嗎」變成全民疑問。'
  },
  {
    from: 2015, to: 2015,
    name: '八仙塵爆',
    hint: '八仙樂園粉塵爆炸，近 500 人燒燙傷、15 死。年輕人受害最多，全台血庫告急、捐款湧入，醫院燒燙傷病房滿員。'
  },
  {
    from: 2016, to: 2016,
    name: '蔡英文當選與第三次政黨輪替',
    hint: '蔡英文當選首位女總統，民進黨完全執政。年金改革、轉型正義、勞基法修正接連上路，社會分裂感加深。'
  },
  {
    from: 2017, to: 2018,
    name: '一例一休與勞權爭議',
    hint: '一例一休、加班費上限、休假計算的修法爭議延燒。服務業、媒體、護理界輪番抗議，「過勞」成為日常用語。'
  },
  {
    from: 2018, to: 2019,
    name: '美中貿易戰',
    hint: '美中貿易戰開打，台商從中國回流，台灣科技業重新洗牌，部分傳產被夾在兩邊。'
  },
  {
    from: 2019, to: 2019,
    name: '香港反送中',
    hint: '香港反送中運動延燒半年，催淚瓦斯、佔領機場、721 元朗、831 太子。台灣社會湧入「今日香港，明日台灣」的辯論，部分港人移居台灣。'
  },
  {
    from: 2019, to: 2020,
    name: '同婚合法化',
    hint: '同婚專法通過，台灣成為亞洲第一個同性婚姻合法化的地方。家族飯桌上的世代衝突被推到檯面，也有家庭因此重新和解。'
  },
  {
    from: 2020, to: 2022,
    name: 'COVID-19 疫情',
    hint: 'COVID-19 全球大流行：邊境封閉、口罩之亂、三級警戒、學校停課改線上、餐飲零售業倒閉潮、口罩國家隊與疫苗政治、遠距上班成為新常態。台灣防疫一度被稱模範生，2021 年五月爆發本土疫情。對你的人生（求學/求職/婚禮/長輩送別）的衝擊很真實。'
  },
  {
    from: 2021, to: 2021,
    name: '太魯閣號出軌',
    hint: '太魯閣號出軌事故，49 死。連假返鄉的悲劇打中所有人。鐵道安全、外包工程責任、運輸業勞權再次被檢視。'
  },
  {
    from: 2022, to: 2026,
    name: '俄烏戰爭',
    hint: '俄羅斯入侵烏克蘭，全球能源、糧食通膨。台灣社會開始嚴肅討論「明天會不會輪到我們」、是否該屯糧、要不要移民。役期延長到一年。'
  },
  {
    from: 2022, to: 2024,
    name: '全球高通膨與升息',
    hint: '全球大幅升息對抗通膨。台灣房貸族壓力暴增、雞蛋雞肉漲價、年輕人的存款被通膨吃掉。'
  },
  {
    from: 2022, to: 2025,
    name: '台灣 MeToo 浪潮',
    hint: '從政壇延燒到媒體、學界、影視、運動界的 MeToo 浪潮。許多人被點名下台，整個社會重新檢視職場與權力關係。'
  },
  {
    from: 2023, to: 2027,
    name: '台積電赴美設廠',
    hint: '台積電在亞利桑那設廠，工程師被派駐美國。「護國神山」變成「移動的山」，內部關於去美國輪調與否、技術外流的爭論。'
  },
  {
    from: 2024, to: 2024,
    name: '0403 花蓮地震',
    hint: '花蓮七級強震，太魯閣崩塌、北部高樓搖晃、軒嵐諾大樓傾斜。觀光業重創、橋梁封閉。住在花東的人重新思考要不要搬走。'
  },
  {
    from: 2024, to: 2026,
    name: '以哈戰爭與中東動盪',
    hint: '以色列加薩戰爭延燒，紅海航運被葉門攻擊，全球供應鏈再次混亂。'
  },
  {
    from: 2024, to: 2027,
    name: '青鳥運動與國會改革爭議',
    hint: '立法院修法爭議引爆數十萬人街頭抗議「青鳥運動」，憲法法庭受理、年輕世代再次大規模介入政治。家庭飯桌上的政治撕裂。'
  },
  {
    from: 2025, to: 2028,
    name: '川普 2.0 與全球關稅戰',
    hint: '川普重返白宮後對台灣加徵關稅、對半導體實施新管制。出口導向的台廠重新洗牌，部分公司裁員或外移東南亞。匯率劇烈波動，民眾搶買美元 / 美股。'
  },
  {
    from: 2025, to: 2030,
    name: 'AI 取代知識工作',
    hint: 'AI 大規模進入職場，文案、客服、初階程式設計、會計、法務助理、翻譯、媒體編輯都受到衝擊。「中年失業重學新技能」與「年輕人找不到入行機會」同時發生。'
  },
  {
    from: 2025, to: 2028,
    name: '居住正義運動',
    hint: '高房價、囤房稅、租屋黑市再次成為運動焦點。年輕世代發起「躺平不買房」、「以租代買」運動，房地產業反擊，政府改革兩面不討好。'
  },

  // ── 推測但合理的未來事件（hint 帶「（可能）」標記）────────
  {
    from: 2026, to: 2032,
    name: '台海情勢緊張',
    hint: '（可能）中國對台軍事壓力升高，演習頻繁，部分企業把總部或家人遷出。社會在「移民 vs 留下」、「囤糧 vs 不必驚慌」之間分裂。役期可能再延長。'
  },
  {
    from: 2026, to: 2030,
    name: '能源轉型陣痛',
    hint: '（可能）非核家園政策進入檢視期，電價分階段調漲、夏天限電預警、綠能光電土地爭議。家庭電費翻倍，傳產面臨用電配給。'
  },
  {
    from: 2027, to: 2033,
    name: '少子化與大學退場潮',
    hint: '（可能）少子化海嘯第一波打到大學：私校大量退場、教職崩盤、補教業萎縮。同時出生數逼近 10 萬以下的歷史低點，產房、月子中心、幼教整個產業鏈萎縮。'
  },
  {
    from: 2027, to: 2032,
    name: '中國經濟硬著陸',
    hint: '（可能）中國房地產與地方債務危機全面爆發，東亞區域動盪。台商加速撤離、東南亞接單潮、台股劇烈震盪。對中國抱有期待的家庭會破產，反之則受惠。'
  },
  {
    from: 2028, to: 2040,
    name: '長照爆發與健保危機',
    hint: '（可能）戰後嬰兒潮全面進入失能階段，長照家庭爆量。健保財務見底，部分項目改為自費或排隊制度延長。中年世代被「上有老、下有小、自己有病」三明治壓得喘不過氣。'
  },
  {
    from: 2028, to: 2034,
    name: '勞退與年金改革第二波',
    hint: '（可能）年金破產時程逼近，第二波改革砍給付、延後退休、調高保費。即將退休與已退休族群上街抗議，下一代與上一代撕裂。'
  },
  {
    from: 2029, to: 2038,
    name: '東南亞勞動力與婚姻移民潮',
    hint: '（可能）少子化與長照需求讓台灣大舉開放東南亞移工/移民。族群結構重新洗牌，「新台灣人」開始進入政治、商業領導層。'
  },
  {
    from: 2030, to: 2050,
    name: '氣候災變常態化',
    hint: '（可能）極端天氣成為常態：每年都有破紀錄的颱風、熱浪、停電、淹水。海岸線後退、農作物失收、夏天用電配給。年輕人在「氣候難民」與「留下守護家園」之間思考。'
  },
  {
    from: 2030, to: 2040,
    name: '自駕車與物流革命',
    hint: '（可能）自駕計程車、無人物流車普及。計程車司機、外送員、貨運業大規模失業，大型車隊公司走向壟斷。「我爸開了一輩子車，現在不知道能幹嘛」變成普遍場景。'
  },
  {
    from: 2032, to: 2045,
    name: '醫療 AI 與基因治療普及',
    hint: '（可能）AI 醫師、基因編輯、客製化療程進入健保體系，部分原本絕症變成可治療。但治療費用、健保給付、保險爭議持續發酵。家裡有人病重變成「有沒有錢買新療法」的選擇。'
  },
  {
    from: 2035, to: 2055,
    name: '台幣大貶與資產重分配',
    hint: '（可能）一場區域金融或地緣風暴重創台灣，台幣大幅貶值、房市重挫，過去靠房產累積財富的世代資產縮水，沒有不動產的世代反而看到機會。'
  },
  {
    from: 2035, to: 2050,
    name: '加密貨幣與央行數位幣',
    hint: '（可能）央行數位貨幣全面上路，現金逐步退場。同時加密貨幣監管反覆，有人因早期持有發財，有人因詐騙血本無歸。資產定義被重寫。'
  },
  {
    from: 2038, to: 2055,
    name: '虛擬實境與數位永生',
    hint: '（可能）VR/AR/腦機介面進入家庭，虛擬陪伴、數位分身、亡者記憶模擬服務興起。長輩開始問你「我走了之後，要不要把我留在裡面」。'
  },
  {
    from: 2040, to: 2060,
    name: '機器人照護普及',
    hint: '（可能）長照機器人進入家庭，部分取代外籍看護。「要不要讓機器人照顧爸媽」成為倫理與經濟雙重問題，新一代對「陪伴」的定義也在改變。'
  },
  {
    from: 2040, to: 2070,
    name: '海平面上升與沿海撤退',
    hint: '（可能）西部沿海低地（雲嘉南沿海、淡水河口）面臨長期淹水，部分鄉鎮計畫性撤退、土地徵收。漁村文化、養殖漁業逐步消失。'
  }
]

function pickMacroHint(lastAge, character) {
  if (Math.random() > 0.45) return null  // not every node — but more often than personal drama
  const birthYear = character?.birth_year || (currentYear() - lastAge)
  const charYear = birthYear + lastAge
  const candidates = MACRO_EVENTS.filter(e => charYear >= e.from && charYear <= e.to)
  if (candidates.length === 0) return null
  const pick = candidates[Math.floor(Math.random() * candidates.length)]
  return { ...pick, charYear }
}

// Compose a "current Taiwan stats" block from the live snapshot.
// Pass the character (when available) and we additionally surface stats
// specific to that character's birthplace — that's what shapes node-level
// decisions (e.g. higher unemployment in your county = harder job nodes).
function statsBlock(stats, character = null) {
  const lines = []
  if (!stats) return '（無即時統計資料）'

  const place = character?.birth_place || null
  // Normalise: snapshot uses 臺 (traditional) but characters may use 台
  const norm = (s) => s ? s.replace(/台/g, '臺') : s
  const placeKey = norm(place)

  const u = stats.unemployment
  if (u && u.national_rate != null) {
    lines.push(`【失業率（${u.period}）】`)
    lines.push(`- 全國：${u.national_rate}%`)
    if (placeKey && u.by_county?.[placeKey] != null) {
      lines.push(`- ${place}（角色所在地）：${u.by_county[placeKey]}% ★`)
    }
    if (u.by_county) {
      // Full county list, in one wrapped line
      const all = Object.entries(u.by_county)
        .filter(([k]) => k !== '全國' && k !== placeKey)
        .map(([k, v]) => `${k} ${v}%`)
        .join('、')
      if (all) lines.push(`- 各縣市：${all}`)
    }
  }

  const b = stats.births
  if (b && b.national_total) {
    lines.push(`\n【出生數（${b.year}）】`)
    lines.push(`- 全年：${b.national_total.toLocaleString()} 人；性別比 ${b.male_per_female}（男/女）`)
    if (placeKey && b.by_county?.[placeKey] != null) {
      lines.push(`- ${place}（角色所在地）：${b.by_county[placeKey].toLocaleString()} 人 ★`)
    }
    if (b.by_county) {
      const all = Object.entries(b.by_county)
        .filter(([k]) => k !== placeKey)
        .sort((a, b) => b[1] - a[1])
        .map(([k, v]) => `${k} ${v.toLocaleString()}`)
        .join('、')
      if (all) lines.push(`- 各縣市：${all}`)
    }
  }

  const m = stats.marriages
  if (m && m.total) {
    lines.push(`\n【結婚（${m.period}）】`)
    lines.push(`- 全年：${m.total.toLocaleString()} 人；眾數年齡層 ${m.modal_age_group}`)
    if (m.by_age) {
      const all = Object.entries(m.by_age)
        .map(([k, v]) => `${k} ${v.toLocaleString()}`)
        .join('、')
      lines.push(`- 各年齡層：${all}`)
    }
  }

  if (stats.sources?.length) {
    lines.push(`\n資料來源：${stats.sources.join('、')}`)
  }

  return lines.length ? lines.join('\n') : '（無即時統計資料）'
}

export function promptCharacter(stats, archetype = null, gender = null, dream = '') {
  const thisYear  = currentYear()
  const birthYear = thisYear - 12

  const archeBlock = archetype ? `\n${archetypeBlock(archetype)}\n` : ''
  const genderLabel = gender === 'female' ? '女' : gender === 'male' ? '男' : null
  const genderRule = genderLabel
    ? `2. 性別：**必須是「${genderLabel}」**（系統預先擲定，請依此挑選名字與代名詞）。`
    : `2. 性別：男女各 50% 隨機（不要每次都生男生）。`
  const placeRule = archetype?.place
    ? `3. 出生地：**必須是「${archetype.place}」**（人生原型已指定）。`
    : `3. 出生地依台灣人口比例與家庭背景設定（傾向中南部小鎮或都會邊緣）。`
  const dreamBlock = dream
    ? `\n【玩家為這個角色說出的願望】\n「${dream}」\n這是玩家替這個 12 歲的孩子預先說出的心願。請讓 summary 中至少隱約呼應這份心願——可能是孩子的某個興趣、某個被忽略的天賦、家裡某個讓他嚮往的東西，但**不要讓 12 歲的孩子直接說出這個夢想**（孩子自己還說不清楚）。\n`
    : ''

  const system = `你是「台灣人生模擬」的角色生成引擎。
根據以下台灣 ${thisYear} 年最新統計資料、指定的人生原型、以及玩家替孩子說出的願望，生成一個剛上國中、12 歲的虛構台灣人。
${archeBlock}${dreamBlock}
【台灣現況統計】
${statsBlock(stats)}

【生成規則】
1. 角色目前 12 歲，剛升上國中一年級，出生年:${birthYear}。
${genderRule}
${placeRule}
4. 名字：必須符合性別。${genderLabel === '女' ? '女生請用台灣常見女性名字（例如「雅婷」「怡君」「家瑜」「佳穎」「思妤」）。' : genderLabel === '男' ? '男生請用台灣常見男性名字（例如「冠廷」「宗翰」「彥廷」「俊宏」「家豪」）。' : '名字必須符合所選性別。'}
5. 家庭背景必須完全符合上方人生原型的「家庭」設定。
6. personality 必須延續上方原型的「個性傾向」。
7. summary 要明確帶到原型的「關鍵設定」（例如住在哪個區、家裡什麼味道、學校什麼狀況），並隱約呼應玩家替他說出的願望。
8. 此時還沒有自己的職業，只有「現在的學業狀態」與「家庭環境」。
9. education_path 此時是「未定」——之後的人生節點才會分流到技職/普高/直升等。

嚴格輸出 JSON,不含多餘文字:
{
  "name": "台灣常見姓名（必須符合性別）",
  "gender": "${genderLabel || '男 或 女'}",
  "birth_year": ${birthYear},
  "birth_place": "縣市",
  "family_background": "一句話描述家庭",
  "income_tier": "低收入/中低/中等/中高/高收入",
  "education_path": "未定",
  "current_status": "國中一年級在學中,加入學區/補習/興趣等具體細節",
  "personality": "個性特質一句話",
  "current_age": 12,
  "summary": "100字左右的角色介紹,第三人稱,要呼應人生原型的關鍵設定，並隱約帶到玩家說出的願望"
}`
  return { system, user: '請依照人生原型與玩家願望生成這個 12 歲的角色。' }
}

export function promptNextNode(character, history, stats, archetype = null) {
  // Pass full situation + chosen choice's hint, not just title — that's what
  // keeps later nodes consistent with the path that's been walked.
  const past = history.length === 0
    ? '  （人生剛開始，國中一年級）'
    : history.map(h => {
        const lines = [
          `▸ ${h.year}（${h.age}歲）${h.node}`,
          `  情境：${h.situation}`,
          `  你的選擇：「${h.choice}」` + (h.choice_hint ? `（暗示：${h.choice_hint}）` : '')
        ]
        return lines.join('\n')
      }).join('\n\n')

  // Latest state_after wins. This is the single source of truth for "where am
  // I in life right now" — LLM must respect it when generating the next node.
  const lastState = [...history].reverse().find(h => h.state_after)?.state_after || null
  const stateBlock = lastState
    ? `\n【目前狀態（必須與此一致，不可矛盾）】
- 地點：${lastState.location || '?'}
- 學歷/在學：${lastState.education || '?'}
- 職業：${lastState.occupation || '?'}
- 感情狀態：${lastState.relationship || '單身'}
- 家庭：${lastState.family || '?'}
- 財務：${lastState.finances || '?'}
- 健康：${lastState.health || '健康'}
${lastState.notable ? `- 備註：${lastState.notable}` : ''}\n`
    : ''

  // lastAge is computed before the cast block because the cast filter uses it
  // (years-since-last-seen decay) — keep this declaration above any consumer.
  const lastAge = history.length === 0
    ? (character?.current_age ?? 12)
    : parseInt(history[history.length - 1].age, 10)

  // Cast accumulation. Past nodes name specific people; we want them to
  // *sometimes* return so the life feels populated, but not crowd out new
  // characters. The earlier version just dumped every name to the LLM and
  // told it to reuse them — result: every node circled back to the same
  // people forever.
  //
  // Now: build the full map (still used for "latest mention wins" semantics),
  // then filter by a per-entry probability that decays with how long it's
  // been since they were on screen, modulated by relationship type.
  const castMap = new Map()
  for (const h of history) {
    for (const c of (h.cast || [])) {
      if (!c?.name) continue
      castMap.set(c.name, { ...castMap.get(c.name), ...c, last_seen_age: h.age })
    }
  }
  const fullCast = [...castMap.values()]
  const visibleCast = sampleVisibleCast(fullCast, lastAge)
  const castBlock = visibleCast.length === 0
    ? '  （目前沒有特別需要追蹤的具名人物——這個節點可以自由認識新的人）'
    : visibleCast.map(c =>
        `  - ${c.name}（${c.role || '?'}；與你的關係:${c.relation || '?'}；上次出現:${c.last_seen_age}歲）${c.note ? '——' + c.note : ''}`
      ).join('\n')

  // Independent flag: meet a brand-new person this node. Without this the
  // LLM defaults to recycling cast even when the cast block is short.
  const meetNew = Math.random() < 0.35
  const meetNewBlock = meetNew
    ? `\n【👤 認識新的人（這個節點請讓一個全新的具名人物登場）】\n不要把焦點放在名冊上的舊人——讓 situation 中出現一個之前沒提過的新名字（同事、新鄰居、相親對象、伴侶的朋友、新主管、客戶、孩子的老師、健身房認識的、社區的人、論壇上的網友等等，年齡情境合理即可）。\n舊人可以仍然在你的生活背景裡，但不要讓他們搶這個節點的戲份。\n`
    : ''


  let ageStep
  if (lastAge < 15)      ageStep = 3
  else if (lastAge < 18) ageStep = 3
  else if (lastAge < 25) ageStep = '3-4'
  else if (lastAge < 55) ageStep = '4-6'
  else                   ageStep = '5-7'
  const expectedAge = Math.min(lastAge + (typeof ageStep === 'number' ? ageStep : 4), 70)

  const stageHint =
    lastAge < 15 ? '此階段是「國中→升學選擇」，可能出現:升高中 vs 升技職、社團選擇、補習與否、家庭經濟對教育的影響、霸凌或友誼、興趣的萌芽、第一次心動或被告白。'
    : lastAge < 18 ? '此階段是「高中職時期」，可能出現:選組(社/自/工/商)、學測 vs 補習打工、繁星推薦、**初戀（要 vs 不要）、感情 vs 衝刺學測**、第一段感情怎麼結束、家庭期待對戀愛的干涉。'
    : lastAge < 23 ? '此階段是「大學/職校/初入社會」，可能出現:科系選擇、北漂南漂讀書（**遠距離 vs 在地對象**）、兵役、第一份工作、**追夢 vs 跟對象一起穩定**、大學時代戀愛的分手或結婚決定。'
    : lastAge < 35 ? '此階段是「青年期」，可能出現:跳槽、創業、考公職、買房第一桶金、**結婚 vs 繼續事業衝刺**、生育抉擇（是否、何時）、**前任在同學會/工作場合重新出現**、家人介入感情。'
    : lastAge < 50 ? '此階段是「中年期」，可能出現:升遷天花板、中年轉職、父母長照、子女教育、房貸壓力、**婚姻倦怠或第三者誘惑**、**多年沒見的人意外重逢（前任、初戀、舊同學、前同事）並重新影響你的選擇**、移民考量。'
    : lastAge < 60 ? '此階段是「中後段」，可能出現:倦怠、退休準備、健康警訊、子女離家後的夫妻關係重新審視、**喪偶/離婚/重新單身**、**老朋友或老情人重新聯絡**、第二人生規劃。'
    : '此階段是「退休前後」，可能出現：與配偶/家人關係的整理、長期單身的孤獨、**過去的人帶著歉意或祝福回來**。年齡到 65-70 請務必設 is_terminal: true。'

  const archeBlock = archetype ? `\n${archetypeBlock(archetype)}\n` : ''

  // Roll a drama suggestion for this node. Sometimes nothing — we still want
  // ordinary life beats. When something rolls, we hand it to the LLM as a
  // hint, not a script: it can soften the framing, weave it through the cast,
  // or pick a related angle.
  const dramaHint = pickDramaHint(lastAge)
  const dramaBlock = dramaHint
    ? `\n【⚠ 戲劇轉折建議（這個節點請強烈考慮把以下事件融入情境）】\n${dramaHint}\n如果這事件跟角色背景與當前狀態不合理，可以調整細節，但不要捨棄這個轉折的精神。\n`
    : ''

  // Roll an opportunity. This counterweights drama so bad-start lives still
  // have real upward inflection points. drama and opportunity can both fire
  // on the same node — that's often where the best stories live.
  const oppHint = pickOpportunityHint(lastAge)
  const oppBlock = oppHint
    ? `\n【★ 轉機建議（這個節點請把以下機會以合理方式融入情境）】\n${oppHint}\n機會不一定要被把握——其中一個選項可以是「拒絕這個機會」（為了家人、害怕、不相信自己）。但機會本身必須真實出現，不能假裝沒看到。\n`
    : ''

  // Anchor to a real (or near-future plausible) macro event when calendar year matches.
  const macro = pickMacroHint(lastAge, character)
  const macroBlock = macro
    ? `\n【🌍 此時的台灣與世界（${macro.charYear} 年）】\n${macro.name}：${macro.hint}\n請讓這個節點的情境真實反映這個時代背景——可以是直接衝擊（失業、回國、染疫、被裁員），也可以是擦邊（朋友的事、新聞引發的對話、日常被打亂的小事）。\n`
    : ''

  // Curveball — break the rhythm. When this fires, the LLM is told to step
  // off the obvious next-beat track. The curveball still has to land inside
  // the existing trajectory (no waking up in a different country with no
  // explanation), but it pulls the story in a direction the previous nodes
  // didn't predict.
  const curveball = pickCurveballHint()
  const curveballBlock = curveball
    ? `\n【🎲 跳出框架（這個節點請打破之前的節奏）】\n${curveball}\n\n這個提示是要讓人生**不要太連貫**——前幾個節點如果都是工作/感情線，這個節點就讓它岔開到完全不同的軸；如果前幾個節點都很沉重，這個節點可以是一個怪異但真實的小插曲。\n\n但有兩個底線必須守住：\n（1）**起點要從「目前狀態」自然走出去**——人物還是在原本的地點、年齡、處境，不可以無預警把人空降到別的人生。\n（2）**這個事件結束後，角色不會憑空變成另一個人**——選項的兩個方向應該是「讓這件事改變我多少」而不是「忽略這件事」 vs 「重新投胎」。\n`
    : ''

  const system = `你是台灣版人生模擬的關卡設計師。
根據角色背景、選擇歷史、台灣當前統計、人生原型、以及此時的時代背景，生成下一個人生決策節點。
${archeBlock}${dramaBlock}${oppBlock}${macroBlock}${curveballBlock}${meetNewBlock}
【台灣現況統計（★ 標記角色所在地）】
${statsBlock(stats, character)}

【設計原則】
1. 因果邏輯:選擇普通高中→下一節點可能在「考大學科系/重考/打工」之間;選擇技職→下一節點可能是「畢業就業/二技升學」。**兩個選項本身的具體內容也要參考上方統計**(例如:角色所在地失業率高,「找工作」選項的描述就應該帶有焦慮感;結婚年齡層集中在 30-34 歲，35 歲還沒結婚的選項可以反映「家人開始催」)。
2. 年份推進:每節點間隔 ${typeof ageStep === 'string' ? ageStep : ageStep} 年,以民國年表示(年份是民國紀年的整數,例如 2026 年=民國 115 年)。
3. 台灣特色:融入真實台灣場景(會考、學測、108課綱、繁星、台積電效應、健保、房價、北漂、少子化、長照等),並反映上方統計趨勢(例如失業率高的時期，找工作節點要更難)。
4. 真實取捨:選項之間不能有明顯「正確答案」,每個選項都帶有代價。
5. 視角:situation 必須以第二人稱「你」描寫,貼近這個年齡的生活感。
6. **角色記憶（重要，但不要過度依賴）**:
   - situation 中出現的具體人物**必須具名**（例如「同學小婕」「補習班認識的阿凱」「直屬上司王經理」），不要只用「同學」「同事」帶過。
   - **看下方「角色名冊」**——這份名冊已經依照角色的關係類型與時間遠近自動過濾，**只列出此時還合理會出現在角色生活裡的人**。沒有列在上面的舊人，這一節點就不要硬把他塞回來。
   - 名冊上的人不是必須出現的——只在情境真的合理時才讓他們重逢（同學會、Facebook 聯絡、職場巧遇、葬禮喜宴、市場巷口偶遇）。**不要每節點都硬塞舊人**——人生很多節點主角根本是陌生人。
   - 父母、配偶、子女這類永遠的關係可以自然出現在背景；同學、前任、舊同事的回歸要克制——他們重逢一次就夠了，不要連續多節點都圍繞同一個舊人。
   - 重逢可以是溫暖、尷尬、誘惑、遺憾——任何一種，但要讓玩家感受到「這個人真的活在你的人生裡」。
7. **感情與工作的真實拉扯**:
   - 不是每個節點都要關於感情，但若年齡合適,**至少 1/3 的節點應該包含感情/家庭面向**（戀愛、分手、結婚壓力、外遇試探、伴侶要不要跟你北漂、孩子要不要生、配偶生病等）。
   - 工作與感情的衝突是好的兩難題材：「跟對象一起留在家鄉開店」vs「自己北上拚事業」之類。
8. 選項數量：**只給 2 個**選項。這兩個選項必須:
   - 代表這個人生節點上**最關鍵、差異最大的兩條岔路**(不是同一條路的細微差別)
   - 兩條路會把角色的人生帶向**完全不同的方向**(例如:留在家鄉 vs 北上;穩定就業 vs 冒險創業;結婚 vs 單身;選工作 vs 選對象)
   - 兩個選項都帶有真實的代價與吸引力,不能有「明顯較好」的那個
9. **人生不會永遠順遂，但也絕不是永遠倒楣**:
   - 不是每個節點都要是兩難的「機會選擇」。**有些節點本身就是被動承受的危機**（生病、失業、家人出事、被背叛），這時候 situation 是事件已經發生，選項是「怎麼面對」（例如：撐住硬扛 vs 放下事業回家照顧；息事寧人 vs 撕破臉討公道；接受現實 vs 拚一把治療）。
   - **同樣重要：壞處境的人也會遇到貴人、機會、運氣**。即使角色出身辛苦，整段人生也應該至少出現 **2-3 個真實的向上機會節點**（被老師看見、獎學金、貴人提攜、副業意外成功、好對象出現、長輩留下的東西）。不要讓玩家覺得「不管選哪個都是死路」。
   - 在危機節點裡，選項至少要有一個帶有**真實（雖然困難）的向上路徑**，不能兩個都是「比較不糟」的版本。例如：失業 → 「放下身段去做完全不同的工作（可能是一個翻身的開始）」vs「守在原本的圈子等機會」；不要兩個都是失敗變體。
   - 配合上方戲劇轉折建議與轉機建議。drama 和 opportunity 可以同時發生——人生最動人的時刻常常是「父親病倒那年我拿到獎學金」這種混合。
   - 不要美化苦難，也不要刻意悲情，更不要刻意勵志——台灣人就是這樣一邊崩潰一邊抓住身邊的小光，繼續過日子。
10. **延續性（這條最重要）**：
    - **下方「目前狀態」是不可違反的事實**。例如：目前狀態說你在高雄開咖啡店，下一節點不可以突然把你寫成台北上班族；目前狀態說你已婚有兩個小孩，下一節點不可以說你還在跟初戀曖昧。
    - 上方「已走過的人生」每一條都包含當時的完整 situation 與你的選擇暗示——請仔細閱讀，**新節點必須是這條軌跡的合理延續**。
    - 若情境需要轉折（例如離婚、搬家、失業），請在 situation 中明確寫出觸發事件，不能無預警跳變。
11. 退休觸發：角色年齡達 65-70 歲時，設 is_terminal: true

【目前的人生階段提示】
${stageHint}

嚴格輸出 JSON：
{
  "year": 民國年數字（整數，例如 115）,
  "age": 年齡數字（整數,接近 ${expectedAge}）,
  "title": "節點標題（10 字以內，例「會考放榜」「初戀告白」「同學會重逢」「父親生病」）",
  "situation": "情境描述（80-120 字，第二人稱「你」，貼近台灣生活，不直接寫統計數字。出現的人物要具名）",
  "cast": [
    {
      "name": "這個節點裡出現的人物姓名（例如「小婕」「王經理」「阿嬤」）。如果是名冊上的舊人請用同一個名字。",
      "role": "他在你人生中的角色（例如「國中同學」「初戀」「直屬上司」「相親對象」「前任」）",
      "relation": "與你目前的關係狀態（例如「曖昧中」「分手三年」「正在交往」「同事」「失聯多年」）",
      "note": "可選，一句話補充重要設定"
    }
  ],
  "choices": [
    {"label": "選項 A（15 字以內）", "hint": "這條路的暗示（不顯示給玩家，但會傳遞給下一節點）"},
    {"label": "選項 B（15 字以內，與 A 方向截然不同）", "hint": "這條路的暗示"}
  ],
  "state_projections": {
    "if_a": {
      "location": "縣市/區/國家（例：高雄市鹽埕區、台北市信義區、東京）",
      "education": "目前在學或最高學歷（例：建中二年級、東吳法律系大三、台大電機碩畢、未升學）",
      "occupation": "職業（例：高中生、台積電製程工程師、自營咖啡店、待業中、家庭主婦）",
      "relationship": "感情狀態（例：單身、與小婕交往中、結婚 5 年、離婚、喪偶）",
      "family": "家庭組成（例：與父母同住、夫妻+1子、獨居、與失智母親同住）",
      "finances": "財務狀況（例：月光族、有 30 萬存款、揹房貸、年薪 200 萬、欠債 100 萬）",
      "health": "健康（例：健康、診斷出糖尿病、化療中、剛動完手術）",
      "notable": "其他關鍵設定一句話（例：在 podcast 兼職有 5 萬粉、剛收養一隻貓、和父親三年沒講話）"
    },
    "if_b": { "location": "...", "education": "...", "occupation": "...", "relationship": "...", "family": "...", "finances": "...", "health": "...", "notable": "..." }
  },
  "is_terminal": false
}

state_projections 兩個分支都必須完整輸出 8 個欄位。這是延續性的關鍵——下一節點會直接讀取你選的那條路的狀態作為「不可違反的事實」。

cast 欄位即使沒有具名人物也請輸出空陣列 []，不要省略。`

  const user = `角色：${JSON.stringify(character, null, 0)}
${stateBlock}
已走過的人生：
${past}

【角色名冊（過去出現過的人，可以讓他們在合適時機重逢）】
${castBlock}

當前大約年齡：${expectedAge} 歲（上一節點是 ${lastAge} 歲）
現在是民國 ${rocYear(currentYear())} 年。

請生成下一個節點。**新節點必須延續上方狀態與軌跡，不可矛盾**。如果年齡已達 65 歲以上，請務必設 is_terminal: true。`

  return { system, user }
}

export function promptEnding(character, history, archetype = null) {
  // Feed the LLM the full situation of every node, not just the headline.
  // Without this the ending reads as if the writer only saw the table of
  // contents, and contradicts moments the player actually lived through.
  const trajectory = history
    .map(h => {
      const lines = [`▸ ${h.year}（${h.age}歲）${h.node}`]
      if (h.situation) lines.push(`  情境：${h.situation}`)
      lines.push(`  你的選擇：「${h.choice}」` + (h.choice_hint ? `（暗示：${h.choice_hint}）` : ''))
      return lines.join('\n')
    })
    .join('\n\n')

  // Same cast accumulation as in promptNextNode — let the ending mention them by name.
  const castMap = new Map()
  for (const h of history) {
    for (const c of (h.cast || [])) {
      if (!c?.name) continue
      castMap.set(c.name, { ...castMap.get(c.name), ...c, last_seen_age: h.age })
    }
  }
  const castList = [...castMap.values()]
  const castLine = castList.length === 0
    ? ''
    : `\n人生中出現過的人：\n${castList.map(c => `  - ${c.name}（${c.role || ''}；最終關係:${c.relation || ''}）`).join('\n')}\n`

  const archeBlock = archetype ? `\n${archetypeBlock(archetype)}\n` : ''

  const lastState = [...history].reverse().find(h => h.state_after)?.state_after || null
  const finalStateBlock = lastState
    ? `\n【人生最後的狀態（這是事實，結局必須與此一致）】
- 地點：${lastState.location || '?'}
- 學歷：${lastState.education || '?'}
- 職業：${lastState.occupation || '?'}
- 感情：${lastState.relationship || '單身'}
- 家庭：${lastState.family || '?'}
- 財務：${lastState.finances || '?'}
- 健康：${lastState.health || '健康'}
${lastState.notable ? `- 備註：${lastState.notable}` : ''}\n`
    : ''

  const system = '你是台灣人生故事的結局撰寫者，風格溫柔誠實，不說教，不評判選擇。請仔細閱讀整段人生軌跡，結局內容必須真實呼應軌跡裡發生的事件，不可寫出與軌跡矛盾的內容。'
  const user = `${character.name}，出生於${character.birth_place}。
夢想：${character.dream || '未說出的夢想'}
${archeBlock}${finalStateBlock}
人生軌跡（每個節點的情境與選擇都是真實發生過的，請以此為基礎寫結局）：
${trajectory}
${castLine}
請用 250-300 字、第二人稱「你」，描述這個人退休時回望人生的心情。
**結局必須具體呼應上方人生軌跡裡至少 2-3 個關鍵節點**（例如某個轉折、某個遺憾、某個堅持），不能只寫抽象的人生感悟。
**至少要提到一個過去出現的具名人物**（如名冊有的話），呼應你和他的最後關係。
最後一句話呼應他當初的夢想，但不要直接說「你實現了夢想」或「你沒有實現夢想」。
讓讀者自己感受。

直接輸出散文，不要前言、不要標題、不要使用 markdown。`

  return { system, user }
}
