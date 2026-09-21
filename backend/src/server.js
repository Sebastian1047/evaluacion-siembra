const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { sql, getPool } = require('./db');

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : true }));
app.use(express.json());

async function ensureParticipationIntervals(pool){
  const r=await pool.request().query(`SELECT CASE WHEN OBJECT_ID('dbo.TramoParticipacion','U') IS NULL THEN 0 ELSE 1 END AS existe`);
  if(!r.recordset[0]?.existe) throw new Error('Falta la migración dbo.TramoParticipacion');
}

app.get('/api/health', async (_req,res,next)=>{ try { const pool=await getPool(); await pool.request().query('SELECT 1 AS ok'); res.json({ok:true,database:true}); } catch(e){next(e);} });
app.get('/api/items', async (_req,res,next)=>{try{const p=await getPool();const r=await p.request().query('SELECT IdItem AS id, Codigo AS codigo, Nombre AS nombre, EsCritico AS esCritico, Activo AS activo FROM dbo.ItemEvaluacion WHERE Activo=1 ORDER BY Orden,IdItem');res.json(r.recordset);}catch(e){next(e);}});
app.get('/api/semanas-reportables', async(_req,res,next)=>{try{
  const p=await getPool();
  const r=await p.request().query(`
    SELECT s.IdSemana,s.AnioEvaluacion,s.NumeroSemana,s.FechaInicio,s.FechaFin,s.Estado,s.FechaCierre
    FROM dbo.SemanaEvaluacion s
    WHERE s.Estado='CERRADA'
      AND EXISTS(
        SELECT 1
        FROM dbo.ParticipacionSemanal ps
        JOIN dbo.ResolucionTurno rt ON rt.IdParticipacion=ps.IdParticipacion AND rt.Tipo='EVALUACION'
        JOIN dbo.Evaluacion e ON e.IdResolucion=rt.IdResolucion
        WHERE ps.IdSemana=s.IdSemana
      )
    ORDER BY s.AnioEvaluacion DESC,s.NumeroSemana DESC,s.IdSemana DESC
  `);
  res.json(r.recordset);
}catch(e){next(e);}});
app.get('/api/semanas/ultima', async(_req,res,next)=>{try{const p=await getPool();const r=await p.request().query(`SELECT TOP (1) * FROM dbo.SemanaEvaluacion ORDER BY AnioEvaluacion DESC, NumeroSemana DESC, IdSemana DESC`);if(!r.recordset[0])return res.status(404).json({error:'No hay semanas registradas'});res.json(r.recordset[0]);}catch(e){next(e);}});
app.get('/api/semanas/:anio(\\d+)/:numero(\\d+)', async(req,res,next)=>{try{const p=await getPool();const r=await p.request().input('anio',sql.SmallInt,req.params.anio).input('numero',sql.TinyInt,req.params.numero).query('SELECT * FROM dbo.SemanaEvaluacion WHERE AnioEvaluacion=@anio AND NumeroSemana=@numero');if(!r.recordset[0])return res.status(404).json({error:'Semana no encontrada'});res.json(r.recordset[0]);}catch(e){next(e);}});
app.post('/api/semanas/asegurar', async(req,res,next)=>{try{const {anio,numero,inicio,fin}=req.body;const p=await getPool();const r=await p.request().input('anio',sql.SmallInt,anio).input('numero',sql.TinyInt,numero).input('inicio',sql.Date,inicio).input('fin',sql.Date,fin).query(`IF NOT EXISTS(SELECT 1 FROM dbo.SemanaEvaluacion WHERE AnioEvaluacion=@anio AND NumeroSemana=@numero) INSERT dbo.SemanaEvaluacion(AnioEvaluacion,NumeroSemana,FechaInicio,FechaFin,Estado) VALUES(@anio,@numero,@inicio,@fin,'ABIERTA'); SELECT * FROM dbo.SemanaEvaluacion WHERE AnioEvaluacion=@anio AND NumeroSemana=@numero;`);res.status(201).json(r.recordset[0]);}catch(e){next(e);}});
app.get('/api/semanas/:semanaId/participantes',async(req,res,next)=>{try{const p=await getPool();const r=await p.request().input('id',sql.Int,req.params.semanaId).query('SELECT * FROM dbo.ParticipacionSemanal WHERE IdSemana=@id ORDER BY IdParticipacion');res.json(r.recordset);}catch(e){next(e);}});
app.patch('/api/semanas/:semanaId/cerrar',async(req,res,next)=>{try{
  const {usuarioCorporativoId=null}=req.body||{};
  const p=await getPool();
  const r=await p.request()
    .input('id',sql.Int,req.params.semanaId)
    .input('usuarioCorporativoId',sql.NVarChar(100),usuarioCorporativoId)
    .query(`
UPDATE dbo.SemanaEvaluacion
SET Estado='CERRADA',
    FechaCierre=SYSDATETIME(),
    UsuarioCierreCorporativoId=@usuarioCorporativoId
OUTPUT INSERTED.*
WHERE IdSemana=@id AND Estado='ABIERTA';`);
  if(r.recordset[0])return res.json(r.recordset[0]);
  const existing=await p.request().input('id2',sql.Int,req.params.semanaId).query('SELECT * FROM dbo.SemanaEvaluacion WHERE IdSemana=@id2');
  if(!existing.recordset[0])return res.status(404).json({error:'Semana no encontrada'});
  if(existing.recordset[0].Estado==='CERRADA')return res.json(existing.recordset[0]);
  return res.status(409).json({error:'La semana no está en estado ABIERTA'});
}catch(e){next(e);}});

app.get('/api/semanas/:semanaId/estado-operativo',async(req,res,next)=>{try{const p=await getPool();await ensureParticipationIntervals(p);const r=await p.request().input('id',sql.Int,req.params.semanaId).query(`
SELECT p.IdParticipacion,p.SembradorCorporativoId,p.TurnoInicio,p.Estado,
  (SELECT MAX(t.TurnoInicio) FROM dbo.TramoParticipacion t WHERE t.IdParticipacion=p.IdParticipacion) AS UltimoTurnoIncorporacion,
  r.IdResolucion,r.NumeroTurno,r.Tipo,r.ResueltoEn,e.IdEvaluacion,i.Codigo AS CodigoItem
FROM dbo.ParticipacionSemanal p
LEFT JOIN dbo.ResolucionTurno r ON r.IdParticipacion=p.IdParticipacion
LEFT JOIN dbo.Evaluacion e ON e.IdResolucion=r.IdResolucion
LEFT JOIN dbo.Incumplimiento inc ON inc.IdEvaluacion=e.IdEvaluacion
LEFT JOIN dbo.ItemEvaluacion i ON i.IdItem=inc.IdItem
WHERE p.IdSemana=@id
ORDER BY p.IdParticipacion,r.NumeroTurno,i.Orden,i.IdItem`);res.json(r.recordset);}catch(e){next(e);}});
app.post('/api/semanas/:semanaId/participantes',async(req,res,next)=>{try{const {sembradorId,turnoInicio}=req.body;const p=await getPool();await ensureParticipationIntervals(p);const tx=new sql.Transaction(p);await tx.begin();try{const r=await new sql.Request(tx).input('sem',sql.Int,req.params.semanaId).input('sid',sql.NVarChar(100),sembradorId).input('turno',sql.SmallInt,turnoInicio).query(`INSERT dbo.ParticipacionSemanal(IdSemana,SembradorCorporativoId,TurnoInicio,Estado) OUTPUT INSERTED.* VALUES(@sem,@sid,@turno,'EN_LA_SEMANA')`);const row=r.recordset[0];await new sql.Request(tx).input('pid',sql.Int,row.IdParticipacion).input('turno',sql.SmallInt,turnoInicio).query('INSERT dbo.TramoParticipacion(IdParticipacion,TurnoInicio) VALUES(@pid,@turno)');await tx.commit();res.status(201).json(row);}catch(e){await tx.rollback();throw e;}}catch(e){next(e);}});
app.patch('/api/participaciones/:id/estado',async(req,res,next)=>{try{
  const estadosPermitidos=['EN_LA_SEMANA','QUITADO_TEMPORALMENTE'];
  const estado=String(req.body?.estado||'').trim().toUpperCase();
  const turnoOperativo=Number(req.body?.turnoOperativo)||0;
  if(!estadosPermitidos.includes(estado))return res.status(400).json({error:'Estado de participación no válido'});
  if(turnoOperativo<1)return res.status(400).json({error:'turnoOperativo es obligatorio'});
  const p=await getPool();await ensureParticipationIntervals(p);const tx=new sql.Transaction(p);await tx.begin();
  try{
    const current=await new sql.Request(tx).input('id',sql.Int,req.params.id).query('SELECT * FROM dbo.ParticipacionSemanal WHERE IdParticipacion=@id');
    const participant=current.recordset[0];if(!participant){await tx.rollback();return res.status(404).json({error:'Participación no encontrada'});}
    if(estado==='QUITADO_TEMPORALMENTE'){
      const open=await new sql.Request(tx).input('id',sql.Int,req.params.id).query('SELECT TOP(1) IdTramo,TurnoInicio FROM dbo.TramoParticipacion WHERE IdParticipacion=@id AND TurnoFin IS NULL ORDER BY IdTramo DESC');
      const tramo=open.recordset[0];
      if(tramo){
        const ultimoTurnoParticipado=turnoOperativo-1;
        if(ultimoTurnoParticipado<Number(tramo.TurnoInicio)){
          // Salió antes de resolver el turno en que se reincorporó: el tramo vacío no representa participación real.
          await new sql.Request(tx).input('tramo',sql.BigInt,tramo.IdTramo).query('DELETE dbo.TramoParticipacion WHERE IdTramo=@tramo');
        }else{
          await new sql.Request(tx).input('tramo',sql.BigInt,tramo.IdTramo).input('fin',sql.SmallInt,ultimoTurnoParticipado).query('UPDATE dbo.TramoParticipacion SET TurnoFin=@fin WHERE IdTramo=@tramo');
        }
      }
    }else if(participant.Estado==='QUITADO_TEMPORALMENTE'){
      await new sql.Request(tx).input('id',sql.Int,req.params.id).input('inicio',sql.SmallInt,turnoOperativo).query('INSERT dbo.TramoParticipacion(IdParticipacion,TurnoInicio) VALUES(@id,@inicio)');
    }
    const r=await new sql.Request(tx).input('id2',sql.Int,req.params.id).input('estado',sql.VarChar(30),estado).query('UPDATE dbo.ParticipacionSemanal SET Estado=@estado OUTPUT INSERTED.* WHERE IdParticipacion=@id2');
    await tx.commit();res.json({...r.recordset[0],TurnoReincorporacion:estado==='EN_LA_SEMANA'?turnoOperativo:null});
  }catch(e){try{await tx.rollback();}catch{}throw e;}
}catch(e){next(e);}});
app.post('/api/participaciones/:id/turnos/:turno/resolver',async(req,res,next)=>{const pool=await getPool();const tx=new sql.Transaction(pool);try{await tx.begin();const {tipo,incumplimientos=[],usuarioCorporativoId}=req.body;const request=new sql.Request(tx);const rr=await request.input('pid',sql.Int,req.params.id).input('turno',sql.SmallInt,req.params.turno).input('tipo',sql.VarChar(20),tipo).input('uid',sql.NVarChar(100),usuarioCorporativoId).query(`INSERT dbo.ResolucionTurno(IdParticipacion,NumeroTurno,Tipo,UsuarioCorporativoId) OUTPUT INSERTED.IdResolucion VALUES(@pid,@turno,@tipo,@uid)`);const idResolucion=rr.recordset[0].IdResolucion;if(tipo==='EVALUACION'){const er=await new sql.Request(tx).input('rid',sql.BigInt,idResolucion).input('uid2',sql.NVarChar(100),usuarioCorporativoId).query(`INSERT dbo.Evaluacion(IdResolucion,UsuarioCorporativoId) OUTPUT INSERTED.IdEvaluacion VALUES(@rid,@uid2)`);const eid=er.recordset[0].IdEvaluacion;for(const itemId of [...new Set(incumplimientos)]) await new sql.Request(tx).input('eid',sql.BigInt,eid).input('iid',sql.Int,itemId).query('INSERT dbo.Incumplimiento(IdEvaluacion,IdItem) VALUES(@eid,@iid)');}await tx.commit();res.status(201).json({ok:true,idResolucion});}catch(e){try{await tx.rollback();}catch{}next(e);}});
// Auditoría real de correcciones para el Historial del Analista.
app.get('/api/auditoria-correcciones',async(req,res,next)=>{try{
  const pool=await getPool();
  const q=await pool.request().query(`
    SELECT ac.IdAuditoria,ac.IdEvaluacion,ac.UsuarioCorporativoId,ac.CorregidoEn,ac.EstadoAntes,ac.EstadoDespues,ac.IdAutorizacion,
           rt.NumeroTurno,ps.SembradorCorporativoId,se.AnioEvaluacion,se.NumeroSemana
    FROM dbo.AuditoriaCorreccion ac
    JOIN dbo.Evaluacion e ON e.IdEvaluacion=ac.IdEvaluacion
    JOIN dbo.ResolucionTurno rt ON rt.IdResolucion=e.IdResolucion
    JOIN dbo.ParticipacionSemanal ps ON ps.IdParticipacion=rt.IdParticipacion
    JOIN dbo.SemanaEvaluacion se ON se.IdSemana=ps.IdSemana
    ORDER BY ac.CorregidoEn DESC,ac.IdAuditoria DESC`);
  res.json(q.recordset);
}catch(e){next(e)}});

// Autorizaciones de corrección persistidas en Azure SQL.
// Se consultan por semana para que Analista y Asegurador compartan el mismo estado.
app.get('/api/semanas/:semanaId/autorizaciones-correccion',async(req,res,next)=>{try{
  const p=await getPool();
  const r=await p.request().input('sem',sql.Int,req.params.semanaId).query(`
SELECT a.IdAutorizacion,a.IdResolucion,a.SolicitadaPor,a.AprobadaPor,a.Estado,a.SolicitadaEn,a.AprobadaEn,a.ExpiraEn,a.UtilizadaEn,
       r.NumeroTurno,r.Tipo,r.IdParticipacion,ps.SembradorCorporativoId,e.IdEvaluacion
FROM dbo.AutorizacionCorreccion a
JOIN dbo.ResolucionTurno r ON r.IdResolucion=a.IdResolucion
JOIN dbo.ParticipacionSemanal ps ON ps.IdParticipacion=r.IdParticipacion
LEFT JOIN dbo.Evaluacion e ON e.IdResolucion=r.IdResolucion
WHERE ps.IdSemana=@sem
ORDER BY a.IdAutorizacion DESC`);
  res.json(r.recordset);
}catch(e){next(e);}});

app.post('/api/resoluciones/:id/autorizaciones-correccion',async(req,res,next)=>{try{
  const {solicitadaPor,aprobadaPor}=req.body||{};
  if(!solicitadaPor||!aprobadaPor)return res.status(400).json({error:'solicitadaPor y aprobadaPor son obligatorios'});
  const p=await getPool();const tx=new sql.Transaction(p);await tx.begin();
  try{
    const target=await new sql.Request(tx).input('rid',sql.BigInt,req.params.id).query(`
SELECT r.IdResolucion,r.Tipo,e.IdEvaluacion
FROM dbo.ResolucionTurno r
LEFT JOIN dbo.Evaluacion e ON e.IdResolucion=r.IdResolucion
WHERE r.IdResolucion=@rid`);
    const row=target.recordset[0];
    if(!row){await tx.rollback();return res.status(404).json({error:'Resolución no encontrada'});}
    if(row.Tipo!=='EVALUACION'||!row.IdEvaluacion){await tx.rollback();return res.status(400).json({error:'Solo una evaluación real puede habilitarse para corrección'});}
    const existing=await new sql.Request(tx).input('rid2',sql.BigInt,req.params.id).query(`
SELECT TOP(1) * FROM dbo.AutorizacionCorreccion
WHERE IdResolucion=@rid2 AND Estado='AUTORIZADA' AND UtilizadaEn IS NULL AND (ExpiraEn IS NULL OR ExpiraEn>SYSUTCDATETIME())
ORDER BY IdAutorizacion DESC`);
    if(existing.recordset[0]){await tx.commit();return res.json(existing.recordset[0]);}
    const created=await new sql.Request(tx)
      .input('rid3',sql.BigInt,req.params.id)
      .input('sol',sql.NVarChar(100),solicitadaPor)
      .input('apr',sql.NVarChar(100),aprobadaPor)
      .query(`INSERT dbo.AutorizacionCorreccion(IdResolucion,SolicitadaPor,AprobadaPor,Estado,SolicitadaEn,AprobadaEn)
              OUTPUT INSERTED.*
              VALUES(@rid3,@sol,@apr,'AUTORIZADA',SYSUTCDATETIME(),SYSUTCDATETIME())`);
    await tx.commit();res.status(201).json(created.recordset[0]);
  }catch(e){try{await tx.rollback();}catch{}throw e;}
}catch(e){next(e);}});

app.put('/api/resoluciones/:id/correccion',async(req,res,next)=>{const pool=await getPool();const tx=new sql.Transaction(pool);try{
  await tx.begin();
  const {incumplimientos=[],usuarioCorporativoId}=req.body||{};
  if(!usuarioCorporativoId)return res.status(400).json({error:'usuarioCorporativoId es obligatorio'});
  const target=await new sql.Request(tx).input('rid',sql.BigInt,req.params.id).query(`
SELECT r.IdResolucion,r.Tipo,r.IdParticipacion,r.NumeroTurno,e.IdEvaluacion,s.Estado AS EstadoSemana
FROM dbo.ResolucionTurno r
JOIN dbo.Evaluacion e ON e.IdResolucion=r.IdResolucion
JOIN dbo.ParticipacionSemanal ps ON ps.IdParticipacion=r.IdParticipacion
JOIN dbo.SemanaEvaluacion s ON s.IdSemana=ps.IdSemana
WHERE r.IdResolucion=@rid`);
  const row=target.recordset[0];if(!row){await tx.rollback();return res.status(404).json({error:'Evaluación no encontrada'});}
  const auth=await new sql.Request(tx).input('rid2',sql.BigInt,req.params.id).query(`
SELECT TOP(1) IdAutorizacion FROM dbo.AutorizacionCorreccion
WHERE IdResolucion=@rid2 AND Estado='AUTORIZADA' AND UtilizadaEn IS NULL AND (ExpiraEn IS NULL OR ExpiraEn>SYSUTCDATETIME())
ORDER BY IdAutorizacion DESC`);
  let directAllowed=false;if(row.EstadoSemana==='ABIERTA'){const recent=await new sql.Request(tx).input('pidRecent',sql.Int,row.IdParticipacion).query("SELECT TOP(2) r.IdResolucion FROM dbo.ResolucionTurno r JOIN dbo.Evaluacion e ON e.IdResolucion=r.IdResolucion WHERE r.IdParticipacion=@pidRecent AND r.Tipo='EVALUACION' ORDER BY r.NumeroTurno DESC,r.IdResolucion DESC");directAllowed=recent.recordset.some(x=>Number(x.IdResolucion)===Number(row.IdResolucion));}
  if(!directAllowed&&!auth.recordset[0]){await tx.rollback();return res.status(403).json({error:'La evaluación requiere autorización vigente del Analista'});}
  const before=await new sql.Request(tx).input('eid0',sql.BigInt,row.IdEvaluacion).query('SELECT IdItem FROM dbo.Incumplimiento WHERE IdEvaluacion=@eid0 ORDER BY IdItem');
  const beforeIds=before.recordset.map(x=>Number(x.IdItem)).filter(Number.isInteger);
  const afterIds=[...new Set(incumplimientos.map(Number).filter(Number.isInteger))];
  await new sql.Request(tx).input('eid1',sql.BigInt,row.IdEvaluacion).query('DELETE FROM dbo.Incumplimiento WHERE IdEvaluacion=@eid1');
  for(const itemId of afterIds) await new sql.Request(tx).input('eid2',sql.BigInt,row.IdEvaluacion).input('iid',sql.Int,itemId).query('INSERT dbo.Incumplimiento(IdEvaluacion,IdItem) VALUES(@eid2,@iid)');
  await new sql.Request(tx)
    .input('eidAudit',sql.BigInt,row.IdEvaluacion)
    .input('uidAudit',sql.NVarChar(100),usuarioCorporativoId)
    .input('antesAudit',sql.NVarChar(sql.MAX),JSON.stringify(beforeIds))
    .input('despuesAudit',sql.NVarChar(sql.MAX),JSON.stringify(afterIds))
    .input('aidAudit',sql.BigInt,auth.recordset[0]?auth.recordset[0].IdAutorizacion:null)
    .query(`INSERT dbo.AuditoriaCorreccion(IdEvaluacion,UsuarioCorporativoId,EstadoAntes,EstadoDespues,IdAutorizacion)
            VALUES(@eidAudit,@uidAudit,@antesAudit,@despuesAudit,@aidAudit)`);
  if(auth.recordset[0])await new sql.Request(tx).input('aid',sql.BigInt,auth.recordset[0].IdAutorizacion).query("UPDATE dbo.AutorizacionCorreccion SET Estado='UTILIZADA',UtilizadaEn=SYSUTCDATETIME() WHERE IdAutorizacion=@aid");
  await tx.commit();res.json({ok:true,idResolucion:row.IdResolucion,idEvaluacion:row.IdEvaluacion,autorizacionUtilizada:auth.recordset[0]?auth.recordset[0].IdAutorizacion:null});
}catch(e){try{await tx.rollback();}catch{}next(e);}});

app.get('/api/reportes/conformidad/:semanaId',async(req,res,next)=>{try{const p=await getPool();const r=await p.request().input('sem',sql.Int,req.params.semanaId).query('EXEC dbo.sp_ConformidadIndividual @IdSemana=@sem');res.json(r.recordset);}catch(e){next(e);}});
app.use((err,_req,res,_next)=>{console.error(err);res.status(500).json({error:'Error interno',detail:process.env.NODE_ENV==='production'?undefined:err.message});});
const port=Number(process.env.PORT||3000);
app.listen(port,()=>console.log(`API Evaluación Siembra en puerto ${port}`));