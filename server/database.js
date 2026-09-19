import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const file = process.env.DATABASE_PATH || resolve(root, 'data/agrihub.db');
mkdirSync(dirname(file), { recursive: true });
export const db = new DatabaseSync(file);
db.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;');
db.exec(`
CREATE TABLE IF NOT EXISTS units(id TEXT PRIMARY KEY,name TEXT NOT NULL,timezone TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,unit_id TEXT NOT NULL,role TEXT NOT NULL,name TEXT NOT NULL,code TEXT UNIQUE NOT NULL);
CREATE TABLE IF NOT EXISTS sectors(id TEXT PRIMARY KEY,unit_id TEXT NOT NULL,name TEXT NOT NULL,category TEXT NOT NULL DEFAULT 'FRIA',active INTEGER DEFAULT 1,UNIQUE(unit_id,name));
CREATE TABLE IF NOT EXISTS user_sectors(user_id TEXT NOT NULL,sector_id TEXT NOT NULL,PRIMARY KEY(user_id,sector_id));
CREATE TABLE IF NOT EXISTS shifts(id TEXT PRIMARY KEY,unit_id TEXT NOT NULL,name TEXT NOT NULL,start_time TEXT NOT NULL,end_time TEXT NOT NULL,UNIQUE(unit_id,name));
CREATE TABLE IF NOT EXISTS totens(id TEXT PRIMARY KEY,unit_id TEXT NOT NULL,name TEXT NOT NULL,credential TEXT UNIQUE NOT NULL,active INTEGER DEFAULT 1);
CREATE TABLE IF NOT EXISTS responses(id TEXT PRIMARY KEY,unit_id TEXT NOT NULL,sector_id TEXT NOT NULL,shift_id TEXT NOT NULL,response_date TEXT NOT NULL,metric TEXT NOT NULL,score INTEGER NOT NULL,quantity INTEGER NOT NULL DEFAULT 1,UNIQUE(unit_id,sector_id,shift_id,response_date,metric,score));
CREATE TABLE IF NOT EXISTS hr_indicators(id TEXT PRIMARY KEY,unit_id TEXT NOT NULL,sector_id TEXT NOT NULL,shift_id TEXT NOT NULL,period TEXT NOT NULL,overtime REAL NOT NULL,absences INTEGER NOT NULL,leaves INTEGER NOT NULL,leave_reason TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_responses_scope ON responses(unit_id,sector_id,shift_id,response_date);
CREATE INDEX IF NOT EXISTS idx_hr_scope ON hr_indicators(unit_id,sector_id,shift_id,period);
`);
const sectorColumns=db.prepare('PRAGMA table_info(sectors)').all();
if(!sectorColumns.some(column=>column.name==='category')) db.exec("ALTER TABLE sectors ADD COLUMN category TEXT NOT NULL DEFAULT 'FRIA'");
if (!db.prepare('SELECT id FROM units LIMIT 1').get()) {
  db.prepare('INSERT INTO units VALUES(?,?,?)').run('u1','Frigorífico Vale Verde','America/Cuiaba');
  db.prepare('INSERT INTO users VALUES(?,?,?,?,?)').run('sup1','u1','SUPERVISOR','Marina Alves','SUPERVISOR');
  db.prepare('INSERT INTO users VALUES(?,?,?,?,?)').run('rh1','u1','RH','Equipe de RH','RH2026');
  const sectors=[['s1','Desossa','FRIA'],['s2','Embalagem secundária','FRIA'],['s3','Abate primeira fase','QUENTE'],['s4','Expedição caixaria','FRIA'],['s5','Abate segunda fase','QUENTE'],['s6','Miúdos','QUENTE'],['s7','Bucharia limpa','QUENTE'],['s8','Bucharia suja','QUENTE'],['s9','Gracharia','QUENTE'],['s10','Expedição com osso','FRIA']];
  const shifts=[['t1','Manhã','06:00','14:20'],['t2','Tarde','14:20','22:35'],['t3','Noite','22:35','06:00']];
  for(const [id,name,category] of sectors){db.prepare('INSERT INTO sectors(id,unit_id,name,category) VALUES(?,?,?,?)').run(id,'u1',name,category);db.prepare('INSERT INTO user_sectors VALUES(?,?)').run('sup1',id)}
  for(const row of shifts) db.prepare('INSERT INTO shifts VALUES(?,?,?,?,?)').run(row[0],'u1',row[1],row[2],row[3]);
  db.prepare('INSERT INTO totens VALUES(?,?,?,?,1)').run('tot1','u1','Entrada principal','TOTEM-01');
  const ins=db.prepare('INSERT INTO responses VALUES(?,?,?,?,?,?,?,?)');
  const ihr=db.prepare('INSERT INTO hr_indicators VALUES(?,?,?,?,?,?,?,?,?,?)');
  const today=new Date();
  for(let d=34;d>=0;d--){const dt=new Date(today);dt.setDate(today.getDate()-d);if([0,6].includes(dt.getDay()))continue;const date=dt.toISOString().slice(0,10);for(let si=0;si<sectors.length;si++){for(const metric of ['ENERGY','PHYSICAL','STRESS']){const base=metric==='ENERGY'?3.9-si*.12:2.0+si*.14;for(let score=1;score<=5;score++){const qty=Math.max(0,Math.round(8-Math.abs(score-(base+Math.sin(d/4)*.25))*3));if(qty)ins.run(randomUUID(),'u1',sectors[si][0],shifts[d%2][0],date,metric,score,qty)}}}}
  for(let w=4;w>=0;w--){const dt=new Date(today);dt.setDate(today.getDate()-w*7);const period=dt.toISOString().slice(0,10);for(let si=0;si<sectors.length;si++)ihr.run(randomUUID(),'u1',sectors[si][0],'t1',period,18+si*5+w,2+si,si%3,['MUSCULOESQUELÉTICO','RESPIRATÓRIO','OUTROS'][si%3],new Date().toISOString())}
}
if(db.prepare("SELECT COUNT(*) total FROM sectors WHERE unit_id='u1'").get().total<10){
  db.prepare("UPDATE sectors SET name='Desossa',category='FRIA' WHERE id='s1'").run();
  db.prepare("UPDATE sectors SET name='Embalagem secundária',category='FRIA' WHERE id='s2'").run();
  db.prepare("UPDATE sectors SET name='Abate primeira fase',category='QUENTE' WHERE id='s3'").run();
  db.prepare("UPDATE sectors SET name='Expedição caixaria',category='FRIA' WHERE id='s4'").run();
  const extras=[['s5','Abate segunda fase','QUENTE'],['s6','Miúdos','QUENTE'],['s7','Bucharia limpa','QUENTE'],['s8','Bucharia suja','QUENTE'],['s9','Gracharia','QUENTE'],['s10','Expedição com osso','FRIA']];
  for(const [id,name,category] of extras){db.prepare('INSERT OR IGNORE INTO sectors(id,unit_id,name,category) VALUES(?,?,?,?)').run(id,'u1',name,category);db.prepare('INSERT OR IGNORE INTO user_sectors VALUES(?,?)').run('sup1',id)}
}
if(db.prepare("SELECT COUNT(*) total FROM responses WHERE sector_id='s5'").get().total===0){
  const insertDemo=db.prepare('INSERT OR IGNORE INTO responses VALUES(?,?,?,?,?,?,?,?)');
  const today=new Date();
  for(let d=34;d>=0;d--){const dt=new Date(today);dt.setDate(today.getDate()-d);if([0,6].includes(dt.getDay()))continue;const date=dt.toISOString().slice(0,10);for(let si=4;si<10;si++){for(const metric of ['ENERGY','PHYSICAL','STRESS']){const base=metric==='ENERGY'?3.75-(si-4)*.05:2.1+(si-4)*.08;for(let score=1;score<=5;score++){const quantity=Math.max(0,Math.round(7-Math.abs(score-(base+Math.sin(d/5)*.2))*3));if(quantity)insertDemo.run(randomUUID(),'u1',`s${si+1}`,d%2?'t1':'t2',date,metric,score,quantity)}}}}
}
export function dateKey(date=new Date()){return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Cuiaba',year:'numeric',month:'2-digit',day:'2-digit'}).format(date)}
export function currentShift(unitId){const now=new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Cuiaba',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date());const shifts=db.prepare('SELECT id,name,start_time,end_time FROM shifts WHERE unit_id=?').all(unitId);return shifts.find(s=>s.start_time<s.end_time?(now>=s.start_time&&now<s.end_time):(now>=s.start_time||now<s.end_time))||shifts[0]}
