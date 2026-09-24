#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""رندر PNG برای چارت‌های نظام بازرسی (بدون وابستگی به مرورگر/CDN).

خروجی‌ها:
  docs/img/roles-org-chart.png    چارت درختی نقش‌ها + خطوط ارتباطی
  docs/img/inspection-cycle.png   فلوچارت ۲۶ گامی چرخه بازرسی

استفاده:  python3 tools/render_png.py
"""
import math
import os

import arabic_reshaper
from bidi.algorithm import get_display
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "docs", "img")
FONT_R = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
FONT_B = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"

WHITE = (255, 255, 255)
BG = (247, 248, 252)
INK = (31, 36, 48)
MUTED = (107, 114, 128)
NAVY = (31, 58, 138)


def R(s):
    """شکل‌دهی و دوجهته‌سازی متن فارسی برای PIL."""
    if any("\u0600" <= ch <= "\u06FF" or "\uFB50" <= ch <= "\uFEFF" for ch in s):
        return get_display(arabic_reshaper.reshape(s))
    return s


class Kit:
    def __init__(self):
        self.f = {}

    def font(self, size, bold=False):
        k = (size, bold)
        if k not in self.f:
            self.f[k] = ImageFont.truetype(FONT_B if bold else FONT_R, size)
        return self.f[k]

    def wrap(self, s, font, maxw):
        out, cur = [], ""
        for w in str(s).split():
            t = (cur + " " + w).strip()
            if not cur or self.len(t, font) <= maxw:
                cur = t
            else:
                out.append(cur)
                cur = w
        if cur:
            out.append(cur)
        return out

    @staticmethod
    def len(s, font):
        return font.getlength(R(s))

    def text(self, d, xy, s, font, fill=INK, anchor="la", stroke=0, stroke_fill=WHITE):
        d.text(xy, R(s), font=font, fill=fill, anchor=anchor,
               stroke_width=stroke, stroke_fill=stroke_fill)

    def block(self, d, xy, lines, font, fill=INK, lh=None, anchor="la"):
        """چند خط متن؛ برگرداندن ارتفاع."""
        lh = lh or font.size + 6
        x, y = xy
        for i, ln in enumerate(lines):
            self.text(d, (x, y + i * lh), ln, font, fill=fill, anchor=anchor)
        return len(lines) * lh

    def rrect(self, d, box, r, fill=WHITE, outline=None, w=2):
        d.rounded_rectangle(box, radius=r, fill=fill, outline=outline, width=w)

    def arrow(self, d, p0, p1, color, w=3, size=11):
        d.line([p0, p1], fill=color, width=w)
        self.head(d, p1, math.atan2(p1[1] - p0[1], p1[0] - p0[0]), color, size)

    def head(self, d, p, ang, color, size=11):
        a1, a2 = ang + math.radians(155), ang - math.radians(155)
        d.polygon([p,
                   (p[0] + size * math.cos(a1), p[1] + size * math.sin(a1)),
                   (p[0] + size * math.cos(a2), p[1] + size * math.sin(a2))],
                  fill=color)

    def bezier(self, p0, p1, p2, p3, n=90):
        pts = []
        for i in range(n + 1):
            t = i / n
            u = 1 - t
            x = u**3 * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t**3 * p3[0]
            y = u**3 * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t**3 * p3[1]
            pts.append((x, y))
        return pts

    def dashed(self, d, pts, color, w=3, dash=(12, 8)):
        acc, on, seg = 0.0, True, 0.0
        for a, b in zip(pts, pts[1:]):
            seg = math.hypot(b[0] - a[0], b[1] - a[1])
            if on:
                d.line([a, b], fill=color, width=w)
            acc += seg
            lim = dash[0] if on else dash[1]
            if acc >= lim:
                acc, on = 0.0, not on
        return pts[-1], math.atan2(pts[-1][1] - pts[-2][1], pts[-1][0] - pts[-2][0])

    def curve_arrow(self, d, pts, color, w=3, dash=None, size=11):
        if dash:
            end, ang = self.dashed(d, pts, color, w, dash)
        else:
            d.line(pts, fill=color, width=w)
            end, ang = pts[-1], math.atan2(pts[-1][1] - pts[-2][1], pts[-1][0] - pts[-2][0])
        self.head(d, end, ang, color, size)


K = Kit()


# ======================================================================
# داده‌ها
# ======================================================================
KINDS = {
    "exec": ("مدیریت ارشد", (31, 58, 138)),
    "over": ("نهاد نظارتی / کمیته", (224, 49, 49)),
    "dep":  ("معاونت (تصویب‌کننده)", (232, 89, 12)),
    "insp": ("صف بازرسی", (12, 166, 120)),
    "sup":  ("ستادی / پشتیبان", (25, 113, 194)),
    "unit": ("واحد مورد بازرسی", (112, 72, 232)),
    "sys":  ("سامانه و فناوری", (92, 102, 115)),
}

NODES = [
    ("ceo", None, "R-01", "exec", "مدیرعامل / بالاترین مقام سازمان"),
    ("oversight", "ceo", "R-02", "over", "کمیته عالی بازرسی و نظارت"),
    ("deputy", "ceo", "R-03", "dep", "معاونت بازرسی و امور نظارتی"),
    ("committee", "ceo", "R-11", "over", "کمیته رسیدگی به تخلفات"),
    ("discipline", "committee", "R-12", "over", "کمیته انضباطی"),
    ("ops", "ceo", "R-13", "unit", "معاونت‌های صفی (مالی/فنی/اجرایی)"),
    ("staff", "ceo", "R-14", "sup", "واحدهای ستادی پشتیبان"),
    ("insp_org", "deputy", "R-04", "insp", "اداره بازرسی (مدیر بازرسی)"),
    ("sec", "insp_org", "R-05", "insp", "دبیرخانه بازرسی"),
    ("teams", "insp_org", "R-06", "insp", "گروه‌های تخصصی بازرسی"),
    ("lead", "teams", "R-07", "insp", "سرپرست تیم بازرسی"),
    ("inspector", "lead", "R-08", "insp", "بازرس"),
    ("inspector2", "lead", "R-09", "insp", "بازرس همکار / کارآموز"),
    ("expert", "teams", "R-10", "sup", "کارشناس تخصصی / آزمایشگاه"),
    ("unit_head", "ops", "R-15", "unit", "مدیر واحد مورد بازرسی"),
    ("unit_liaison", "unit_head", "R-16", "unit", "رابط بازرسی واحد"),
    ("unit_staff", "unit_liaison", "R-17", "unit", "کارکنان و فرایندهای واحد"),
    ("legal", "staff", "R-18", "sup", "مشاور حقوقی"),
    ("security", "staff", "R-19", "sup", "حراست / امنیت"),
    ("hr", "staff", "R-20", "sup", "منابع انسانی"),
    ("it", "staff", "R-21", "sys", "فناوری اطلاعات و سامانه"),
]

XLINKS = [
    ("deputy", "inspector", "approve", "تایید مشخصات بازرس و صدور حکم"),
    ("deputy", "lead", "approve", "تایید گزارش نهایی"),
    ("deputy", "unit_head", "approve", "تصویب برنامه اقدام اصلاحی"),
    ("deputy", "committee", "escalate", "ارجاع تخلف محرز"),
    ("oversight", "deputy", "consult", "پایش عملکرد چرخه"),
    ("inspector", "unit_liaison", "coordinate", "درخواست مستندات و مصاحبه"),
    ("sec", "unit_liaison", "coordinate", "ابلاغ و هماهنگی زمان"),
    ("insp_org", "unit_head", "boundary", "مرز استقلال: ممنوعیت تعارض منافع"),
    ("expert", "inspector", "coordinate", "کارشناسی و تست تکمیلی"),
    ("legal", "lead", "consult", "انطباق حقوقی یافته‌ها"),
    ("security", "insp_org", "coordinate", "همکاری در بازرسی سرزده"),
    ("hr", "deputy", "consult", "بانک صلاحیت بازرس‌ها"),
    ("it", "sec", "consult", "سامانه، بایگانی و داشبورد"),
    ("committee", "discipline", "escalate", "ارجاع قصور و ضمانت اجرا"),
]

LTYPES = {
    "hierarchy":  ("سلسله‌مراتب / گزارش‌دهی", (31, 58, 138), None, 3),
    "approve":    ("اختیار تایید و تصویب", (232, 89, 12), None, 4),
    "coordinate": ("هماهنگی اجرایی", (12, 166, 120), (10, 7), 3),
    "consult":    ("مشاوره و پشتیبانی", (112, 72, 232), (3, 6), 3),
    "escalate":   ("ارجاع نظارتی / تخلفات", (224, 49, 49), (12, 6), 3),
    "boundary":   ("مرز استقلال (تعارض منافع)", (194, 37, 92), (14, 5, 4, 5), 4),
}

PHASES = [
    ("فاز ۱ — دریافت و برنامه‌ریزی", [
        ("start", "منبع بازرسی: برنامه سالانه / شکایت / گزارش تخلف / دستور مدیریت / پیگیری دوره قبل", "off", None),
        ("task", "گام ۱ — ثبت در دبیرخانه بازرسی: کد رهگیری، اولویت‌بندی عادی یا فوری", "off", None),
        ("task", "گام ۲ — تعیین نوع، دامنه و معیارهای بازرسی + انتخاب بازرس واجد صلاحیت", "off", None),
    ]),
    ("فاز ۲ — تایید معاونت و صدور حکم ماموریت", [
        ("dec", "گام ۳ — تایید مشخصات بازرس توسط معاونت؟", "dep",
         [("بله", "next", "گام ۴"), ("خیر", "loop", "بازگشت به گام ۲")]),
        ("task", "گام ۴ — صدور حکم ماموریت بازرسی با امضای معاونت + مهلت و اختیارات", "dep", None),
        ("task", "گام ۵ — ابلاغ و هماهنگی با واحد (اعلام‌شده یا سرزده)", "unit", None),
        ("task", "گام ۶ — آماده‌سازی تیم: چک‌لیست، مستندات مرجع، معرفی‌نامه", "insp", None),
    ]),
    ("فاز ۳ — اجرای بازرسی میدانی", [
        ("task", "گام ۷ — جلسه افتتاحیه: معرفی تیم، دامنه و روش کار", "insp", None),
        ("task", "گام ۸ — اجرای بازرسی: مستندات، مشاهده، مصاحبه، نمونه‌برداری و تست", "insp", None),
        ("task", "گام ۹ — ثبت یافته‌ها و شواهد: مغایرت بحرانی / عمده / جزئی + نقاط قوت", "insp", None),
        ("dec", "گام ۱۰ — نیاز به کارشناسی یا تست تکمیلی؟", "insp",
         [("بله", "loop", "بازگشت به گام ۸"), ("خیر", "next", "گام ۱۱")]),
        ("task", "گام ۱۱ — جلسه اختتامیه و دریافت توضیحات واحد", "insp", None),
    ]),
    ("فاز ۴ — گزارش‌دهی و تایید", [
        ("task", "گام ۱۲ — تدوین پیش‌نویس گزارش بازرسی", "insp", None),
        ("task", "گام ۱۳ — بازبینی کیفی توسط سرپرست بازرسی", "off", None),
        ("dec", "گام ۱۴ — تایید گزارش توسط معاونت؟", "dep",
         [("بله", "next", "گام ۱۵"), ("اصلاح", "loop", "بازگشت به گام ۱۲")]),
        ("task", "گام ۱۵ — ابلاغ گزارش نهایی و شروع مهلت پاسخ", "off", None),
        ("dec", "گام ۱۶ — اعتراض واحد به گزارش؟", "unit",
         [("بله", "next", "گام ۱۷"), ("خیر", "next", "گام ۱۸")]),
        ("task", "گام ۱۷ — رسیدگی به اعتراض توسط معاونت", "dep", None),
    ]),
    ("فاز ۵ — اقدام اصلاحی و راستی‌آزمایی", [
        ("dec", "گام ۱۸ — تخلف محرز یا مغایرت بحرانی؟", "dep",
         [("بله", "next", "گام ۱۹"), ("خیر", "next", "گام ۲۰")]),
        ("task", "گام ۱۹ — ارجاع به کمیته رسیدگی / حراست", "top", None),
        ("task", "گام ۲۰ — تعیین اقدامات اصلاحی (CAPA) + تصویب معاونت", "unit", None),
        ("task", "گام ۲۱ — اجرای اقدام اصلاحی توسط واحد و ارسال شواهد", "unit", None),
        ("dec", "گام ۲۲ — راستی‌آزمایی اثربخشی توسط بازرس تایید شد؟", "insp",
         [("بله", "next", "گام ۲۴"), ("خیر", "loop", "بازگشت به گام ۲۰")]),
        ("task", "گام ۲۳ — ارجاع به کمیته انضباطی", "top", None),
    ]),
    ("فاز ۶ — اختتام، بایگانی و بازخورد", [
        ("task", "گام ۲۴ — صدور نامه رفع مغایرت و بستن پرونده", "dep", None),
        ("task", "گام ۲۵ — بایگانی سوابق و به‌روزرسانی داشبورد شاخص‌ها", "sys", None),
        ("task", "گام ۲۶ — درس‌آموخته‌ها، بازنگری چک‌لیست و گزارش دوره‌ای", "off", None),
        ("start", "بازگشت به برنامه‌ریزی بازرسی دوره بعد — بهبود مستمر", "sys", None),
    ]),
]

R_ROLE = {
    "off": ("دبیرخانه بازرسی", (25, 113, 194)),
    "insp": ("بازرس", (12, 166, 120)),
    "dep": ("معاونت", (232, 89, 12)),
    "unit": ("واحد مورد بازرسی", (112, 72, 232)),
    "top": ("مدیریت / کمیته", (224, 49, 49)),
    "sys": ("سامانه", (92, 102, 115)),
}


# ======================================================================
# چارت درختی نقش‌ها
# ======================================================================
def render_org():
    CW, CH = 250, 96
    GX, GY = 26, 96
    M = 60

    children = {}
    for nid, par, *_ in NODES:
        children.setdefault(par, []).append(nid)

    order, pos = [], {}

    def layout(nid, depth):
        kids = children.get(nid, [])
        if not kids:
            x = len(order)
            order.append(nid)
        else:
            xs = [layout(k, depth + 1) for k in kids]
            x = sum(xs) / len(xs)
        pos[nid] = (x, depth)
        return x

    layout("ceo", 0)
    depth = max(d for _, d in pos.values()) + 1
    leg_rows = math.ceil(len(XLINKS) / 2)
    W = int(M * 2 + len(order) * (CW + GX) - GX)
    H = int(M * 2 + 60 + depth * (CH + GY) + 30 + leg_rows * 32 + 96)

    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)

    def box(nid):
        x, dep = pos[nid]
        cx = M + x * (CW + GX)
        cy = M + 60 + dep * (CH + GY)
        return (cx, cy, cx + CW, cy + CH)

    # سربرگ
    K.text(d, (M, 16), "چارت درختی نقش‌ها و ارتباطات — نظام بازرسی",
           K.font(30, True), fill=NAVY)
    K.text(d, (M, 54), "۲۱ نقش · ۶ سطح سلسله‌مراتب · خطوط رنگی = انواع ارتباط (شماره‌ها در فهرست پایین)",
           K.font(17), fill=MUTED)

    # خطوط سلسله‌مراتب
    for nid, par, *_ in NODES:
        if not par:
            continue
        pb, cb = box(par), box(nid)
        px, py = (pb[0] + pb[2]) / 2, pb[3]
        cx, cy = (cb[0] + cb[2]) / 2, cb[1]
        mid = py + (GY - 40) / 2 + 8
        d.line([(px, py), (px, mid)], fill=NAVY, width=3)
        d.line([(px, mid), (cx, mid)], fill=NAVY, width=3)
        K.arrow(d, (cx, mid), (cx, cy - 3), NAVY, 3, 10)

    # منحنی‌های ارتباطی (زیر کارت‌ها)
    chips = []
    for i, (src, dst, typ, label) in enumerate(XLINKS, 1):
        name, color, dash, wdt = LTYPES[typ]
        a, b = box(src), box(dst)
        acx, acy = (a[0] + a[2]) / 2, (a[1] + a[3]) / 2
        bcx, bcy = (b[0] + b[2]) / 2, (b[1] + b[3]) / 2
        dy, dx = bcy - acy, bcx - acx
        if abs(dy) > CH * 0.9:
            y1 = a[3] if dy > 0 else a[1]
            y2 = b[1] - 6 if dy > 0 else b[3] + 6
            my = (y1 + y2) / 2
            pts = K.bezier((acx, y1), (acx, my), (bcx, my), (bcx, y2))
            mx, myy = (acx + bcx) / 2, my
        else:
            x1 = a[2] + 4 if dx > 0 else a[0] - 4
            x2 = b[0] - 6 if dx > 0 else b[2] + 6
            bow = max(acy, bcy) + 52
            pts = K.bezier((x1, acy), ((x1 + x2) / 2, bow),
                           ((x1 + x2) / 2, bow), (x2, bcy))
            mx, myy = (x1 + x2) / 2, bow - 16
        K.curve_arrow(d, pts, color, wdt, dash, 10)
        chips.append((i, mx, myy, color))

    # کارت‌ها
    for nid, par, code, kind, title in NODES:
        name, color = KINDS[kind]
        x0, y0, x1, y1 = box(nid)
        d.rounded_rectangle([x0, y0, x1, y1], radius=12, fill=WHITE,
                            outline=(221, 226, 236), width=2)
        d.rounded_rectangle([x0, y0, x1, y0 + 8], radius=4, fill=color)
        cf = K.font(13, True)
        cw = cf.getlength(code) + 14
        d.rounded_rectangle([x0 + 8, y0 - 9, x0 + 8 + cw, y0 + 11], radius=6, fill=color)
        d.text((x0 + 8 + cw / 2, y0 + 1), code, font=cf, fill=WHITE, anchor="ma")
        lines = K.wrap(title, K.font(16, True), CW - 20)
        K.block(d, (x0 + 10, y0 + 16), lines[:2], K.font(16, True), fill=INK, lh=22)
        K.text(d, (x0 + 10, y1 - 22), name, K.font(12), fill=color)

    # چیپ‌های شماره‌دار روی خطوط ارتباطی
    FA = "۰۱۲۳۴۵۶۷۸۹"
    fa = lambda n: "".join(FA[int(c)] for c in str(n))
    for i, mx, myy, color in chips:
        d.ellipse([mx - 13, myy - 13, mx + 13, myy + 13], fill=color,
                  outline=BG, width=3)
        K.text(d, (mx, myy - 10), fa(i), K.font(14, True), fill=WHITE, anchor="ma")

    # راهنمای انواع خط
    ly = M + 60 + depth * (CH + GY) + 6
    K.text(d, (M, ly), "راهنمای خطوط:", K.font(16, True), fill=INK)
    cx0 = M + 120
    for key, (name, color, dash, wdt) in LTYPES.items():
        pts = K.bezier((cx0, ly + 8), (cx0, ly + 8), (cx0 + 44, ly + 8), (cx0 + 44, ly + 8), 40)
        if dash:
            K.dashed(d, pts, color, wdt, dash)
        else:
            d.line([(cx0, ly + 8), (cx0 + 44, ly + 8)], fill=color, width=wdt)
        tw = K.len(name, K.font(14))
        K.text(d, (cx0 + 52, ly - 2), name, K.font(14), fill=color)
        cx0 += 52 + tw + 36

    # فهرست شماره‌دار ارتباطات
    ty = ly + 40
    col_w = (W - 2 * M) / 2
    titles = {n[0]: n[4] for n in NODES}
    for i, (src, dst, typ, label) in enumerate(XLINKS, 1):
        name, color, dash, wdt = LTYPES[typ]
        col = (i - 1) % 2
        row = (i - 1) // 2
        rx = W - M - col * (col_w + 10)
        ry = ty + row * 32
        d.ellipse([rx - 26, ry - 1, rx, ry + 25], fill=color, outline=BG, width=2)
        K.text(d, (rx - 13, ry + 2), fa(i), K.font(13, True), fill=WHITE, anchor="ma")
        K.text(d, (rx - 34, ry + 1), f"{titles[src]} ← {titles[dst]}: {label}",
               K.font(14), fill=INK, anchor="ra")
    return img


# ======================================================================
# فلوچارت چرخه بازرسی
# ======================================================================
def render_cycle():
    CW = 760
    M = 70
    img = Image.new("RGB", (1080, 400), BG)  # موقت؛ ارتفاع نهایی بعد از محاسبه
    probe = ImageDraw.Draw(img)

    # پیش‌محاسبه ارتفاع
    rows = []
    y = 0
    for pname, nodes in PHASES:
        rows.append(("phase", pname, None, None))
        y += 64
        for kind, title, role, branches in nodes:
            h = 52 if kind in ("task", "start") else 52 + 30 * len(branches)
            rows.append(("node", title, (kind, role, branches), h))
            y += h + 34
    H = y + 130
    img = Image.new("RGB", (1080, H), BG)
    d = ImageDraw.Draw(img)

    K.text(d, (M, 24), "چرخه بازرسی — فرایند انجام کار (۲۶ گام در ۶ فاز)",
           K.font(30, True), fill=NAVY)
    K.text(d, (M, 62), "خطوط نقطه‌چین نارنجی = حلقه‌های بازگشت؛ رنگ هر کارت = نقش مسئول",
           K.font(17), fill=MUTED)

    cx = 540
    y = 110
    anchors = {}  # شماره گام -> (y_top, y_bot)
    seq = 0

    def step_no(title):
        import re as _re
        m = _re.search(r"گام\s*([۰-۹]+)", title)
        return m.group(1) if m else None

    FA2EN = str.maketrans("۰۱۲۳۴۵۶۷۸۹", "0123456789")
    pending_loops = []
    prev_bottom = None

    for rtype, title, extra, h in rows:
        if rtype == "phase":
            d.rounded_rectangle([M - 20, y, 1080 - M + 20, y + 44], radius=10,
                                fill=(232, 236, 246))
            K.text(d, (M, y + 9), title, K.font(19, True), fill=NAVY)
            y += 64
            prev_bottom = None
            continue
        kind, role, branches = extra
        rname, rcolor = R_ROLE[role]
        x0, x1 = cx - CW / 2, cx + CW / 2
        if prev_bottom is not None:
            K.arrow(d, (cx, prev_bottom), (cx, y - 4), NAVY, 3, 11)
        if kind == "start":
            d.rounded_rectangle([x0, y, x1, y + h], radius=h / 2,
                                fill=(231, 245, 255), outline=(25, 113, 194), width=2)
            K.text(d, (cx, y + h / 2 - 11), title, K.font(16, True), fill=(11, 61, 102),
                   anchor="ma")
        elif kind == "task":
            d.rounded_rectangle([x0, y, x1, y + h], radius=12, fill=WHITE,
                                outline=(221, 226, 236), width=2)
            d.rectangle([x0, y + 6, x0 + 6, y + h - 6], fill=rcolor)
            lines = K.wrap(title, K.font(16, True), CW - 150)
            K.block(d, (x0 + 20, y + 14), lines[:2], K.font(16, True), lh=23)
            # بج نقش
            rf = K.font(13, True)
            tw = K.len(rname, rf) + 18
            d.rounded_rectangle([x1 - tw - 10, y + 10, x1 - 10, y + 32], radius=11,
                                fill=rcolor)
            K.text(d, (x1 - 10 - tw / 2 - 9 + 9, y + 13), rname, rf, fill=WHITE, anchor="ma")
        else:  # تصمیم
            d.rounded_rectangle([x0, y, x1, y + h], radius=12, fill=(255, 250, 235),
                                outline=(232, 89, 12), width=2)
            d.rectangle([x0, y + 6, x0 + 6, y + h - 6], fill=rcolor)
            d.rounded_rectangle([x0 + 16, y + 12, x0 + 42, y + 38], radius=8,
                                fill=(255, 224, 102))
            K.text(d, (x0 + 29, y + 15), "؟", K.font(17, True), fill=(92, 69, 0), anchor="ma")
            lines = K.wrap(title, K.font(16, True), CW - 160)
            K.block(d, (x0 + 54, y + 14), lines[:2], K.font(16, True), lh=23)
            by = y + 46
            for tag, bkind, target in branches:
                col = (12, 166, 120) if bkind == "next" else (232, 89, 12)
                tf = K.font(13, True)
                tw = K.len(tag, tf) + 16
                d.rounded_rectangle([x0 + 22, by, x0 + 22 + tw, by + 22], radius=7, fill=col)
                K.text(d, (x0 + 22 + tw / 2, by + 3), tag, tf, fill=WHITE, anchor="ma")
                K.text(d, (x0 + 34 + tw, by + 2), target, K.font(14), fill=(60, 66, 83))
                if bkind == "loop":
                    no = step_no(target) or target
                    pending_loops.append((y + h / 2, no, x1))
                by += 30

        no = step_no(title)
        if no:
            anchors[no.translate(FA2EN)] = (y, y + h)
        prev_bottom = y + h
        y += h + 34

    # حلقه‌های بازگشت
    for src_y, target, x1 in pending_loops:
        tkey = target.replace("گام ", "").translate(FA2EN).strip()
        if tkey not in anchors:
            continue
        ty = (anchors[tkey][0] + anchors[tkey][1]) / 2
        rail = x1 + 46
        d.rounded_rectangle([rail - 3, min(src_y, ty), rail + 3, max(src_y, ty)],
                            radius=3, fill=(232, 89, 12))
        d.line([(x1 + 2, src_y), (rail, src_y)], fill=(232, 89, 12), width=3)
        d.line([(rail, ty), (x1 + 10, ty)], fill=(232, 89, 12), width=3)
        K.head(d, (x1 + 4, ty), math.pi, (232, 89, 12), 10)
        # نقطه‌چین روی ریل
        yy = min(src_y, ty)
        while yy < max(src_y, ty):
            d.line([(rail - 5, yy), (rail + 5, yy)], fill=BG, width=4)
            yy += 14

    K.text(d, (M, H - 46), "میانگین زمان چرخه کامل: ۳۵ تا ۵۰ روز کاری · هر حلقه بازگشت حداکثر دو بار مجاز است",
           K.font(15), fill=MUTED)
    return img


def main():
    os.makedirs(OUT, exist_ok=True)
    for fn, img in (("roles-org-chart.png", render_org()),
                    ("inspection-cycle.png", render_cycle())):
        p = os.path.join(OUT, fn)
        img.save(p, optimize=True)
        print("saved", p, img.size, os.path.getsize(p) // 1024, "KB")


if __name__ == "__main__":
    main()
