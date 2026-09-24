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

async function ensureEvaluationItems(pool){
  await pool.request().query(`
    UPDATE dbo.ItemEvaluacion SET Nombre='Planta inclinada' WHERE Codigo='c1';
    UPDATE dbo.ItemEvaluacion SET Nombre='Distribución' WHERE Codigo='c2';
    UPDATE dbo.ItemEvaluacion SET Nombre='Estado de planta' WHERE Codigo='c3';
    UPDATE dbo.ItemEvaluacion SET Nombre='Profundidad de la planta' WHERE Codigo='c4';
    UPDATE dbo.ItemEvaluacion SET Nombre='Selección de esquejes' WHERE Codigo='c5';
    UPDATE dbo.ItemEvaluacion SET Nombre='EPPS' WHERE Codigo='c6';
    UPDATE dbo.ItemEvaluacion SET Nombre='Aseo sitio de trabajo' WHERE Codigo='c7';
    UPDATE dbo.ItemEvaluacion SET Nombre='Acuerdos de oro' WHERE Codigo='c8';
    UPDATE dbo.ItemEvaluacion SET Nombre='Siembra con marcador' WHERE Codigo='c9';
    UPDATE dbo.ItemEvaluacion SET Nombre='Ubicación de mangueras' WHERE Codigo='c10';
    IF NOT EXISTS(SELECT 1 FROM dbo.ItemEvaluacion WHERE Codigo='c11')
      INSERT dbo.ItemEvaluacion(Codigo,Nombre,EsCritico,Activo,Orden) VALUES('c11','Conteo de líneas',0,1,11);
    ELSE UPDATE dbo.ItemEvaluacion SET Nombre='Conteo de líneas',Activo=1,Orden=11 WHERE Codigo='c11';
    IF NOT EXISTS(SELECT 1 FROM dbo.ItemEvaluacion WHERE Codigo='c12')
      INSERT dbo.ItemEvaluacion(Codigo,Nombre,EsCritico,Activo,Orden) VALUES('c12','Densidad',0,1,12);
    ELSE UPDATE dbo.ItemEvaluacion SET Nombre='Densidad',Activo=1,Orden=12,EsCritico=0 WHERE Codigo='c12';
    UPDATE dbo.ItemEvaluacion SET EsCritico=0;
  `);
}

app.get('/api/health', async (_req,res,next)=>{ try { const pool=await getPool(); await pool.request().query('SELECT 1 AS ok'); res.json({ok:true,database:true}); } catch(e){next(e);} });
app.get('/api/items', async (_req,res,next)=>{try{const p=await getPool();await ensureEvaluationItems(p);const r=await p.request().query('SELECT IdItem AS id, Codigo AS codigo, Nombre AS nombre, EsCritico AS esCritico, Activo AS activo FROM dbo.ItemEvaluacion WHERE Activo=1 ORDER BY Orden,IdItem');res.json(r.recordset);}catch(e){next(e);}});
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
app.get('/api/historial-incumplimientos',async(_req,res,next)=>{try{
  const p=await getPool();
  const r=await p.request().query(`
    SELECT s.IdSemana,s.AnioEvaluacion,s.NumeroSemana,
      ps.SembradorCorporativoId,rt.NumeroTurno,e.IdEvaluacion,
      i.IdItem,i.Codigo AS CodigoItem,i.Nombre AS NombreItem
    FROM dbo.Incumplimiento inc
    JOIN dbo.Evaluacion e ON e.IdEvaluacion=inc.IdEvaluacion
    JOIN dbo.ResolucionTurno rt ON rt.IdResolucion=e.IdResolucion
    JOIN dbo.ParticipacionSemanal ps ON ps.IdParticipacion=rt.IdParticipacion
    JOIN dbo.SemanaEvaluacion s ON s.IdSemana=ps.IdSemana
    JOIN dbo.ItemEvaluacion i ON i.IdItem=inc.IdItem
    ORDER BY s.AnioEvaluacion DESC,s.NumeroSemana DESC,ps.SembradorCorporativoId,rt.NumeroTurno DESC,i.Orden,i.IdItem
  `);
  res.json(r.recordset);
}catch(e){next(e);}});
app.get('/api/offline/bootstrap',async(_req,res,next)=>{try{
  const p=await getPool();await ensureParticipationIntervals(p);await ensureEvaluationItems(p);
  const items=(await p.request().query("SELECT IdItem AS id,Codigo AS codigo,Nombre AS nombre,EsCritico AS esCritico,Activo AS activo,Orden AS orden FROM dbo.ItemEvaluacion WHERE Activo=1 ORDER BY Orden,IdItem")).recordset;
  const weeks=(await p.request().query("SELECT TOP (8) IdSemana,AnioEvaluacion,NumeroSemana,FechaInicio,FechaFin,Estado,FechaCierre FROM dbo.SemanaEvaluacion ORDER BY AnioEvaluacion DESC,NumeroSemana DESC,IdSemana DESC")).recordset;
  const ids=weeks.map(w=>Number(w.IdSemana)).filter(Boolean);
  let operational=[];
  if(ids.length){
    operational=(await p.request().query(`SELECT ps.IdSemana,ps.IdParticipacion,ps.SembradorCorporativoId,ps.TurnoInicio,ps.Estado,
      rt.IdResolucion,rt.NumeroTurno,rt.Tipo,rt.ResueltoEn,e.IdEvaluacion,i.Codigo AS CodigoItem
      FROM dbo.ParticipacionSemanal ps
      LEFT JOIN dbo.ResolucionTurno rt ON rt.IdParticipacion=ps.IdParticipacion
      LEFT JOIN dbo.Evaluacion e ON e.IdResolucion=rt.IdResolucion
      LEFT JOIN dbo.Incumplimiento inc ON inc.IdEvaluacion=e.IdEvaluacion
      LEFT JOIN dbo.ItemEvaluacion i ON i.IdItem=inc.IdItem
      WHERE ps.IdSemana IN (${ids.join(',')})
      ORDER BY ps.IdSemana DESC,ps.IdParticipacion,rt.NumeroTurno,i.Orden,i.IdItem`)).recordset;
  }
  res.json({generatedAt:new Date().toISOString(),items,weeks,operational});
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

app.patch('/api/semanas/:semanaId/no-evaluada',async(req,res,next)=>{try{
  const p=await getPool();
  const activity=await p.request().input('sem',sql.Int,req.params.semanaId).query(`
    SELECT s.Estado,
      (SELECT COUNT(*) FROM dbo.ParticipacionSemanal ps JOIN dbo.ResolucionTurno rt ON rt.IdParticipacion=ps.IdParticipacion WHERE ps.IdSemana=s.IdSemana) AS Resoluciones
    FROM dbo.SemanaEvaluacion s WHERE s.IdSemana=@sem`);
  const row=activity.recordset[0];
  if(!row)return res.status(404).json({error:'Semana no encontrada'});
  if(Number(row.Resoluciones)>0)return res.status(409).json({error:'La semana tiene actividad y no puede marcarse como no evaluada'});
  const updated=await p.request().input('id',sql.Int,req.params.semanaId).query(`UPDATE dbo.SemanaEvaluacion SET Estado='NO_EVALUADA',FechaCierre=SYSDATETIME() OUTPUT INSERTED.* WHERE IdSemana=@id AND Estado='ABIERTA'`);
  if(updated.recordset[0])return res.json(updated.recordset[0]);
  if(row.Estado==='NO_EVALUADA')return res.json(row);
  return res.status(409).json({error:'La semana no está abierta'});
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
app.post('/api/semanas/:semanaId/participantes',async(req,res,next)=>{try{const {sembradorId,turnoInicio,registradoEn}=req.body;const p=await getPool();await ensureParticipationIntervals(p);const gate=await p.request().input('semGate',sql.Int,req.params.semanaId).query(`SELECT Estado,FechaInicio,FechaFin,CONVERT(date,SYSDATETIMEOFFSET() AT TIME ZONE 'SA Pacific Standard Time') AS Hoy FROM dbo.SemanaEvaluacion WHERE IdSemana=@semGate`);const gw=gate.recordset[0];if(!gw)return res.status(404).json({error:'Semana no encontrada'});if(gw.Estado!=='ABIERTA')return res.status(409).json({error:'La semana no está abierta'});const offlineDate=registradoEn?new Date(registradoEn):null;const recordedInside=offlineDate&&!Number.isNaN(offlineDate.getTime())&&offlineDate>=new Date(gw.FechaInicio)&&offlineDate<new Date(new Date(gw.FechaFin).getTime()+86400000);if(new Date(gw.Hoy)>new Date(gw.FechaFin)&&!recordedInside)return res.status(409).json({error:'SEMANA_VENCIDA',detail:'El tiempo calendario de esta semana terminó. Debe cerrarla o marcarla como no evaluada.'});const tx=new sql.Transaction(p);await tx.begin();try{const r=await new sql.Request(tx).input('sem',sql.Int,req.params.semanaId).input('sid',sql.NVarChar(100),sembradorId).input('turno',sql.SmallInt,turnoInicio).query(`INSERT dbo.ParticipacionSemanal(IdSemana,SembradorCorporativoId,TurnoInicio,Estado) OUTPUT INSERTED.* VALUES(@sem,@sid,@turno,'EN_LA_SEMANA')`);const row=r.recordset[0];await new sql.Request(tx).input('pid',sql.Int,row.IdParticipacion).input('turno',sql.SmallInt,turnoInicio).query('INSERT dbo.TramoParticipacion(IdParticipacion,TurnoInicio) VALUES(@pid,@turno)');await tx.commit();res.status(201).json(row);}catch(e){await tx.rollback();throw e;}}catch(e){next(e);}});
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
app.post('/api/participaciones/:id/turnos/:turno/resolver',async(req,res,next)=>{const pool=await getPool();const gate=await pool.request().input('pidGate',sql.Int,req.params.id).query(`SELECT s.Estado,s.FechaInicio,s.FechaFin,CONVERT(date,SYSDATETIMEOFFSET() AT TIME ZONE 'SA Pacific Standard Time') AS Hoy FROM dbo.ParticipacionSemanal p JOIN dbo.SemanaEvaluacion s ON s.IdSemana=p.IdSemana WHERE p.IdParticipacion=@pidGate`);const gw=gate.recordset[0];if(!gw)return res.status(404).json({error:'Participación no encontrada'});if(gw.Estado!=='ABIERTA')return res.status(409).json({error:'La semana no está abierta'});const offlineDate=req.body?.registradoEn?new Date(req.body.registradoEn):null;const recordedInside=offlineDate&&!Number.isNaN(offlineDate.getTime())&&offlineDate>=new Date(gw.FechaInicio)&&offlineDate<new Date(new Date(gw.FechaFin).getTime()+86400000);if(new Date(gw.Hoy)>new Date(gw.FechaFin)&&!recordedInside)return res.status(409).json({error:'SEMANA_VENCIDA',detail:'El tiempo calendario de esta semana terminó. Ya no admite evaluaciones ni muestras no realizadas.'});const tx=new sql.Transaction(pool);try{await tx.begin();const {tipo,incumplimientos=[],usuarioCorporativoId}=req.body;const request=new sql.Request(tx);const rr=await request.input('pid',sql.Int,req.params.id).input('turno',sql.SmallInt,req.params.turno).input('tipo',sql.VarChar(20),tipo).input('uid',sql.NVarChar(100),usuarioCorporativoId).query(`INSERT dbo.ResolucionTurno(IdParticipacion,NumeroTurno,Tipo,UsuarioCorporativoId) OUTPUT INSERTED.IdResolucion VALUES(@pid,@turno,@tipo,@uid)`);const idResolucion=rr.recordset[0].IdResolucion;if(tipo==='EVALUACION'){const er=await new sql.Request(tx).input('rid',sql.BigInt,idResolucion).input('uid2',sql.NVarChar(100),usuarioCorporativoId).query(`INSERT dbo.Evaluacion(IdResolucion,UsuarioCorporativoId) OUTPUT INSERTED.IdEvaluacion VALUES(@rid,@uid2)`);const eid=er.recordset[0].IdEvaluacion;for(const itemId of [...new Set(incumplimientos)]) await new sql.Request(tx).input('eid',sql.BigInt,eid).input('iid',sql.Int,itemId).query('INSERT dbo.Incumplimiento(IdEvaluacion,IdItem) VALUES(@eid,@iid)');}await tx.commit();res.status(201).json({ok:true,idResolucion});}catch(e){try{await tx.rollback();}catch{}next(e);}});
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

async function importWeek49FromFieldSheet(){
  const pool=await getPool();
  await ensureEvaluationItems(pool);
  const workers=[
    ['092135','GONZALEZ VALENCIA CAROLINA',{}],
    ['201656','TEHERAN RUIZ LINA PATRICIA',{}],
    ['027645','CARDONA GALLEGO YESICA ALEXANDRA',{4:'c2'}],
    ['027487','CARDONA CORREA MARIA VIVIANA',{16:'c2'}],
    ['207479','GALEANO BEDOYA FRANCY DAYELI',{19:'c1'}],
    ['019064','GONZALEZ CARDONA ANA SOFIA',{3:'c11'}],
    ['069522','MEDINA OSPINA ANGIE TATIANA',{6:'c2'}],
    ['033119','OCAMPO CASTAÑO OLGA LUCIA',{6:'c2'}],
    ['058785','RAMIREZ URIBE MARIA LILIANA',{8:'c1'}],
    ['011573','RENDON OTALVARO RUBIELA',{23:'c1'}],
    ['201652','SUAREZ GARCES LUCIANA',{6:'c1'}],
    ['011601','VALLEJO ROMAN HERSILIA',{6:'c2'}]
  ];
  const rows=[];
  for(const [id,_name,failures] of workers){
    for(let turn=1;turn<=25;turn++)rows.push({id,turn,code:failures[turn]||null});
  }
  const tx=new sql.Transaction(pool);await tx.begin();
  try{
    const existing=await new sql.Request(tx).query(`
      SELECT s.IdSemana,s.Estado,
        (SELECT COUNT(*) FROM dbo.ParticipacionSemanal p WHERE p.IdSemana=s.IdSemana) Participantes,
        (SELECT COUNT(*) FROM dbo.ResolucionTurno r JOIN dbo.ParticipacionSemanal p ON p.IdParticipacion=r.IdParticipacion WHERE p.IdSemana=s.IdSemana) Resoluciones
      FROM dbo.SemanaEvaluacion s WHERE s.AnioEvaluacion=2026 AND s.NumeroSemana=49`);
    if(existing.recordset[0]){
      const e=existing.recordset[0];
      if(Number(e.Participantes)===12&&Number(e.Resoluciones)===300){await tx.commit();return;}
      throw new Error('Semana 49 ya existe con datos distintos; importación automática cancelada para no sobrescribirlos.');
    }
    const prior=await new sql.Request(tx).query("SELECT TOP(1) FechaInicio,FechaFin FROM dbo.SemanaEvaluacion WHERE AnioEvaluacion=2026 AND NumeroSemana=48");
    if(!prior.recordset[0])throw new Error('No existe la Semana 48; no se puede derivar el período de la Semana 49.');
    await new sql.Request(tx).query(`
      DECLARE @inicio date=(SELECT FechaInicio FROM dbo.SemanaEvaluacion WHERE AnioEvaluacion=2026 AND NumeroSemana=48);
      DECLARE @fin date=(SELECT FechaFin FROM dbo.SemanaEvaluacion WHERE AnioEvaluacion=2026 AND NumeroSemana=48);
      INSERT dbo.SemanaEvaluacion(AnioEvaluacion,NumeroSemana,FechaInicio,FechaFin,Estado)
      VALUES(2026,49,DATEADD(day,7,@inicio),DATEADD(day,7,@fin),'ABIERTA');`);
    const week=(await new sql.Request(tx).query("SELECT IdSemana FROM dbo.SemanaEvaluacion WHERE AnioEvaluacion=2026 AND NumeroSemana=49")).recordset[0];
    for(const [id] of workers){
      const pr=await new sql.Request(tx).input('sem',sql.Int,week.IdSemana).input('sid',sql.NVarChar(100),id).query("INSERT dbo.ParticipacionSemanal(IdSemana,SembradorCorporativoId,TurnoInicio,Estado) OUTPUT INSERTED.IdParticipacion VALUES(@sem,@sid,1,'EN_LA_SEMANA')");
      await new sql.Request(tx).input('pid',sql.Int,pr.recordset[0].IdParticipacion).query("INSERT dbo.TramoParticipacion(IdParticipacion,TurnoInicio) VALUES(@pid,1)");
    }
    await new sql.Request(tx).input('payload',sql.NVarChar(sql.MAX),JSON.stringify(rows)).query(`
      DECLARE @uid nvarchar(100)=N'importacion-semana49-imagen';
      DECLARE @sid nvarchar(100),@turn smallint,@code varchar(20),@pid int,@rid bigint,@eid bigint,@iid int;
      DECLARE cur CURSOR LOCAL FAST_FORWARD FOR
        SELECT j.id,j.turno,j.code FROM OPENJSON(@payload)
        WITH(id nvarchar(100) '$.id',turno smallint '$.turn',code varchar(20) '$.code') j ORDER BY j.id,j.turno;
      OPEN cur; FETCH NEXT FROM cur INTO @sid,@turn,@code;
      WHILE @@FETCH_STATUS=0
      BEGIN
        SELECT @pid=p.IdParticipacion FROM dbo.ParticipacionSemanal p
          JOIN dbo.SemanaEvaluacion s ON s.IdSemana=p.IdSemana
          WHERE s.AnioEvaluacion=2026 AND s.NumeroSemana=49 AND p.SembradorCorporativoId=@sid;
        INSERT dbo.ResolucionTurno(IdParticipacion,NumeroTurno,Tipo,UsuarioCorporativoId)
          VALUES(@pid,@turn,'EVALUACION',@uid); SET @rid=SCOPE_IDENTITY();
        INSERT dbo.Evaluacion(IdResolucion,UsuarioCorporativoId) VALUES(@rid,@uid); SET @eid=SCOPE_IDENTITY();
        IF @code IS NOT NULL
        BEGIN
          SELECT @iid=IdItem FROM dbo.ItemEvaluacion WHERE Codigo=@code;
          IF @iid IS NULL THROW 50001,'Ítem de importación no encontrado',1;
          INSERT dbo.Incumplimiento(IdEvaluacion,IdItem) VALUES(@eid,@iid);
        END
        FETCH NEXT FROM cur INTO @sid,@turn,@code;
      END
      CLOSE cur; DEALLOCATE cur;`);
    await tx.commit();
    console.log('Semana 49 importada desde planilla: 12 sembradores, 300 evaluaciones.');
  }catch(error){try{await tx.rollback();}catch{}throw error;}
}

app.use((err,_req,res,_next)=>{console.error(err);res.status(500).json({error:'Error interno',detail:process.env.NODE_ENV==='production'?undefined:err.message});});
const port=Number(process.env.PORT||3000);
app.listen(port,async()=>{
  console.log(`API Evaluación Siembra en puerto ${port}`);
  try{await importWeek49FromFieldSheet();}catch(error){console.error('No se pudo importar Semana 49 desde la planilla.',error);}
});