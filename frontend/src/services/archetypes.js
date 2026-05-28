// 20 種台灣人生原型（archetypes）。
//
// 每局遊戲開始時隨機抽一個，整局都吃這個原型——它會影響角色生成的所有欄位
// (出生地/家庭/智力/外型/個性傾向)，也會持續注入到每個節點 prompt，讓 LLM 在
// 整段人生敘事中保持一致。例如「鹿港工藝家後代」就不會中途被 LLM 寫成北漂工程師。
//
// 設計原則：
//   - 每個原型代表一種台灣社會中真實存在的處境，覆蓋地理/階級/能力/家庭結構的不同切面。
//   - 不全是「悲情」也不全是「順遂」——人生總是有取有捨。
//   - 不刻板化原住民、新住民等族群——強調的是處境與優勢，不是負面標籤。
//   - 玩家不會看到 id 或 description（這是 LLM 的內部設定），只會在 loading 畫面
//     看到一句中性的「人生樣本」描述，類似日本原作展示資料來源的氛圍。

export const ARCHETYPES = [
  {
    id: 'taipei-elite-cram',
    label: '台北市，雙薪家庭，補習班長大的孩子',
    place: '臺北市',
    family: '父母都是上班族（例如:工程師、會計師、老師、銀行員），重視教育，家庭收入中高。',
    intelligence: '資優，從小成績前段，但壓力大',
    looks: '中等，整齊乾淨型',
    personality: '敏感、好強、習慣被比較',
    constraint: '在台北蛋黃區長大，從小週末塞滿才藝與補習。父母關心成績多過關心情緒。'
  },
  {
    id: 'new-taipei-bei-piao-2g',
    label: '新北蛋白區，南部北漂家庭的二代',
    place: '新北市',
    family: '父母從中南部上來打拚，做服務業或藍領工作，租屋多年，家庭收入中低。',
    intelligence: '普通',
    looks: '中等',
    personality: '懂事、早熟，常常自己一個人',
    constraint: '住在新北蛋白區（樹林、汐止、三重等）的舊公寓，看著父母為房租房貸辛苦。'
  },
  {
    id: 'hsinchu-tech-prince',
    label: '新竹市，科技園區雙工程師家庭',
    place: '新竹市',
    family: '父母都在科學園區當工程師（一個在台積電/聯電，一個在 IC 設計），家庭收入高。',
    intelligence: '資優，數理特別強',
    looks: '中等，書呆子氣質',
    personality: '理性、目標導向、不善表達情緒',
    constraint: '從小講雙語（中英），住在竹科員工宿舍或東區新成屋。父母常常加班，家裡有外籍幫傭。'
  },
  {
    id: 'hsinchu-county-introvert',
    label: '新竹縣鄉下，內向、理工頭腦的孩子',
    place: '新竹縣',
    family: '父母在工廠或務農，家庭收入中等偏下。',
    intelligence: '理工強、文科弱',
    looks: '不起眼',
    personality: '內向、宅、不善社交但對機械/電腦有熱情',
    constraint: '住在湖口/竹東/關西的鄉下，學校沒什麼資源，但靠自學摸電腦或機械。'
  },
  {
    id: 'taichung-rich-kid',
    label: '台中市，家裡做生意的小開/千金',
    place: '臺中市',
    family: '父母經營中小企業（家具、機械、貿易），家庭收入高。',
    intelligence: '中等，不愛讀書',
    looks: '出眾，從小被誇',
    personality: '外向、自信、有點公主/少爺脾氣',
    constraint: '住在七期豪宅或老市區三層樓透天，家裡有店面或工廠。長輩期待接班。'
  },
  {
    id: 'changhua-craft-heir',
    label: '彰化鹿港，家族經營傳統工藝/老店',
    place: '彰化縣',
    family: '阿公那一輩開始的小工坊或老店（漆藝、製麵、糕餅），家庭收入中低，但有資產。',
    intelligence: '中等',
    looks: '中等',
    personality: '沉靜、有耐心、念舊',
    constraint: '住在鹿港老街附近，從小被期待接家業，但這個產業在凋零。'
  },
  {
    id: 'tainan-southern-stem',
    label: '台南，父母進南科的中產家庭',
    place: '臺南市',
    family: '父母一個在南科上班、一個是公務員或老師，家庭收入中高。',
    intelligence: '資優',
    looks: '中等',
    personality: '溫和、容易被忽略、有自己的小世界',
    constraint: '住在台南東區或永康新蓋的大樓社區，週末跟家人吃台南小吃。'
  },
  {
    id: 'kaohsiung-blue-collar',
    label: '高雄港邊，藍領家庭的孩子',
    place: '高雄市',
    family: '父親在港務或工廠（中鋼、台船、貨運），母親做服務業，家庭收入中低。',
    intelligence: '課業普通偏下，但動手能力強',
    looks: '中等，運動體格',
    personality: '直爽、講義氣、人緣好',
    constraint: '住在高雄前鎮、小港、楠梓的舊社區，小時候在港邊跑跳，對讀書沒太大興趣。'
  },
  {
    id: 'yunlin-farmer-kid',
    label: '雲林/嘉義，務農家庭的孩子',
    place: '雲林縣',
    family: '父母種田或養豬養雞，家庭收入低，但有土地。',
    intelligence: '中下',
    looks: '中等，皮膚較黑',
    personality: '刻苦、實在、不擅言詞',
    constraint: '從小就要幫忙農事。同學很多家境類似，但城裡親戚會炫耀。'
  },
  {
    id: 'pingtung-indigenous',
    label: '屏東部落，原住民家庭的孩子',
    place: '屏東縣',
    family: '父親可能在外地工作，母親在地，家族關係緊密，家庭收入低。',
    intelligence: '課業普通，但音樂/運動特別有天賦',
    looks: '輪廓深、外型出眾',
    personality: '陽光、合群、有族群文化的根',
    constraint: '住在三地門/霧台/瑪家的部落，學校資源少。族群身分既是驕傲也是被外界貼標籤的來源。'
  },
  {
    id: 'hualien-mixed',
    label: '花蓮，新住民母親的二代',
    place: '花蓮縣',
    family: '父親是台灣人（可能是榮民後代或在地藍領），母親來自越南/印尼/菲律賓，家庭收入中低。',
    intelligence: '雙語環境，語感好',
    looks: '輪廓特殊，被同學注意',
    personality: '敏感、觀察力強、習慣兩種文化切換',
    constraint: '在花蓮市或吉安長大，家裡有越南/印尼料理的味道。同學偶爾會問「你媽媽怎麼那樣講中文」。'
  },
  {
    id: 'penghu-ocean-girl',
    label: '澎湖，漁家或觀光業家庭',
    place: '澎湖縣',
    family: '父親捕魚或開民宿，母親幫忙，家庭收入隨季節起伏。',
    intelligence: '中等',
    looks: '健康曬黑型',
    personality: '沉默、堅毅、看海長大',
    constraint: '住在馬公或離本島更遠的離島。國中畢業後同學大多會去本島讀書，回不回來是大問題。'
  },
  {
    id: 'kinmen-discipline',
    label: '金門，軍人家庭或公教家庭',
    place: '金門縣',
    family: '父親是國軍或公務員，母親是家庭主婦或教師，家庭收入中等，紀律嚴格。',
    intelligence: '中等',
    looks: '中等',
    personality: '守規矩、不太敢頂嘴、壓抑',
    constraint: '住在金城或山外，從小看砲彈遺跡長大。對「離島」與「邊境」的身分感很複雜。'
  },
  {
    id: 'single-mom',
    label: '單親媽媽家，敏感聰明但拮据',
    place: null, // 隨機，但偏向都會
    family: '父母離婚或父親早逝，由母親獨力撫養（可能還有兄姐），家庭收入低，靠租屋與兼差度日。',
    intelligence: '聰明，書讀得不錯',
    looks: '中等',
    personality: '敏感、早熟、體貼但壓抑',
    constraint: '從小看媽媽辛苦，自己會做家事。對「成功」與「孝順」的壓力同時存在。'
  },
  {
    id: 'left-behind',
    label: '隔代教養，阿公阿嬤帶大',
    place: null,
    family: '父母在北部或國外工作（或失聯），由阿公阿嬤撫養，家庭收入低。',
    intelligence: '中等',
    looks: '中等，不修邊幅',
    personality: '乖巧、自卑、習慣不被選中',
    constraint: '住在中南部小鎮，跟阿公阿嬤講台語，每年只見父母幾次。學校老師偶爾投以同情眼神。'
  },
  {
    id: 'new-immigrant-2g',
    label: '新住民二代，雙語環境但被排擠',
    place: null,
    family: '母親來自東南亞（越南/泰國/印尼），父親是台灣藍領或務農，家庭收入中低。',
    intelligence: '雙語、語感強、但中文書寫吃力',
    looks: '輪廓深、漂亮但「不像台灣人」',
    personality: '害羞、容易被笑、對母國文化有矛盾情感',
    constraint: '從小被同學叫「越南仔」或「印尼仔」，但其實對台灣社會很熟悉。母親在工廠或飲食業工作。'
  },
  {
    id: 'dysfunctional-family',
    label: '失能家庭倖存者',
    place: null,
    family: '父親酗酒或家暴，或父母感情破裂長期冷戰，家庭收入不穩。',
    intelligence: '中等',
    looks: '中等',
    personality: '警覺、不信任人、習慣察言觀色',
    constraint: '家裡氣氛緊繃，回家比上學更累。會躲在學校、圖書館或同學家。'
  },
  {
    id: 'gifted-prodigy',
    label: '資優跳級神童',
    place: '臺北市',
    family: '中產雙薪家庭，父母對你寄予厚望，家庭收入中高。',
    intelligence: 'IQ 140+，數學/邏輯特別強',
    looks: '不修邊幅、書呆子氣',
    personality: '社交吃力、容易格格不入、對同齡話題沒興趣',
    constraint: '是學校的「特殊個案」，老師關注、同學疏遠。父母擔心你「太聰明會不會反而適應不良」。'
  },
  {
    id: 'forgettable-average',
    label: '平凡到讓人忘記的孩子',
    place: '桃園市',
    family: '中產雙薪，父母都是公司職員，家庭收入中等，氣氛平和。',
    intelligence: '剛剛好的普通',
    looks: '剛剛好的普通',
    personality: '不討人厭也不出眾、好相處',
    constraint: '不是班上的風雲人物，也不是被欺負的對象。畢業紀念冊上同學會想不起你的名字。'
  },
  {
    id: 'sickly-bookworm',
    label: '體弱多病但愛讀書的孩子',
    place: null,
    family: '父母為了你的健康幾乎全部精力投在你身上，家庭收入中等。',
    intelligence: '課業好（因為常常請假在家讀書）',
    looks: '蒼白、瘦小',
    personality: '沉靜、想很多、書讀很多',
    constraint: '從小體育課常請假，不能跟同學一起跑跳。但你看的書比誰都多，腦子裡有自己的世界。'
  }
]

/**
 * Pick a random archetype.
 * Optionally pin to a specific id (for testing).
 */
export function pickArchetype(forceId = null) {
  if (forceId) {
    const a = ARCHETYPES.find(x => x.id === forceId)
    if (a) return a
  }
  return ARCHETYPES[Math.floor(Math.random() * ARCHETYPES.length)]
}

/**
 * Compose the constraint block injected into prompts.
 * Used by both promptCharacter (to seed the character) and promptNextNode
 * (to keep the narrative consistent across all 12-14 nodes).
 */
export function archetypeBlock(archetype) {
  if (!archetype) return ''
  return `【人生原型（整局保持一致）】
- 樣本標籤：${archetype.label}
- 出生地傾向：${archetype.place || '隨機都會或鄉鎮，依下方家庭背景調整'}
- 家庭：${archetype.family}
- 智力傾向：${archetype.intelligence}
- 外型：${archetype.looks}
- 個性傾向：${archetype.personality}
- 關鍵設定：${archetype.constraint}`
}
