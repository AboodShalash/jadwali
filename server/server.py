#!/usr/bin/env python3
"""
جدولي 4 — خادم المزامنة
FastAPI + SQLite

الفكرة: لكل مستخدم «مستند» واحد يحوي مجموعات (مواد، حصص، مهام، جلسات، ...).
كل عنصر يحمل طابع تعديل `u`، فيدمج الخادم التغييرات عنصراً عنصراً (آخر تعديل يفوز)
وبذلك لا تضيع تعديلات جهازين يعملان في الوقت نفسه.
"""
import hashlib
import hmac
import json
import os
import re
import secrets
import sqlite3
import threading
import time
import urllib.request
import urllib.error
from pathlib import Path
from typing import Any, Dict, Optional

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

ROOT = Path(__file__).resolve().parent
PUBLIC = ROOT.parent / "public"
DB_PATH = os.environ.get("JADWALI_DB", str(ROOT / "jadwali4.db"))
MAX_DOC = 4_000_000

lock = threading.Lock()
db = sqlite3.connect(DB_PATH, check_same_thread=False)
db.row_factory = sqlite3.Row
db.executescript(
    """
PRAGMA journal_mode=WAL;
CREATE TABLE IF NOT EXISTS users(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE, name TEXT NOT NULL DEFAULT '',
  pw_hash TEXT, pw_salt TEXT, guest INTEGER NOT NULL DEFAULT 1,
  created INTEGER NOT NULL, seen INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS tokens(token TEXT PRIMARY KEY, user_id INTEGER NOT NULL, created INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS idents(ident TEXT PRIMARY KEY, user_id INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS feedback(id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, name TEXT, email TEXT, topic TEXT, subject TEXT, message TEXT NOT NULL, created INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS docs(user_id INTEGER PRIMARY KEY, data TEXT NOT NULL, rev INTEGER NOT NULL, updated INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS user_stats(user_id INTEGER PRIMARY KEY, week_min INTEGER NOT NULL DEFAULT 0, streak INTEGER NOT NULL DEFAULT 0, xp INTEGER NOT NULL DEFAULT 0, lvl INTEGER NOT NULL DEFAULT 1, updated INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS friends(a INTEGER NOT NULL, b INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'pending', created INTEGER NOT NULL, PRIMARY KEY(a,b));
"""
)
db.commit()


def now() -> int:
    return int(time.time() * 1000)


# ---------------- الدمج ----------------
def merge(a: Dict[str, Any], b: Dict[str, Any]) -> Dict[str, Any]:
    """دمج مستندين: المجموعات (قوائم عناصر لها id) عنصراً عنصراً، والكائنات حسب الطابع u."""
    out = dict(a or {})
    for k, bv in (b or {}).items():
        av = out.get(k)
        if isinstance(bv, list) and (isinstance(av, list) or av is None):
            idx = {}
            for it in (av or []):
                if isinstance(it, dict) and "id" in it:
                    idx[str(it["id"])] = it
            for it in bv:
                if not isinstance(it, dict) or "id" not in it:
                    continue
                cur = idx.get(str(it["id"]))
                if cur is None or (it.get("u") or 0) >= (cur.get("u") or 0):
                    idx[str(it["id"])] = it
            out[k] = list(idx.values())
        elif isinstance(bv, dict) and isinstance(av, dict):
            out[k] = bv if (bv.get("u") or 0) >= (av.get("u") or 0) else av
        elif av is None:
            out[k] = bv
        else:
            out[k] = bv
    return out


def prune(doc: Dict[str, Any]) -> Dict[str, Any]:
    """حذف العناصر المحذوفة منذ أكثر من 60 يوماً."""
    cutoff = now() - 60 * 864e5
    for k, v in list(doc.items()):
        if isinstance(v, list):
            doc[k] = [x for x in v if not (isinstance(x, dict) and x.get("del") and (x.get("u") or 0) < cutoff)]
    return doc


# ---------------- الهوية ----------------
def hash_pw(pw: str, salt: Optional[str] = None):
    salt = salt or secrets.token_hex(16)
    return hashlib.pbkdf2_hmac("sha256", pw.encode(), bytes.fromhex(salt), 200_000).hex(), salt


def ident_of(req: Request) -> Optional[str]:
    v = req.headers.get("x-visitor-id")
    if v:
        return "v:" + v[:128]
    d = req.headers.get("x-device-id")
    if d and re.fullmatch(r"[A-Za-z0-9_-]{8,64}", d):
        return "d:" + d
    return None


def new_guest() -> int:
    t = now()
    return db.execute("INSERT INTO users(created,seen) VALUES(?,?)", (t, t)).lastrowid


def current(req: Request, create=True):
    auth = req.headers.get("authorization", "")
    if auth.lower().startswith("bearer "):
        row = db.execute(
            "SELECT u.* FROM tokens t JOIN users u ON u.id=t.user_id WHERE t.token=?", (auth[7:].strip(),)
        ).fetchone()
        if row:
            return row
    ident = ident_of(req)
    if ident:
        r = db.execute("SELECT u.* FROM idents i JOIN users u ON u.id=i.user_id WHERE i.ident=?", (ident,)).fetchone()
        if r:
            return r
    if not create:
        return None
    uid = new_guest()
    if ident:
        db.execute("INSERT OR REPLACE INTO idents(ident,user_id) VALUES(?,?)", (ident, uid))
    db.commit()
    return db.execute("SELECT * FROM users WHERE id=?", (uid,)).fetchone()


def token_for(uid: int) -> str:
    tok = secrets.token_urlsafe(32)
    db.execute("INSERT INTO tokens(token,user_id,created) VALUES(?,?,?)", (tok, uid, now()))
    return tok


def pub(u) -> Dict[str, Any]:
    return {"id": u["id"], "username": u["username"], "name": u["name"], "guest": bool(u["guest"])}


def get_doc(uid: int):
    r = db.execute("SELECT data,rev FROM docs WHERE user_id=?", (uid,)).fetchone()
    return (json.loads(r["data"]), r["rev"]) if r else ({}, 0)


def put_doc(uid: int, data: Dict[str, Any], rev: int):
    s = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    if len(s.encode()) > MAX_DOC:
        raise HTTPException(413, "حجم البيانات أكبر من المسموح")
    db.execute(
        "INSERT INTO docs(user_id,data,rev,updated) VALUES(?,?,?,?) "
        "ON CONFLICT(user_id) DO UPDATE SET data=excluded.data,rev=excluded.rev,updated=excluded.updated",
        (uid, s, rev, now()),
    )


# ---------------- الواجهة ----------------
app = FastAPI(title="Jadwali 4")
app.add_middleware(GZipMiddleware, minimum_size=800)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


class Push(BaseModel):
    data: Dict[str, Any]
    rev: int = 0


class Cred(BaseModel):
    username: str = Field(min_length=3, max_length=32)
    password: str = Field(min_length=6, max_length=128)
    name: str = Field(default="", max_length=40)
    carry: bool = True  # نقل بيانات الضيف الحالية إلى الحساب


@app.get("/api/health")
def health():
    return {"ok": True, "time": now(), "v": 4}


@app.get("/api/sync")
def pull(req: Request, since: int = -1):
    with lock:
        u = current(req)
        db.execute("UPDATE users SET seen=? WHERE id=?", (now(), u["id"]))
        db.commit()
        data, rev = get_doc(u["id"])
    if since == rev:
        return {"rev": rev, "user": pub(u), "same": True}
    return {"rev": rev, "data": data, "user": pub(u)}


@app.put("/api/sync")
def push(body: Push, req: Request):
    with lock:
        u = current(req)
        data, rev = get_doc(u["id"])
        merged = prune(merge(data, body.data)) if rev else prune(body.data)
        rev += 1
        put_doc(u["id"], merged, rev)
        db.commit()
    # إن كان لدى الخادم تغييرات لم يرها العميل نعيد المستند المدموج كاملاً
    stale = body.rev != rev - 1
    return {"rev": rev, "user": pub(u), **({"data": merged} if stale else {})}


@app.post("/api/auth/register")
def register(c: Cred, req: Request):
    name = c.username.strip().lower()
    if not re.fullmatch(r"[a-z0-9_.\-]{3,32}", name):
        raise HTTPException(400, "اسم المستخدم: أحرف إنجليزية وأرقام فقط (3 أحرف على الأقل)")
    with lock:
        if db.execute("SELECT 1 FROM users WHERE username=?", (name,)).fetchone():
            raise HTTPException(409, "اسم المستخدم مستخدم من قبل")
        u = current(req)
        h, s = hash_pw(c.password)
        if u["guest"]:
            db.execute("UPDATE users SET username=?,name=?,pw_hash=?,pw_salt=?,guest=0 WHERE id=?", (name, c.name.strip(), h, s, u["id"]))
            uid = u["id"]
        else:
            t = now()
            uid = db.execute(
                "INSERT INTO users(username,name,pw_hash,pw_salt,guest,created,seen) VALUES(?,?,?,?,0,?,?)",
                (name, c.name.strip(), h, s, t, t),
            ).lastrowid
        tok = token_for(uid)
        db.commit()
        u = db.execute("SELECT * FROM users WHERE id=?", (uid,)).fetchone()
    return {"token": tok, "user": pub(u)}


@app.post("/api/auth/login")
def login(c: Cred, req: Request):
    name = c.username.strip().lower()
    with lock:
        u = db.execute("SELECT * FROM users WHERE username=?", (name,)).fetchone()
        if not u or not u["pw_hash"] or not hmac.compare_digest(hash_pw(c.password, u["pw_salt"])[0], u["pw_hash"]):
            raise HTTPException(401, "اسم المستخدم أو كلمة المرور غير صحيحة")
        g = current(req, create=False)
        if c.carry and g and g["guest"] and g["id"] != u["id"]:
            gd, _ = get_doc(g["id"])
            if gd:
                d, rev = get_doc(u["id"])
                put_doc(u["id"], prune(merge(d, gd)), rev + 1)
        tok = token_for(u["id"])
        db.commit()
    return {"token": tok, "user": pub(u)}


@app.post("/api/auth/logout")
def logout(req: Request):
    auth = req.headers.get("authorization", "")
    with lock:
        if auth.lower().startswith("bearer "):
            db.execute("DELETE FROM tokens WHERE token=?", (auth[7:].strip(),))
        ident = ident_of(req)
        uid = new_guest()
        if ident:
            db.execute("INSERT OR REPLACE INTO idents(ident,user_id) VALUES(?,?)", (ident, uid))
        db.commit()
    return {"ok": True}


@app.delete("/api/sync")
def wipe(req: Request):
    with lock:
        u = current(req)
        db.execute("DELETE FROM docs WHERE user_id=?", (u["id"],))
        db.commit()
    return {"ok": True}


class Feedback(BaseModel):
    name: str = Field("", max_length=60)
    email: str = Field("", max_length=120)
    topic: str = Field("other", max_length=30)
    subject: str = Field("", max_length=60)
    message: str = Field(..., min_length=3, max_length=4000)


@app.post("/api/feedback")
def feedback(body: Feedback, req: Request):
    with lock:
        u = current(req)
        cnt = db.execute("SELECT COUNT(*) n FROM feedback WHERE user_id=? AND created>?", (u["id"], int(time.time()) - 3600)).fetchone()["n"]
        if cnt >= 10:
            raise HTTPException(429, "أرسلت رسائل كثيرة خلال ساعة، جرّب لاحقاً")
        cur = db.execute(
            "INSERT INTO feedback(user_id,name,email,topic,subject,message,created) VALUES(?,?,?,?,?,?,?)",
            (u["id"], body.name.strip(), body.email.strip(), body.topic, body.subject.strip(), body.message.strip(), int(time.time())),
        )
        db.commit()
    return {"ok": True, "id": cur.lastrowid}


@app.get("/api/stats")
def stats():
    r = db.execute("SELECT COUNT(*) n, SUM(guest=0) acc FROM users").fetchone()
    return {"users": r["n"], "accounts": r["acc"] or 0}


# ---------------- المساعد الذكي والماسح (Claude API عبر الخادم؛ المفتاح لا يصل للمتصفح) ----------------
API_KEY = os.environ.get("ANTHROPIC_API_KEY", "").strip()
AI_MODEL = os.environ.get("JADWALI_MODEL", "claude-haiku-4-5-20251001")
_rate: Dict[str, list] = {}


def rate_ok(key: str, limit: int, per: int = 3600) -> bool:
    t = time.time()
    q = [x for x in _rate.get(key, []) if t - x < per]
    if len(q) >= limit:
        _rate[key] = q
        return False
    q.append(t)
    _rate[key] = q
    return True


def call_claude(system: str, content: Any, max_tokens: int = 700) -> str:
    body = json.dumps({"model": AI_MODEL, "max_tokens": max_tokens, "system": system,
                       "messages": [{"role": "user", "content": content}]}).encode()
    rq = urllib.request.Request("https://api.anthropic.com/v1/messages", data=body, method="POST", headers={
        "content-type": "application/json", "x-api-key": API_KEY, "anthropic-version": "2023-06-01"})
    try:
        with urllib.request.urlopen(rq, timeout=45) as r:
            data = json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        raise HTTPException(502, "تعذّر الاتصال بخدمة الذكاء الاصطناعي (%s)" % e.code)
    except Exception:
        raise HTTPException(502, "تعذّر الاتصال بخدمة الذكاء الاصطناعي")
    return "".join(b.get("text", "") for b in data.get("content", []) if b.get("type") == "text").strip()


class Ask(BaseModel):
    q: str = Field(min_length=1, max_length=600)
    ctx: str = Field(default="", max_length=6000)
    hist: list = Field(default_factory=list)


class Scan(BaseModel):
    image: str = Field(min_length=100, max_length=7_000_000)  # base64 بلا ترويسة
    mime: str = "image/jpeg"
    today: str = ""
    subjects: list = Field(default_factory=list)


@app.get("/api/ai/status")
def ai_status():
    return {"ai": bool(API_KEY), "model": AI_MODEL if API_KEY else ""}


@app.post("/api/ai/ask")
def ai_ask(body: Ask, req: Request):
    if not API_KEY:
        raise HTTPException(503, "المساعد الذكي غير مفعّل على هذا الخادم")
    with lock:
        u = current(req)
        db.commit()
    if not rate_ok("ask%d" % u["id"], 40):
        raise HTTPException(429, "وصلت للحد الأقصى من الأسئلة هذه الساعة، جرّب لاحقاً")
    system = ("أنت «مساعد جدولي»، مساعد دراسي ودود للطلاب في الأردن. أجب بالعربية (يُفضّل بلهجة بيضاء مبسّطة) بإيجاز ووضوح، "
              "في فقرات قصيرة أو نقاط بسيطة، مع الالتزام بالمنهاج الأردني حين يتعلق السؤال بالمواد. "
              "استخدم بيانات الطالب أدناه عند الحاجة ولا تخترع مواعيد أو علامات غير موجودة فيها. "
              "إن كان السؤال خارج الدراسة فأجب باختصار وأعد توجيهه بلطف للدراسة. لا تستخدم Markdown ثقيلاً.\n\nبيانات الطالب:\n" + body.ctx)
    msgs = []
    for h in body.hist[-6:]:
        if isinstance(h, dict) and h.get("r") in ("user", "assistant") and isinstance(h.get("t"), str):
            msgs.append({"role": h["r"], "content": h["t"][:600]})
    msgs.append({"role": "user", "content": body.q})
    bd = json.dumps({"model": AI_MODEL, "max_tokens": 600, "system": system, "messages": msgs}).encode()
    rq = urllib.request.Request("https://api.anthropic.com/v1/messages", data=bd, method="POST", headers={
        "content-type": "application/json", "x-api-key": API_KEY, "anthropic-version": "2023-06-01"})
    try:
        with urllib.request.urlopen(rq, timeout=45) as r:
            data = json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        raise HTTPException(502, "تعذّر الاتصال بخدمة الذكاء الاصطناعي (%s)" % e.code)
    except Exception:
        raise HTTPException(502, "تعذّر الاتصال بخدمة الذكاء الاصطناعي")
    txt = "".join(b.get("text", "") for b in data.get("content", []) if b.get("type") == "text").strip()
    return {"text": txt or "ما قدرت أجاوب هلق، جرّب صياغة ثانية."}


@app.post("/api/ai/scan")
def ai_scan(body: Scan, req: Request):
    if not API_KEY:
        raise HTTPException(503, "الماسح الذكي غير مفعّل على هذا الخادم")
    if body.mime not in ("image/jpeg", "image/png", "image/webp"):
        raise HTTPException(400, "صيغة الصورة غير مدعومة")
    with lock:
        u = current(req)
        db.commit()
    if not rate_ok("scan%d" % u["id"], 15):
        raise HTTPException(429, "وصلت للحد الأقصى من عمليات المسح هذه الساعة")
    subs = ", ".join(str(x)[:40] for x in body.subjects[:20])
    prompt = ("هذه صورة لواجب مدرسي أو سبورة أو دفتر أو ورقة مهام. استخرج منها المهام/الواجبات المطلوبة من الطالب. "
              "أعد JSON فقط بلا أي نص آخر ولا علامات ``` بالشكل: {\"tasks\":[{\"title\":\"...\",\"subject\":\"...\",\"due\":\"YYYY-MM-DD أو فارغ\"}]}. "
              "العنوان قصير وواضح بالعربية كما ورد. اختر subject من هذه القائمة إن تطابق وإلا اتركه فارغاً: [" + subs + "]. "
              "تاريخ اليوم " + (body.today or "غير معروف") + "؛ استنتج due من عبارات مثل «غداً» أو «الأحد» إن وُجدت. "
              "إن لم تجد مهاماً أعد {\"tasks\":[]}. لا تخترع مهاماً غير موجودة في الصورة.")
    content = [{"type": "image", "source": {"type": "base64", "media_type": body.mime, "data": body.image}},
               {"type": "text", "text": prompt}]
    out = call_claude("أنت أداة استخراج بيانات دقيقة تقرأ الخط العربي المطبوع واليدوي.", content, 900)
    m = re.search(r"\{.*\}", out, re.S)
    try:
        tasks = json.loads(m.group(0)).get("tasks", []) if m else []
    except Exception:
        tasks = []
    clean = []
    for t in tasks[:25]:
        if isinstance(t, dict) and isinstance(t.get("title"), str) and t["title"].strip():
            d = t.get("due") if isinstance(t.get("due"), str) and re.fullmatch(r"\d{4}-\d{2}-\d{2}", t.get("due", "")) else ""
            clean.append({"title": t["title"].strip()[:140], "subject": str(t.get("subject") or "")[:40], "due": d})
    return {"tasks": clean}


# ---------------- الأصدقاء ومقارنة التقدّم (أرقام مجمّعة فقط، لأصدقاء وافقوا) ----------------
class MyStats(BaseModel):
    week_min: int = Field(0, ge=0, le=10080)
    streak: int = Field(0, ge=0, le=5000)
    xp: int = Field(0, ge=0, le=10_000_000)
    lvl: int = Field(1, ge=1, le=200)


class FriendReq(BaseModel):
    username: str = Field(min_length=3, max_length=32)


def need_account(req: Request):
    u = current(req)
    if u["guest"]:
        raise HTTPException(403, "سجّل حساباً أولاً لاستخدام ميزة الأصدقاء")
    return u


@app.put("/api/friends/me")
def friends_me(body: MyStats, req: Request):
    with lock:
        u = need_account(req)
        db.execute("INSERT INTO user_stats(user_id,week_min,streak,xp,lvl,updated) VALUES(?,?,?,?,?,?) "
                   "ON CONFLICT(user_id) DO UPDATE SET week_min=excluded.week_min,streak=excluded.streak,xp=excluded.xp,lvl=excluded.lvl,updated=excluded.updated",
                   (u["id"], body.week_min, body.streak, body.xp, body.lvl, now()))
        db.commit()
    return {"ok": True}


@app.get("/api/friends")
def friends_list(req: Request):
    with lock:
        u = need_account(req)
        me = u["id"]
        rows = db.execute("SELECT * FROM friends WHERE a=? OR b=?", (me, me)).fetchall()
        out = {"friends": [], "incoming": [], "outgoing": []}
        for r in rows:
            other = r["b"] if r["a"] == me else r["a"]
            o = db.execute("SELECT id,username,name FROM users WHERE id=?", (other,)).fetchone()
            if not o:
                continue
            base = {"id": o["id"], "username": o["username"], "name": o["name"] or o["username"]}
            if r["status"] == "ok":
                st = db.execute("SELECT week_min,streak,xp,lvl,updated FROM user_stats WHERE user_id=?", (other,)).fetchone()
                base.update({"week_min": st["week_min"], "streak": st["streak"], "xp": st["xp"], "lvl": st["lvl"], "updated": st["updated"]} if st else {"week_min": 0, "streak": 0, "xp": 0, "lvl": 1, "updated": 0})
                out["friends"].append(base)
            elif r["a"] == me:
                out["outgoing"].append(base)
            else:
                out["incoming"].append(base)
    return out


@app.post("/api/friends/request")
def friends_request(body: FriendReq, req: Request):
    name = body.username.strip().lower()
    with lock:
        u = need_account(req)
        if not rate_ok("frq%d" % u["id"], 20):
            raise HTTPException(429, "طلبات كثيرة، جرّب لاحقاً")
        o = db.execute("SELECT id FROM users WHERE username=? AND guest=0", (name,)).fetchone()
        if not o or o["id"] == u["id"]:
            raise HTTPException(404, "ما لقينا مستخدماً بهذا الاسم")
        ex = db.execute("SELECT * FROM friends WHERE (a=? AND b=?) OR (a=? AND b=?)", (u["id"], o["id"], o["id"], u["id"])).fetchone()
        if ex:
            if ex["status"] == "pending" and ex["a"] == o["id"]:
                db.execute("UPDATE friends SET status='ok' WHERE a=? AND b=?", (ex["a"], ex["b"]))
                db.commit()
                return {"ok": True, "accepted": True}
            raise HTTPException(409, "أنتما أصدقاء بالفعل أو الطلب مُرسل مسبقاً")
        db.execute("INSERT INTO friends(a,b,status,created) VALUES(?,?,'pending',?)", (u["id"], o["id"], now()))
        db.commit()
    return {"ok": True}


@app.post("/api/friends/accept/{fid}")
def friends_accept(fid: int, req: Request):
    with lock:
        u = need_account(req)
        r = db.execute("UPDATE friends SET status='ok' WHERE a=? AND b=? AND status='pending'", (fid, u["id"]))
        db.commit()
        if not r.rowcount:
            raise HTTPException(404, "الطلب غير موجود")
    return {"ok": True}


@app.delete("/api/friends/{fid}")
def friends_remove(fid: int, req: Request):
    with lock:
        u = need_account(req)
        db.execute("DELETE FROM friends WHERE (a=? AND b=?) OR (a=? AND b=?)", (u["id"], fid, fid, u["id"]))
        db.commit()
    return {"ok": True}


# ---------------- الملفات الثابتة ----------------
@app.get("/")
def index():
    return FileResponse(PUBLIC / "index.html")


app.mount("/", StaticFiles(directory=str(PUBLIC), html=True), name="static")

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", 8000)))
