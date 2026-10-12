import html
W,H=1400,900
out=[]
def esc(s): return html.escape(s)
S={
 'trigger':('#fbf0dc','#a15c07'),'input':('#e8f0fe','#1d4ed8'),'context':('#ffffff','#18212f'),
 'proc':('#eef1f6','#5b6577'),'ai':('#efe8fb','#6d3fc0'),'out':('#ffffff','#18212f'),
 'human':('#e3f4ec','#0f7b54'),'error':('#fdecea','#b42318'),'synthetic':('#fff1e6','#9a3412'),'off':('#f4f4f5','#8a909c'),
}
def box(x,y,w,h,kind,lines,dashed=False,bold_first=True,sw=1.5):
    f,s=S[kind]
    da=' stroke-dasharray="6 4"' if dashed else ''
    out.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="8" fill="{f}" stroke="{s}" stroke-width="{sw}"{da}/>')
    ty=y+18
    for i,l in enumerate(lines):
        weight='700' if (i==0 and bold_first) else '400'
        size=12.5 if i==0 else 11
        col='#18212f' if i==0 else '#3d4757'
        out.append(f'<text x="{x+10}" y="{ty}" font-size="{size}" font-weight="{weight}" fill="{col}">{esc(l)}</text>')
        ty+=15 if i==0 else 14
def path(d,color='#18212f',dash=False,label=None,lx=0,ly=0,w=1.6,head=True):
    da=' stroke-dasharray="5 4"' if dash else ''
    mk={ '#18212f':'a-dark','#1d4ed8':'a-blue','#b42318':'a-red','#0f7b54':'a-green','#6d3fc0':'a-purple','#9a3412':'a-orange'}[color]
    m=f' marker-end="url(#{mk})"' if head else ''
    out.append(f'<path d="{d}" fill="none" stroke="{color}" stroke-width="{w}"{da}{m}/>')
    if label:
        out.append(f'<text x="{lx}" y="{ly}" font-size="10.5" fill="{color}" font-style="italic">{esc(label)}</text>')

out.append(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" font-family="Inter, Helvetica, Arial, sans-serif">')
out.append('<defs>'+''.join(f'<marker id="{i}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="{c}"/></marker>' for i,c in [('a-dark','#18212f'),('a-blue','#1d4ed8'),('a-red','#b42318'),('a-green','#0f7b54'),('a-purple','#6d3fc0'),('a-orange','#9a3412')])+'</defs>')
out.append(f'<rect width="{W}" height="{H}" fill="#fbfaf7"/>')
lanes=[(10,200,'1 · TRIGGER'),(220,210,'2 · INPUT'),(440,215,'3 · CONTEXT'),(665,255,'4 · PROCESSING (code)'),(930,215,'5 · AI (Gemini Flash)'),(1155,235,'6 · OUTPUT')]
for x,w,t in lanes:
    out.append(f'<rect x="{x}" y="40" width="{w}" height="782" rx="10" fill="#f1efe9" opacity="0.6"/>')
    out.append(f'<text x="{x+w/2}" y="58" font-size="13" font-weight="700" fill="#18212f" text-anchor="middle" letter-spacing="1">{t}</text>')
out.append('<text x="20" y="27" font-size="20" font-weight="700" fill="#18212f">CSR Partnership Radar — Components Map (as implemented)</text>')
out.append('<text x="1380" y="27" font-size="12" fill="#5b6577" text-anchor="end">Next.js 16 on Vercel · Neon Postgres · Gemini Flash (gemini-3.8-flash)</text>')

# Triggers
box(20,150,180,78,'trigger',['Vercel Cron','Mon 00:30 UTC = 06:00 IST','GET /api/cron/weekly-digest','Bearer CRON_SECRET'])
box(20,250,180,66,'trigger',['Ananya: Refresh','POST /api/refresh','same-origin only · 2-min cooldown'])
box(20,340,180,92,'trigger',['Mac collector (launchd)','Mon 05:15 + daily 09:00 IST','sources that block Vercel IPs','scripts/collect-local.ts --prod'])
box(20,700,180,66,'trigger',['Ananya: Generate digest','POST /api/digest/generate','same-origin only · 20-s cooldown'])
# Inputs
box(230,160,190,70,'input',['CSR specialist RSS','India CSR ×4 · CSR Journal ×4','CSR Universe · CSR Mandate'])
box(230,240,190,56,'input',['Business & regulatory RSS','ET · Mint · TaxGuru (MCA)'])
box(230,306,190,56,'input',['Official corporate RSS','HCLTech newsroom'])
box(230,372,190,70,'input',['Partner-call feeds','NGOportal ×2 (Vercel)','NGOBox · FundsForNGOs (Mac)'])
box(230,452,190,56,'input',['News index API (via Mac)','GDELT DOC 2.0'])
box(230,518,190,74,'off',['Not fetched (recorded)','PIB · MCA · CSR portal: 403','Google News · BusinessLine:','robots.txt'],dashed=True)
# Context
box(450,68,195,62,'context',['Source registry','data/sources.json → sources','enabled · limits · last error'])
box(450,230,195,70,'context',["Ananya's settings",'sectors · geographies · weights','window · thresholds','(user_settings, validated)'])
box(450,360,195,140,'context',['Neon Postgres','announcements','announcement_sources','evidence_claims','opportunity_scores · reviews','digests · digest_items','fetch_runs · audit_events'])
box(450,560,150,62,'synthetic',['Synthetic seed','31 labelled records','demo mode only'],dashed=True)
# Processing
P=[('Fetch adapters','rss.ts · gdelt.ts · 12s timeout','per-source failure isolation'),
   ('Normalise & validate','HTML→text · canonical URL','publication-date provenance'),
   ('Relevance pre-filter','sector keywords from settings','30-day lookback'),
   ('Dedup layers 1–2','canonical URL · headline','similarity ±3 days'),
   ('Excerpt verification','every "fact" must be quoted','verbatim from source text'),
   ('Dedup layer 3 (merge)','same company · date ±4 days','· initiative / headline overlap'),
   ('Window + scoring','7-day IST window · 100-pt score','priority · confidence'),
   ('Digest builder','sections · no padding','idempotent key live:<IST date>')]
for i,(a,b,c) in enumerate(P):
    box(675,150+80*i,235,62,'proc',[f'{i+1}. {a}',b,c])
# AI
box(940,380,195,96,'ai',['Gemini Flash','Classify & extract','structured JSON → zod check','bounded retries · timeouts','article = untrusted data'],sw=2)
box(940,700,195,78,'ai',['Gemini Flash','Digest overview','validated items only','fallback: code summary'],sw=2)
# Output
box(1165,150,215,78,'error',['Source health & errors','per-source last_error','fetch_runs · audit_events','shown on dashboard + digest'])
box(1165,300,215,70,'out',['Ranked dashboard + detail','score breakdown · evidence','links · filters · live/demo'])
box(1165,400,215,96,'human',['HUMAN DECISION GATE','AI recommends, Ananya decides','contact · monitor · research','not relevant · contacted','discussion · won/closed'],sw=3)
box(1165,640,215,70,'out',['Weekly digest','digests + digest_items','in-app · print / PDF · email'])
box(1165,740,215,56,'out',['Email via Resend','once per digest (atomic claim)'])

D='#18212f'
# triggers -> P1 (fetch)
path('M200,189 H212 V141 H792 V148',D,label='start refresh run',lx=440,ly=136)
path('M200,283 H212 V189',D,head=False)
path('M200,386 H212 V283',D,head=False)
# cron + manual -> digest builder
path('M200,215 H224 V741 H673',D,label='generate digest',lx=440,ly=736)
path('M200,733 H224',D,head=False)
# inputs -> P1
for y in (195,268,334,407,480): path(f'M420,{y} H436',D,head=False)
path('M436,480 V181 H673',D,label='RSS / HTML / JSON over HTTPS',lx=452,ly=176)
# registry -> P1
path('M645,101 H660 V165 H673','#1d4ed8',dash=True,label='enabled sources',lx=560,ly=150)
# chain
for i in range(3): path(f'M792,{212+80*i} V{228+80*i}',D)
path('M910,421 H938','#6d3fc0',label='',lx=0,ly=0)
path('M940,460 H925 V501 H912','#6d3fc0')
for i in (4,5): path(f'M792,{212+80*i} V{228+80*i}',D)
path('M792,692 V708',D)
out.append('<text x="800" y="703" font-size="10.5" fill="#18212f" font-style="italic">scored set</text>')
# store / persist
path('M675,421 H647',D,label='store',lx=648,ly=414)
path('M675,661 H667 V478 H647',D,label='persist analysis, claims, scores',lx=470,ly=530)
# settings
path('M645,265 H655 V341 H673','#1d4ed8',dash=True,label='config',lx=612,ly=325)
path('M655,341 V650 H673','#1d4ed8',dash=True,head=True)
out.append('<text x="460" y="314" font-size="10" fill="#1d4ed8">also feeds Gemini prompt (sector keys)</text>')
# seed
path('M525,560 V502','#9a3412',dash=True,label='npm run db:seed',lx=530,ly=548)
# P7 -> dashboard
path('M910,645 H1156 V335 H1163',D,label='ranked opportunities',lx=950,ly=640)
# AI2
path('M910,741 H938','#6d3fc0')
path('M1135,739 H1146 V675 H1163','#6d3fc0')
# dashboard -> human gate
path('M1272,370 V398','#0f7b54',w=2.2)
# digest -> email
path('M1272,710 V738',D)
# human -> db
path('M1380,448 H1392 V815 H625 V502','#0f7b54',w=2.2,label='decision + note stored (append-only; never overwritten by reprocessing)',lx=700,ly=810)
# errors
path('M910,170 H1163','#b42318',dash=True,label='fetch / AI failures recorded',lx=950,ly=164)
# legend
ly=845
out.append(f'<text x="20" y="{ly}" font-size="12" font-weight="700" fill="#18212f">Legend</text>')
items=[('line',D,False,'data flow'),('line','#1d4ed8',True,'configuration / context'),('line','#b42318',True,'error path'),('line','#0f7b54',False,'human decision'),
       ('box','proc','deterministic code'),('box','ai','Gemini Flash (only AI)'),('box','human','human gate'),('box','off','not fetched (dashed)'),('box','synthetic','synthetic demo data')]
x=70
for it in items:
    if it[0]=='line':
        _,c,dash,t=it; da=' stroke-dasharray="5 4"' if dash else ''
        out.append(f'<line x1="{x}" y1="{ly-4}" x2="{x+28}" y2="{ly-4}" stroke="{c}" stroke-width="2"{da}/>')
        out.append(f'<text x="{x+34}" y="{ly}" font-size="11" fill="#3d4757">{t}</text>'); x+=34+len(t)*5.6+12
    else:
        _,k,t=it; f,s=S[k]
        out.append(f'<rect x="{x}" y="{ly-12}" width="18" height="12" rx="3" fill="{f}" stroke="{s}"/>')
        out.append(f'<text x="{x+24}" y="{ly}" font-size="11" fill="#3d4757">{t}</text>'); x+=24+len(t)*5.6+12
out.append(f'<text x="20" y="{ly+28}" font-size="11" fill="#5b6577">Every box maps to code in github.com/AyushSarkar07/csr-partnership-radar (see docs/COMPONENTS_MAP.md for file paths). AI is used only in column 5; dates, dedup, filtering and scoring are deterministic code.</text>')
out.append('</svg>')
open(__import__('os').path.join(__import__('os').path.dirname(__file__), '..', 'docs', 'components-map.svg'),'w').write('\n'.join(out))
print('ok')
