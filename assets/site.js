// Nowtown 公式サイト：スクロールに合わせた空・時刻札・配信日の切り替え（依存なし）
(() => {
  const d = document, H = d.documentElement, W = window;
  // 配信日：過ぎていたら「予約」を「入手」に。配信日が動いたら、この 1 行を直す
  const RELEASE_AT = '2026-12-01T00:00:00+09:00';
  if (Date.now() >= Date.parse(RELEASE_AT)) {
    d.querySelectorAll('[data-pre]').forEach((e) => { e.hidden = true; });
    d.querySelectorAll('[data-post]').forEach((e) => { e.hidden = false; });
  }

  const JA = H.lang === 'ja';
  const MIN = [340, 390, 720, 870, 1000, 1040, 1220]; // 各ステージの現地時刻（分）
  const WX = JA ? ['快晴', '快晴', '晴れ', '小雨', '快晴', '快晴', '快晴'] : ['CLEAR', 'CLEAR', 'SUNNY', 'LIGHT RAIN', 'CLEAR', 'CLEAR', 'CLEAR'];
  // 見出しの色と scrim：できあがった空の画素で決めた（S3 の小雨・S4 の夕焼けは、絵では淡い色なので ink の字）
  const TONE = ['light', 'dark', 'dark', 'dark', 'dark', 'light', 'light'];
  const SCRIM = [0.15, 0, 0, 0, 0, 0.1, 0.1];
  const mq = (q) => W.matchMedia(q);
  const reduce = mq('(prefers-reduced-motion: reduce)'), mobile = mq('(max-width: 1023px)');
  const saveData = !!(navigator.connection && navigator.connection.saveData);
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, f) => a + (b - a) * f;
  const at = (arr, t) => { const i = Math.min(5, Math.floor(t)); return lerp(arr[i], arr[i + 1], t - i); };

  const soft = [...d.querySelectorAll('.sky__soft .sky__layer')];
  const sharp = [...d.querySelectorAll('.sky__sharp .sky__layer')];
  const clock = d.querySelector('[data-clock]'), wx = d.querySelector('[data-wx]');
  const hd = d.querySelector('.hd'), dusk = d.getElementById('dusk'), spinLine = dusk && dusk.querySelector('.dusk__spin');
  if (!soft.length) return;

  // ---- Step 4：ピン留めした 1 台の箱庭が、スクロールで 25 分 → 2 時間 → 4 時間 → 7 時間と建つ
  // 条件は site.css の「Step 4 のピン留め」と同じ。外れたら（動きを減らす・背の低い画面）、4 枚を並べた形のまま
  const GROW_Q = mq('(prefers-reduced-motion: no-preference) and (min-height: 520px)');
  const grow = d.getElementById('grow');
  const gTrack = grow && grow.querySelector('.grow__track'), gPin = grow && grow.querySelector('.grow__pin');
  const gLis = grow ? [...grow.querySelectorAll('ol.grow > li')] : [], gTicks = grow ? [...grow.querySelectorAll('.grow__scale li')] : [];
  const gH = grow && grow.querySelector('[data-gh]'), gMin = grow && grow.querySelector('[data-gm]');
  const G_S = [0, 0.16, 0.41, 0.66]; // 各段の現れはじめ（0.12 で建ちおわる）
  const G_AT = [25, 120, 240, 420]; // 目盛りの 4 本（分）
  const G_PT = [[0, 25], [0.08, 25], [0.28, 120], [0.34, 120], [0.53, 240], [0.59, 240], [0.78, 420], [1, 420]]; // 進み p → 分
  let G = null, gLast = {};
  const gSet = (k, v, f) => { if (gLast[k] !== v) { gLast[k] = v; f(v); } };
  const growClear = () => {
    if (!grow) return;
    gLast = {};
    ['--gp', '--gm', '--go'].forEach((k) => grow.style.removeProperty(k));
    gLis.forEach((li) => { li.style.removeProperty('opacity'); li.style.removeProperty('--r'); });
    gTicks.forEach((t) => t.classList.remove('is-on'));
  };
  const growTick = (sy) => {
    // ピン留めの区間が画面の外なら、何も書かない
    if (sy + W.innerHeight < G.tt || sy > G.tt + G.th) return;
    const p = clamp((sy - G.tt) / Math.max(1, G.th - G.ph));
    const inn = G_S.map((s0, i) => (i ? clamp((p - s0) / 0.12) : 1));
    gLis.forEach((li, i) => {
      // 上の段は、はじめの 35% でさっと不透明に。下の段は、上の段が 70% まで建ってから消える（重なる間、台座は透けない）
      const o = Math.min(clamp(inn[i] / 0.35), i < gLis.length - 1 ? 1 - clamp((inn[i + 1] - 0.7) / 0.3) : 1).toFixed(3);
      gSet('o' + i, o, (v) => { li.style.opacity = v; }); // visibility は触らない（hidden にすると読み上げから外れる）
      // 建ち上がり：台座（舞台の高さの 0.36）の少し下から上へ、マスクを開ける
      if (i) gSet('r' + i, (0.34 + 0.66 * inn[i]).toFixed(3), (v) => li.style.setProperty('--r', v));
    });
    let m = G_PT[G_PT.length - 1][1];
    for (let k = 1; k < G_PT.length; k++) if (p <= G_PT[k][0]) { const [a, x] = G_PT[k - 1], [b, y] = G_PT[k]; m = lerp(x, y, (p - a) / (b - a)); break; }
    gSet('gm', (m / 420).toFixed(4), (v) => grow.style.setProperty('--gm', v));
    // カウンターは 5 分きざみ（ヘッダーの時刻札と同じ）。分は 2 桁
    gSet('m', Math.round(m / 5) * 5, (r) => {
      gH.textContent = String(Math.floor(r / 60)); gMin.textContent = String(r % 60).padStart(2, '0');
      gTicks.forEach((t, k) => t.classList.toggle('is-on', r >= G_AT[k]));
    });
    // 終わりの引き渡し：p 0.9 → 1 で、模型・目盛り・（PC は）解説が消える
    gSet('go', (1 - clamp((p - 0.9) / 0.1)).toFixed(3), (v) => grow.style.setProperty('--go', v));
  };
  const base = soft[0].querySelector('img').getAttribute('src').replace(/s0-land-soft\.webp$/, '');

  // ---- Step 3（PC）：.rain__track（200vh）の中で .rain__body を sticky に。条件は site.css の「PC のピン留め」と同じ
  // 文とスマホの不透明度 --s3 = ピン留めの 12vh 手前から 1 へ × 終わりの 12vh で 0 へ（箱庭の上を流れる間・ヘッダーの下をくぐる間は見えない）
  const PIN3 = mq('(min-width: 1024px) and (min-height: 600px) and (min-aspect-ratio: 13/10), (min-width: 1280px) and (min-height: 600px) and (min-aspect-ratio: 11/10)');
  const rTrack = d.querySelector('.rain__track'), rBody = rTrack && rTrack.querySelector('.rain__body');
  let R = null;
  const s3Tick = (sy) => {
    if (sy < R.T - R.f - 2 || sy > R.E + 2) { if (R.o !== 0) { R.o = 0; rTrack.style.setProperty('--s3', '0'); } return; }
    const o = +(clamp((sy - (R.T - R.f)) / R.f) * clamp((R.E - sy) / R.f)).toFixed(3);
    if (o !== R.o) { R.o = o; rTrack.style.setProperty('--s3', o); }
  };

  // ---- 空の絵の置き方（site.css の .sky__layer img と同じ）。W×Hh は .sky の箱（100lvh）。
  // 縦長の絵（幅 ÷ 高さ ≤ 2/3）は上にそろえて cover、2:1 より横長は高さで合わせ、そのあいだは 16:10 を cover・上下 45%
  // 返すのは、絵の中の割合 (x, y) → 画面の座標 に使う ox・oy・iw・ih（敷いた絵の大きさ）
  const fit = (W, Hh) => {
    const a = W / Hh;
    if (a <= 2 / 3) { const s = Math.max(W / 720, Hh / 1560); return { k: 'port', iw: 720 * s, ih: 1560 * s, ox: (W - 720 * s) / 2, oy: 0 }; }
    if (a >= 2) { const s = Hh / 1000; return { k: 'land', iw: 1600 * s, ih: 1000 * s, ox: (W - 1600 * s) / 2, oy: 0 }; }
    const s = Math.max(W / 1600, Hh / 1000); return { k: 'land', iw: 1600 * s, ih: 1000 * s, ox: (W - 1600 * s) / 2, oy: (Hh - 1000 * s) * 0.45 };
  };

  // ---- Step 3（14:30・小雨）：箱庭の雲から、箱庭の台座へ雨を降らせる。canvas 1 枚を空の上（文字・スマホ画面の下）に、雨の範囲の箱だけ敷く
  // 雲の下の面からだけ降り、台座の上面（ひし形）で止まる。雲の外・台座の下には降らせない（空の絵は画面に固定なので、雲の位置はスクロールで動かない。測るのは resize の時だけ）
  // 空の S3 の見えている重み（t が 2 → 3 で入り、3 → 4 で抜ける）を canvas の不透明度にする。重みが 0 の間は、ループを止めて隠す。
  // モバイルのベールの区間（箱庭がぼけている所）では、不透明度に 0.45 + 0.55 × --sharp を掛けて薄く。
  // 3 層（遠い層ほど細く・遅く・薄い）。粒の数は雨の範囲の面積に比例（上限あり）。DPR は 2 まで。
  // 真ん中と近い層は、くっきりした箱庭（--sharp > 0.5）が見えている間、台座の上で小さく跳ね返る。動きを減らす設定では降らせない（canvas も作らない）
  const rain = (() => {
    let cv = null, g = null; // canvas は、はじめて雨が見えるときに作る（読み込みの時の仕事を増やさない）
    const make = () => { cv = d.createElement('canvas'); cv.className = 'rain-fx'; cv.setAttribute('aria-hidden', 'true'); d.querySelector('.sky').after(cv); g = cv.getContext('2d'); };
    // 層：長さ、太さ、落ちる速さ（px/s）、不透明度、色、粒 1 つあたりの面積、上限
    const L = [[[10, 16], 0.9, [430, 520], 0.5, '150,162,190', 3600, 60], [[18, 28], 1.2, [700, 840], 0.55, '210,218,236', 6400, 40], [[30, 44], 1.5, [1080, 1260], 0.5, '238,242,250', 16000, 20]];
    const SLANT = 0.17; // 横に流れる量（落ちる 1 に対して）
    const FADE = [[16, 0.25], [32, 0.6], [48, 1]]; // 雲から出て落ちた距離（× k）→ 不透明度の倍率。出た所では透明
    const SPAN = [[0, 0.5], [0, 1], [0.5, 1]]; // 落ちる先：遠い層は台座の奥の半分、真ん中は全体、近い層は手前の半分
    // 絵の中の割合（横長 1600×1000・縦長 720×1560 の絵で測った）。雲：中心 x・半幅・下の面 y = a + b × √(1 − u²)（u = (x − 中心) ÷ 半幅）
    const CLOUD = { land: [0.4985, 0.1405, 0.295, 0.058], port: [0.493, 0.399, 0.335, 0.055] };
    // 台座の上面（ひし形：左・上・右・下の角）
    const DIA = { land: [[0.324, 0.656], [0.5, 0.548], [0.676, 0.658], [0.5, 0.766]], port: [[0.058, 0.565], [0.5, 0.46], [0.94, 0.567], [0.5, 0.67]] };
    let SW = 0, SH = 0, bx = 0, by = 0, bw = 0, bh = 0, k = 1, drops = [], splash = [], on = false, w = 0, sh = 0, raf2 = 0, prev = 0, dia = null, cl = null;
    const rnd = (a, b) => a + Math.random() * (b - a);
    const place = () => {
      const f = fit(SW, SH), c = CLOUD[f.k];
      dia = DIA[f.k].map(([x, y]) => [f.ox + x * f.iw, f.oy + y * f.ih]);
      cl = { cx: f.ox + c[0] * f.iw, hw: c[1] * f.iw, a: f.oy + c[2] * f.ih, b: c[3] * f.ih };
    };
    const under = (u) => cl.a + cl.b * Math.sqrt(Math.max(0, 1 - u * u)); // 雲の下の面の y
    // ひし形の、ある x での上の辺と下の辺の y。外なら null
    const edges = (x) => {
      const [l, t, r, b] = dia; if (x <= l[0] || x >= r[0]) return null;
      const f = x < t[0] ? (x - l[0]) / (t[0] - l[0]) : (r[0] - x) / (r[0] - t[0]);
      return x < t[0] ? [l[1] + (t[1] - l[1]) * f, l[1] + (b[1] - l[1]) * f] : [r[1] + (t[1] - r[1]) * f, r[1] + (b[1] - r[1]) * f];
    };
    // 出どころ（雲の下の面、u ∈ [−0.85, 0.85]、0〜8px 上へ乱す）と落ちる先（その粒が流れ着く x での、ひし形の中）。外れたら 3 回まで選び直す
    const seed = (o, i, mid) => {
      const c = L[i], [s0, s1] = SPAN[i];
      o.i = i; o.l = rnd(...c[0]) * k; o.v = rnd(...c[2]) * k;
      for (let n = 0; n < 4; n++) {
        const u = n < 3 ? rnd(-0.85, 0.85) : rnd(-0.3, 0.3), f = rnd(s0, s1);
        o.x0 = cl.cx + u * cl.hw; o.y0 = under(u) - rnd(0, 8);
        let gy = (dia[1][1] + dia[3][1]) / 2, e = null;
        for (let m = 0; m < 3; m++) { const x = o.x0 + SLANT * (gy - o.y0); e = x > dia[0][0] + 12 && x < dia[2][0] - 12 ? edges(x) : null; if (!e) break; gy = e[0] + (e[1] - e[0]) * f; }
        if (e && gy > o.y0 + 16 * k) { o.gy = Math.min(gy, dia[3][1] - 4); break; } // 跳ね返りの輪（半径 9px まで）が台座の左右の角・下の角から出ないよう、角の手前で止める
        o.gy = null;
      }
      // はじめは落ちる途中のどこかから（雨が降りつづいている所に入る）。降りなおしは、雲の中のすこし上から（間隔をばらす）
      const H0 = (o.gy ?? o.y0 + 100) - o.y0;
      o.y = mid ? o.y0 + rnd(-40, H0) : o.y0 - rnd(0, 40);
      o.x = o.x0 + SLANT * (o.y - o.y0);
      return o;
    };
    const resize = () => {
      const sky = d.querySelector('.sky'), cw = sky.clientWidth, ch = sky.clientHeight; if (!cw || !ch) return;
      if (cw === SW && ch === SH && drops.length) return;
      SW = cw; SH = ch;
      place();
      // 雨の範囲の箱：雲の出どころの左端・ひし形の左端の外 12px 〜 右端の外 12px、雲の下の面 − 10px 〜 ひし形の下の角 ＋ 8px
      const x0 = Math.min(cl.cx - 0.85 * cl.hw, dia[0][0]) - 12, x1 = dia[2][0] + 12, y0 = Math.min(under(0.85), cl.a) - 10, y1 = dia[3][1] + 8;
      bx = Math.floor(Math.max(0, x0)); by = Math.floor(Math.max(0, y0)); bw = Math.ceil(Math.min(SW, x1)) - bx; bh = Math.ceil(Math.min(SH, y1)) - by;
      Object.assign(cv.style, { left: bx + 'px', top: by + 'px', width: bw + 'px', height: bh + 'px' });
      let dpr = saveData ? 1 : Math.min(2, devicePixelRatio || 1);
      if (bw * bh * dpr * dpr > 4.2e6) dpr = Math.max(1, Math.sqrt(4.2e6 / (bw * bh)));
      cv.width = Math.round(bw * dpr); cv.height = Math.round(bh * dpr);
      g.setTransform(dpr, 0, 0, dpr, -bx * dpr, -by * dpr); // 描くのは画面の座標のまま
      const fall = dia[3][1] - under(0); // 落ちる高さの最大
      k = clamp(fall / 420, 0.6, 1);
      const A = 1.7 * cl.hw * fall, q = saveData ? 0.5 : 1;
      drops = []; L.forEach((c, i) => { const n = Math.min(Math.round((A / c[5]) * q), Math.round(c[6] * q)); for (let j = 0; j < n; j++) drops.push(seed({}, i, true)); });
    };
    const frame = (now) => {
      raf2 = 0;
      const dt = prev ? Math.min(0.05, (now - prev) / 1000) : 0.016; prev = now;
      g.clearRect(bx, by, bw, bh);
      g.lineCap = 'round';
      for (const o of drops) {
        o.y += o.v * dt; o.x += o.v * dt * SLANT;
        if (o.gy != null ? o.y >= o.gy : o.y - o.y0 > 400) { // 台座の上に落ちた：真ん中と近い層は小さく跳ね返る
          if (o.gy != null && o.i && sh > 0.5 && splash.length < 40) splash.push({ x: o.x0 + SLANT * (o.gy - o.y0), y: o.gy, t: 0, s: rnd(0.8, 1.3) });
          seed(o, o.i, false);
        }
      }
      // 層ごとに、雲から出た距離で 3 つの束に分けて描く（1 フレーム最大 9 回）。尾は雲の下の面（出どころ）より上へ出さない
      for (let i = 0; i < 3; i++) {
        const c = L[i];
        g.lineWidth = c[1];
        for (let f = 0; f < 3; f++) {
          const lo = FADE[f][0] * k, hi = f < 2 ? FADE[f + 1][0] * k : Infinity;
          let any = false;
          for (const o of drops) {
            if (o.i !== i || o.gy == null) continue;
            const dd = o.y - o.y0; if (dd < lo || dd >= hi) continue;
            if (!any) { g.beginPath(); any = true; }
            const ty = Math.max(o.y0, o.y - o.l);
            g.moveTo(o.x - (o.y - ty) * SLANT, ty); g.lineTo(o.x, o.y);
          }
          if (any) { g.strokeStyle = `rgba(${c[4]},${(c[3] * FADE[f][1]).toFixed(3)})`; g.stroke(); }
        }
      }
      // 跳ね返り：小さなだ円の輪が広がって消える（0.28 秒）
      if (splash.length) {
        g.lineWidth = 0.8;
        splash = splash.filter((p) => (p.t += dt) < 0.28);
        for (const p of splash) {
          const f = p.t / 0.28, r = (2 + 5 * f) * p.s;
          g.strokeStyle = `rgba(240,244,250,${(0.5 * (1 - f) * sh).toFixed(3)})`;
          g.beginPath(); g.ellipse(p.x, p.y, r, r * 0.34, 0, 0, Math.PI * 2); g.stroke();
        }
      }
      if (on) raf2 = requestAnimationFrame(frame);
    };
    const stop = () => { on = false; if (raf2) cancelAnimationFrame(raf2); raf2 = 0; prev = 0; splash = []; cv.style.visibility = 'hidden'; g.clearRect(bx, by, bw, bh); };
    return {
      set(t, s) {
        sh = s;
        const nw = reduce.matches ? 0 : Math.round(clamp(t - 2) * (1 - clamp(t - 3)) * (mobile.matches ? 0.45 + 0.55 * s : 1) * 1000) / 1000;
        if (nw > 0 && !cv) make();
        if (nw !== w && cv) { w = nw; cv.style.opacity = w; }
        if (w > 0 && !on) { resize(); on = true; cv.style.visibility = 'visible'; raf2 = requestAnimationFrame(frame); }
        else if (w <= 0 && on) stop();
      },
      resize() { if (on) resize(); else SW = 0; }, // 次に降りはじめるときに測り直す
    };
  })();

  // ---- #dusk：灯りがともった街が、スクロールに合わせて一周する（docs/site/spec.md の 2 章 6）
  // 連番（assets/spin/、AVIF だけ）は、S5 の絵の中の箱庭のまわりの四角を切り出したもの。canvas 1 枚を .sky__sharp のいちばん上の、その四角の位置に置いて描く。
  // コマ 0（と n）は描かない＝下の S5 のくっきりした絵。表示の向きは、スクロールが決めた向きを時定数 140ms で追い（アプリの慣性をまねる）、
  // スクロールが止まると、いちばん近いコマへ寄って 1 枚で止まる（2 コマが重なった絵のまま止めない）。ループは動いている間だけ。
  // 回さない：Save-Data・AVIF なし（html.no-spin。#dusk は前の 220vh）、動きを減らす設定（canvas も作らない）、S5 のくっきりした絵がまだ出ていない
  const SPIN = {
    // n：一周のコマ数、w・h：コマの画素、box：絵の中の四角（x0, y0, x1, y1）、縁のぼかし（コマの幅・高さに対する割合：左右・上・下）
    port: { n: 24, w: 720, h: 780, box: [0, 0.35, 1, 0.85], fx: 0, ft: 0.03 / 0.5, fb: 0.03 / 0.5 },
    land: { n: 36, w: 1260, h: 754, box: [0.15, 0.33, 0.85, 1], fx: 0.03 / 0.7, ft: 0.03 / 0.67, fb: 0 },
  };
  const P_LIT = 0.36, P_ROT = [0.42, 0.92], TAU = 140, TAU_SNAP = 80, IDLE = 60; // 追う時定数・寄せる時定数（ms）、スクロールが止まったとみなすまで（ms）
  const spin = (() => {
    let cv = null, g = null, kind = null, sets = {}, want = false, avif = null, gx = null, gy = null, rect = '';
    let f = 0, ft = 0, on = false, raf3 = 0, prev = 0, lastMove = 0, lastSy = null, pass = null, shown = -1, key = '', drawN = 0, drawT = 0, single = false, held = true;
    const can = () => !reduce.matches && !H.classList.contains('no-spin');
    const smooth = (a) => { const x = clamp((a - 0.25) / 0.5); return x * x * (3 - 2 * x); };
    // 読む順番：粗い方から（4 コマおき → 2 コマおき → 残り）。1 巡目（4 コマおき）がそろうまでは回さない
    const order = (n) => { const o = []; for (const k of [4, 2, 1]) for (let i = k; i < n; i += k) if (!o.includes(i)) o.push(i); return o; };
    const url = (k, i) => `${base.replace(/sky\/$/, 'spin/')}${k}-${String(i).padStart(2, '0')}.avif`;
    const fetchSet = (k) => {
      if (sets[k]) return;
      const c = SPIN[k], st = sets[k] = { img: [], bmp: [], ok: [], q: order(c.n), busy: 0 };
      const next = () => {
        while (st.busy < 4 && st.q.length) {
          const i = st.q.shift(), im = new Image(); st.busy++;
          im.decoding = 'async'; im.fetchPriority = 'low'; im.src = url(k, i);
          // 縦長（23 枚・展開で約 50 MB）は ImageBitmap で持つ。横長（35 枚・約 130 MB）は <img> のまま
          im.decode().then(() => (k === 'port' && W.createImageBitmap ? createImageBitmap(im).catch(() => null) : null))
            .then((b) => { st.img[i] = im; st.bmp[i] = b; st.ok[i] = true; }, () => {})
            .then(() => { st.busy--; next(); if (k === kind) queue(); });
        }
      };
      next();
    };
    const ready1 = (st, n) => { for (let i = 4; i < n; i += 4) if (!st.ok[i]) return false; return true; };
    const make = () => {
      cv = d.createElement('canvas'); cv.className = 'spin-fx'; cv.setAttribute('aria-hidden', 'true');
      d.querySelector('.sky__sharp').appendChild(cv); g = cv.getContext('2d');
    };
    // 縁のぼかし（描いた後に destination-in で不透明度を落とす。CSS の mask は使わない）
    const grads = () => {
      const c = SPIN[kind];
      gx = null; if (c.fx) { gx = g.createLinearGradient(0, 0, c.w, 0); gx.addColorStop(0, 'rgba(0,0,0,0)'); gx.addColorStop(c.fx, '#000'); gx.addColorStop(1 - c.fx, '#000'); gx.addColorStop(1, 'rgba(0,0,0,0)'); }
      gy = g.createLinearGradient(0, 0, 0, c.h); gy.addColorStop(0, 'rgba(0,0,0,0)'); gy.addColorStop(c.ft, '#000');
      if (c.fb) { gy.addColorStop(1 - c.fb, '#000'); gy.addColorStop(1, 'rgba(0,0,0,0)'); } else gy.addColorStop(1, '#000');
    };
    const place = () => {
      if (!cv) return;
      const sky = d.querySelector('.sky'), F = fit(sky.clientWidth, sky.clientHeight), c = SPIN[F.k], [x0, y0, x1, y1] = c.box;
      const box = [F.ox + x0 * F.iw, F.oy + y0 * F.ih, (x1 - x0) * F.iw, (y1 - y0) * F.ih].map((v) => v.toFixed(2) + 'px'), bk = box.join();
      if (bk !== rect) { rect = bk; Object.assign(cv.style, { left: box[0], top: box[1], width: box[2], height: box[3] }); } // 変わったときだけ書く（measure は画像の読み込みのたびに呼ばれる）
      if (F.k !== kind) {
        // 画面を回して組（縦長・横長）が変わったら、新しい組を読む
        kind = F.k; cv.width = c.w; cv.height = c.h; grads(); key = ''; pass = null;
        if (want) fetchSet(kind);
      }
    };
    const hide = () => { if (shown !== 0) { shown = 0; cv.style.visibility = 'hidden'; } };
    const src = (st, i) => st.bmp[i] || st.img[i];
    // 位置 x（コマの単位、0 < x < n）の絵：両隣の、読めているコマの間を溶かす（コマ 0・n は下の S5 の絵なので、canvas 全体の不透明度で溶かす）
    const draw = (x) => {
      const c = SPIN[kind], st = sets[kind], n = c.n;
      let lo = Math.floor(x), hi = Math.ceil(x);
      while (lo > 0 && !st.ok[lo]) lo--;
      while (hi < n && !st.ok[hi]) hi++;
      const a = hi > lo ? (x - lo) / (hi - lo) : 0, m = single ? (a < 0.5 ? 0 : 1) : smooth(a);
      let A = lo, B = hi, mm = m, op = 1;
      if (lo === 0 && hi === n) op = 0;
      else if (lo === 0) { A = hi; mm = 0; op = m; } else if (hi === n) { mm = 0; op = 1 - m; }
      if (op <= 0) { hide(); return; }
      const k = `${A},${B},${mm.toFixed(3)}`;
      if (k !== key) {
        key = k;
        const t0 = performance.now();
        g.globalCompositeOperation = 'copy'; g.globalAlpha = 1;
        if (mm < 1) g.drawImage(src(st, A), 0, 0, c.w, c.h);
        if (mm > 0) { g.globalCompositeOperation = mm < 1 ? 'source-over' : 'copy'; g.globalAlpha = mm; g.drawImage(src(st, B), 0, 0, c.w, c.h); g.globalAlpha = 1; }
        g.globalCompositeOperation = 'destination-in';
        if (gx) { g.fillStyle = gx; g.fillRect(0, 0, c.w, c.h); }
        g.fillStyle = gy; g.fillRect(0, 0, c.w, c.h);
        g.globalCompositeOperation = 'source-over';
        // 遅い端末：最初の 10 回の平均が 24ms を超えたら、溶かすのをやめて近いコマ 1 枚だけに
        if (drawN < 10) { drawT += performance.now() - t0; if (++drawN === 10 && drawT / 10 > 24) single = true; }
      }
      const o = +op.toFixed(3);
      if (o <= 0) { hide(); return; }
      if (shown !== o) { if (shown <= 0) cv.style.visibility = 'visible'; shown = o; cv.style.opacity = o; }
    };
    // 止まったときに寄る先：いちばん近い、読めているコマ（0・n は下の絵）
    const near = (x) => {
      const st = sets[kind], n = SPIN[kind].n; let lo = Math.floor(x), hi = Math.ceil(x);
      while (lo > 0 && !st.ok[lo]) lo--;
      while (hi < n && !st.ok[hi]) hi++;
      return x - lo <= hi - x ? lo : hi;
    };
    const frame = (now) => {
      raf3 = 0;
      const dt = prev ? Math.min(100, now - prev) : 16; prev = now;
      const n = SPIN[kind].n, idle = now - lastMove > IDLE, goal = idle ? near(ft) : ft;
      f += (goal - f) * (1 - Math.exp(-dt / (idle ? TAU_SNAP : TAU)));
      const done = Math.abs(goal - f) < 0.002;
      if (done) f = goal;
      if (f > 0 && f < n) draw(f); else hide();
      if (done && idle) { on = false; prev = 0; } else raf3 = requestAnimationFrame(frame);
    };
    return {
      // #grow が近づいた（または #features が見えた）ら読み始める
      start() {
        want = true;
        if (!can() || avif === false) return;
        if (avif == null) return; // S0 のくっきりした絵が読めたときに、もう一度（AVIF が使えるかは、その currentSrc で見る）
        if (!cv) { make(); kind = null; place(); }
        fetchSet(kind);
      },
      // くっきりした絵が 1 枚読めたとき：AVIF が使えないブラウザでは回さない（#dusk も前の 220vh に）
      avif(img) {
        if (avif != null) return;
        avif = /\.avif(\?|$)/.test(img.currentSrc || '');
        if (!avif) { H.classList.add('no-spin'); measure(); } else if (want) this.start();
      },
      resize() { if (cv) { const r0 = rect, k0 = kind; place(); if (rect !== r0 || kind !== k0) { key = ''; if (on || shown > 0) queue(); } } },
      // 毎フレーム（tick）：p は #dusk の進み（0〜1）、vis は #dusk が画面にかかっているか、t は空のステージ
      set(p, vis, t, sy) {
        if (!cv) return;
        const st = sets[kind];
        // ImageBitmap は、空が 4〜5 の隣から外れたら手放す（<img> は持っているので、戻ったら作り直す）
        if (st && kind === 'port') {
          if ((t < 3.5 || t > 5.5) && st.bmp.some(Boolean)) st.bmp = st.bmp.map((b) => { b && b.close(); return null; });
          else if (t >= 3.5 && t <= 5.5 && W.createImageBitmap) st.img.forEach((im, i) => { if (im && !st.bmp[i] && !st.mk) { st.mk = 1; createImageBitmap(im).then((b) => { st.bmp[i] = b; }, () => {}).then(() => { st.mk = 0; }); } });
        }
        const n = SPIN[kind].n, nt = n * clamp((p - P_ROT[0]) / (P_ROT[1] - P_ROT[0]));
        // ピン留めの外から飛び込んだとき（ページ内リンクなど）は、追いかけずにその向きへ
        const jump = lastSy == null || Math.abs(sy - lastSy) > W.innerHeight;
        lastSy = sy;
        const stop = () => { ft = f = nt; if (raf3) cancelAnimationFrame(raf3); raf3 = 0; on = false; hide(); };
        if (!(can() && vis && st && sharp[5] && sharp[5].dataset.ready)) { pass = null; stop(); return; }
        // 回り始め（止まった向きから動き出す）とき、1 巡目（4 コマおき）がそろっていなければ、その回は回さない（止まった絵のまま。止まった向きへ戻ったら、また見る）
        if ((ft <= 0 || ft >= n) && nt > 0 && nt < n) pass = ready1(st, n);
        if (nt <= 0 || nt >= n) { if (pass === false) f = nt; pass = null; }
        if (pass === false) { stop(); return; }
        if (nt !== ft) lastMove = performance.now();
        ft = nt;
        if (jump) f = ft;
        if (!on) { on = true; prev = 0; raf3 = requestAnimationFrame(frame); }
      },
      // 進み p での、文の不透明度と空のステージ（回すときは、灯りは p 0〜0.36）
      lit: (p) => (can() ? clamp(p / P_LIT) : p),
      line: (p, t) => (can() ? clamp((p - 0.40) / 0.05) : clamp((t - 4.45) / 0.12)),
    };
  })();

  // ---- ページの最後（A：押し上げ）。フッターの上端 − 6px が台座の下の角に届いたら、そこから空の 2 層（.sky__soft・.sky__sharp）を
  // フッターと一緒に上へずらす（--end-y、スクロールと 1:1）。塔の先はヘッダーの下 12px（68px）までしか上げない。
  // 設計書は「フッターの上端 ＋ 16px」。それだと英語（リンクが 1 行でフッターが 51px 低い）の 390×844 で、箱庭の上の空が画面の 32% になった（基準は 30% 以下）。
  // 台座の下の角はフッターの上端の 6px 上に止まり、リンクの字まで 61〜62px（基準 24〜64px）
  // B（1 画面：横長の PC。条件は site.css のフッターと同じ）では行わない。動きを減らす設定でも行う（ひとりでには動かない。行わないと箱庭にフッターが重なる）
  const ONE = mq('(min-width: 1280px) and (min-aspect-ratio: 8/5) and (min-height: 600px)');
  // あわせて、#get の中身は、CTA（ボタンと注記）の上端がヘッダーの下 48px からヘッダーの下端へ来るあいだに消す（A の最後の画面で、CTA がヘッダーの下にのぞかないように）
  const skyEl = d.querySelector('.sky'), ft = d.querySelector('.ft'), getEl = d.getElementById('get'), getCta = getEl && getEl.querySelector('.cta');
  let E = null, endY = -1, getO = -1;
  const endTick = (sy) => {
    // 画素の境目に丸める（端数だと、ずらした層の下端の 1 行が半分だけ塗られ、下の段の明るい空が細い線になって透ける）
    const dpr = W.devicePixelRatio || 1, v = E ? Math.round(clamp(E.B - (E.ft - sy - 6), 0, E.max) * dpr) / dpr : 0;
    if (v !== endY) { endY = v; if (v) skyEl.style.setProperty('--end-y', v + 'px'); else skyEl.style.removeProperty('--end-y'); }
    const o = E && E.cta != null ? Math.round(clamp((E.cta - sy - 56) / 48) * 100) / 100 : 1;
    if (o !== getO) { getO = o; if (o < 1) getEl.style.setProperty('--get-o', o); else getEl.style.removeProperty('--get-o'); }
  };

  // ---- sharp の読み込み（現在のステージの前後だけ。decode が済んでから出す）
  const ready = (L) => { L.dataset.ready = '1'; L.classList.add('is-new'); setTimeout(() => L.classList.remove('is-new'), 600); spin.avif(L.querySelector('img')); queue(); };
  const decode = (L) => {
    const img = L.querySelector('img');
    const go = () => (img.decode ? img.decode() : Promise.resolve()).then(() => ready(L), () => {});
    if (img.complete && img.naturalWidth) go(); else img.addEventListener('load', go, { once: true });
  };
  const load = (i) => {
    const L = sharp[i];
    if (!L || L.dataset.st || saveData || L.dataset.s == null) return;
    L.dataset.st = '1';
    // S0 は <head> の中で先読みを始めている（Save-Data でないときだけ）。同じ URL なので、ここでは読み直さない
    const p = `${base}s${i}-`, set = (k, a, b, x) => `${p}${k}-sharp-${a}.${x} ${a}w, ${p}${k}-sharp-${b}.${x} ${b}w`;
    const src = (x, m) => `<source type="image/${x}"${m ? ' media="(max-aspect-ratio: 2/3)"' : ''} srcset="${m ? set('port', 720, 1080, x) : set('land', 1600, 2560, x)}" sizes="100vw">`;
    L.innerHTML = `<picture>${src('avif', 1)}${src('webp', 1)}${src('avif')}<img srcset="${set('land', 1600, 2560, 'webp')}" sizes="100vw" alt="" decoding="async"${i ? '' : ' fetchpriority="high"'}></picture>`;
    decode(L);
  };

  // ---- セクションの位置（resize と画像の読み込み後に測り直す）
  let zones = [];
  const measure = () => {
    const y0 = W.scrollY;
    rain.resize();
    G = null;
    if (grow && gTrack && GROW_Q.matches) { const r = gTrack.getBoundingClientRect(); G = { tt: r.top + y0, th: r.height, ph: gPin.offsetHeight }; }
    else growClear();
    R = null;
    if (rBody && PIN3.matches) {
      const t = rTrack.getBoundingClientRect();
      const T = t.top + y0;
      R = { T, E: T + t.height - rBody.offsetHeight, f: 0.12 * W.innerHeight, o: -1 };
    } else if (rTrack) rTrack.style.removeProperty('--s3');
    // 押し上げ：台座の下の角 B・塔の先 T（ずらす前の画面の y）と、フッターの上端（ページの y）
    E = null;
    if (ft && !ONE.matches) {
      const f = fit(skyEl.clientWidth, skyEl.clientHeight), port = f.k === 'port';
      E = { B: f.oy + (port ? 0.733 : 0.828) * f.ih, max: Math.max(0, f.oy + (port ? 0.417 : 0.40) * f.ih - 68), ft: ft.getBoundingClientRect().top + y0, cta: getCta ? getCta.getBoundingClientRect().top + y0 : null };
    }
    spin.resize();
    // 「アプリでは、指で回して…」の 1 行の上端：PC は台座の下の角 + 48px（画面の下端から 48px より下へは行かない）、モバイルは見出しの下 12px
    if (spinLine) {
      let v;
      if (mobile.matches) { const c = dusk.querySelector('.dusk__copy'); v = Math.round(c.offsetTop + c.offsetHeight + 12); }
      else { const f = fit(skyEl.clientWidth, skyEl.clientHeight), b = f.oy + (f.k === 'port' ? 0.733 : 0.828) * f.ih; v = Math.round(Math.min(b + 48, W.innerHeight - 48 - spinLine.offsetHeight)); }
      if (dusk.style.getPropertyValue('--spin-y') !== v + 'px') dusk.style.setProperty('--spin-y', v + 'px');
    }
    zones = [...d.querySelectorAll('[data-stage],[data-stage-from]')].map((el) => {
      const r = el.getBoundingClientRect();
      if (!r.height) return null;
      const ds = el.dataset, pin = ds.stageTo != null && !reduce.matches;
      const from = +(ds.stageFrom ?? ds.stage), to = +(ds.stageTo ?? from);
      const sh = +(mobile.matches && ds.sharpM != null ? ds.sharpM : ds.sharp);
      return { el, top: r.top + y0, h: r.height, from: reduce.matches ? to : from, to, sh, veil: +(ds.veil || 0), pin };
    }).filter(Boolean);
    queue();
  };
  // ゾーンの中の値（保持区間：上下 25% を除いた中央 50%。#dusk は全体で 4 → 5。
  // Step 4 のピン留め中は、#grow の上端から「p = 1 のときの画面の中央」まで S4・ベールのまま保ち、
  // 模型が消えきってから #dusk の上端までに --sharp を 0 → 1 に上げる。設計書の「p = 0.9 まで」だと、
  // p 0.9〜1 で消えていく模型と、晴れはじめたくっきりした箱庭が同じ位置に二重に見えた（p 0.95 で模型 0.5・--sharp 0.15））
  const G_HOLD = 1;
  const inner = (z) => {
    if (z.pin) return [z.top, z.top + z.h];
    if (G && z.el === grow) return [z.top, G.tt + G.ph * 0.5 + G_HOLD * (G.th - G.ph)];
    return [z.top + z.h * 0.25, z.top + z.h * 0.75];
  };
  const value = (z, y, sy) => {
    let t = z.from;
    if (z.pin) {
      const p = clamp((sy - z.top) / Math.max(1, z.h - W.innerHeight));
      t = lerp(z.from, z.to, z.el === dusk ? spin.lit(p) : p); // #dusk：回すときは、灯りは p 0〜0.36 で（その後の一周のあいだ S5 のまま）
    }
    return [t, z.sh, z.veil];
  };
  const sample = (y, sy) => {
    if (reduce.matches) {
      // 動きを減らす：基準線が入ったセクションのステージへ切り替える（CSS が 600ms でフェード）
      let z = zones[0];
      for (const c of zones) if (y >= c.top) z = c;
      return [z.to, z.sh, z.veil];
    }
    for (let i = 0; i < zones.length; i++) {
      const z = zones[i], [a, b] = inner(z);
      if (y < a) {
        if (!i) return value(z, a, sy);
        const p = zones[i - 1], pb = inner(p)[1], f = clamp((y - pb) / Math.max(1, a - pb));
        const u = value(p, pb, sy), v = value(z, a, sy);
        return u.map((x, k) => lerp(x, v[k], f));
      }
      if (y <= b) return value(z, y, sy);
    }
    const z = zones[zones.length - 1];
    return z ? value(z, z.top + z.h, sy) : [6, 0, 0];
  };

  let last = {}, raf = 0;
  const set = (k, v) => { if (last[k] !== v) { last[k] = v; H.style.setProperty(k, v); } };
  const tick = () => {
    raf = 0;
    const sy = W.scrollY, y = sy + W.innerHeight / 2;
    const [t, sh, veil] = sample(y, sy), k = Math.floor(t), r = Math.round(t);
    for (let i = 0; i < 7; i++) {
      const o = i ? clamp(t - (i - 1)) : 1, vis = reduce.matches ? o > 0 : (i === k || i === k + 1);
      for (const L of [soft[i], sharp[i]]) {
        const op = L === sharp[i] && !L.dataset.ready ? 0 : o;
        L.style.opacity = op;
        L.style.visibility = vis ? 'visible' : 'hidden';
      }
    }
    for (let i = r - 1; i <= r + 1; i++) load(i);
    set('--sharp', sh.toFixed(3));
    rain.set(t, sh);
    set('--scrim', Math.max(at(SCRIM, t), veil).toFixed(3));
    set('--edge', Math.min(0.5, at(SCRIM, t) * 1.6).toFixed(3)); // 左右の列（モバイルは上部）の文字の下を少し沈める
    if (H.dataset.tone !== TONE[r]) H.dataset.tone = TONE[r];
    if (clock) {
      const m = Math.round((reduce.matches ? MIN[r] : at(MIN, t)) / 5) * 5;
      const s = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
      if (clock.textContent !== s) clock.textContent = s;
      if (wx.textContent !== WX[r]) wx.textContent = WX[r];
    }
    if (dusk) {
      const z = zones.find((c) => c.el === dusk);
      if (z && z.pin) {
        const p = clamp((sy - z.top) / Math.max(1, z.h - W.innerHeight)), u = spin.lit(p);
        // 空が薄暮（S5）へ半分以上移ってから文字を出す（夕焼けの淡い空の上では cream の字が読めないため）。t − 4 = u
        dusk.style.setProperty('--dusk-o', clamp((u - 0.45) / 0.12).toFixed(3));
        dusk.style.setProperty('--spin-o', spin.line(p, 4 + u).toFixed(3));
        // 一周は、#dusk が画面にかかっている間だけ
        spin.set(p, sy + W.innerHeight > z.top && sy < z.top + z.h, t, sy);
      } else { dusk.style.removeProperty('--dusk-o'); dusk.style.removeProperty('--spin-o'); spin.set(0, false, t, sy); }
    }
    if (G) growTick(sy);
    if (R) s3Tick(sy);
    endTick(sy);
    hd.classList.toggle('is-scrolled', sy > 8);
  };
  const queue = () => { if (!raf) raf = requestAnimationFrame(tick); };

  W.addEventListener('scroll', queue, { passive: true });
  W.addEventListener('resize', measure);
  W.addEventListener('load', measure);
  reduce.addEventListener?.('change', measure);
  GROW_Q.addEventListener?.('change', measure);
  PIN3.addEventListener?.('change', measure);
  ONE.addEventListener?.('change', measure);
  // FAQ を開く・画像が読み込まれるなどで、フッターの位置（押し上げの起点）が動いたら測り直す
  if ('ResizeObserver' in W) new ResizeObserver(() => measure()).observe(d.body);
  else d.addEventListener('toggle', measure, true);
  d.fonts?.ready.then(measure);
  d.querySelectorAll('main img').forEach((i) => i.complete || i.addEventListener('load', measure, { once: true }));
  load(0);
  measure();

  // ---- 一周の連番を読み始める：#grow の上端が、画面の下端から画面 1 枚ぶんの所まで来たとき（下から戻ってきたときのために、#features が見えたときも）
  if ('IntersectionObserver' in W && dusk && !saveData && !reduce.matches) {
    const io2 = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { io2.disconnect(); spin.start(); } }, { rootMargin: '0px 0px 100% 0px' });
    [grow, d.getElementById('features')].forEach((el) => el && io2.observe(el));
  }

  // ---- ヒーローの CTA が見えなくなったら：ヘッダーの「予約する」と、モバイルの追従バー
  const bar = d.querySelector('.bar'), cta = d.querySelector('#hero-cta .store') || d.getElementById('hero-cta'), get = d.getElementById('get');
  if ('IntersectionObserver' in W && cta) {
    // バーは、ヒーローの CTA が消えた ∧ #get が見えていない ∧ フッターが 1px も見えていない、の間だけ（最後の画面には出さない）
    let heroOut = false, getIn = false, ftIn = false;
    const upd = () => { H.classList.toggle('cta-off', heroOut); bar && bar.classList.toggle('is-on', heroOut && !getIn && !ftIn); };
    new IntersectionObserver(([e]) => { heroOut = !e.isIntersecting && e.boundingClientRect.top < 0; upd(); }).observe(cta);
    if (get) new IntersectionObserver(([e]) => { getIn = e.isIntersecting; upd(); }, { rootMargin: '0px 0px -30% 0px' }).observe(get);
    if (ft) new IntersectionObserver(([e]) => { ftIn = e.isIntersecting; upd(); }).observe(ft);
    // 解説・スマホ・目録の組は、画面に入るときに一度だけ出る（解説と組の頭は子を順に。site.css の .note.reveal）。棚の 7 都市は 1 つの塊で同時に
    if (!reduce.matches) {
      const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' });
      d.querySelectorAll('.note, .phone, .cat__head, .cat__aside, .cities, .sounds, .cat__shot, .cat__end, .plan').forEach((el) => {
        if (PIN3.matches && rBody && rBody.contains(el)) return;
        if (el.getBoundingClientRect().top > W.innerHeight) { el.classList.add('reveal'); io.observe(el); }
      });
    }
  }
})();
