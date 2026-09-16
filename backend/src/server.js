const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { sql, getPool } = require('./db');

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : true }));
app.use(express.json());

app.get('/api/health', async (_req,res,next)=>{ try { const pool=await getPool(); await pool.request().query('SELECT 1 AS ok'); res.json({ok:true,database:true}); } catch(e){next(e);} });

app.get('/api/items', async (_req,res,next)=>{try{const p=await getPool();const r=await p.request().query('SELECT IdItem AS id, Codigo AS codigo, Nombre AS nombre, EsCritico AS esCritico, Activo AS activo FROM dbo.ItemEvaluacion WHERE Activo=1 ORDER BY Orden,IdItem');res.json(r.recordset);}catch(e){next(e);}});

app.get('/api/semanas/:anio(\\d+)/:numero(\\d+)', async(req,res,next)=>{try{const p=await getPool();const r=await p.request().input('anio',sql.SmallInt,req.params.anio).input('numero',sql.TinyInt,req.params.numero).query('SELECT * FROM dbo.SemanaEvaluacion WHERE AnioEvaluacion=@anio AND NumeroSemana=@numero');if(!r.recordset[0])return res.status(404).json({error:'Semana no encontrada'});res.json(r.recordset[0]);}catch(e){next(e);}});

app.post('/api/semanas/asegurar', async(req,res,next)=>{try{const {anio,numero,inicio,fin}=req.body;const p=await getPool();const r=await p.request().input('anio',sql.SmallInt,anio).input('numero',sql.TinyInt,numero).input('inicio',sql.Date,inicio).input('fin',sql.Date,fin).query(`IF NOT EXISTS(SELECT 1 FROM dbo.SemanaEvaluacion WHERE AnioEvaluacion=@anio AND NumeroSemana=@numero) INSERT dbo.SemanaEvaluacion(AnioEvaluacion,NumeroSemana,FechaInicio,FechaFin,Estado) VALUES(@anio,@numero,@inicio,@fin,'ABIERTA'); SELECT * FROM dbo.SemanaEvaluacion WHERE AnioEvaluacion=@anio AND NumeroSemana=@numero;`);res.status(201).json(r.recordset[0]);}catch(e){next(e);}});

app.get('/api/semanas/:semanaId/participantes',async(req,res,next)=>{try{const p=await getPool();const r=await p.request().input('id',sql.Int,req.params.semanaId).query('SELECT * FROM dbo.ParticipacionSemanal WHERE IdSemana=@id ORDER BY IdParticipacion');res.json(r.recordset);}catch(e){next(e);}});

app.post('/api/semanas/:semanaId/participantes',async(req,res,next)=>{try{const {sembradorId,turnoInicio}=req.body;const p=await getPool();const r=await p.request().input('sem',sql.Int,req.params.semanaId).input('sid',sql.NVarChar(100),sembradorId).input('turno',sql.SmallInt,turnoInicio).query(`INSERT dbo.ParticipacionSemanal(IdSemana,SembradorCorporativoId,TurnoInicio,Estado) OUTPUT INSERTED.* VALUES(@sem,@sid,@turno,'EN_LA_SEMANA')`);res.status(201).json(r.recordset[0]);}catch(e){next(e);}});

app.post('/api/participaciones/:id/turnos/:turno/resolver',async(req,res,next)=>{const pool=await getPool();const tx=new sql.Transaction(pool);try{await tx.begin();const {tipo,incumplimientos=[],usuarioCorporativoId}=req.body;const request=new sql.Request(tx);const rr=await request.input('pid',sql.Int,req.params.id).input('turno',sql.SmallInt,req.params.turno).input('tipo',sql.VarChar(20),tipo).input('uid',sql.NVarChar(100),usuarioCorporativoId).query(`INSERT dbo.ResolucionTurno(IdParticipacion,NumeroTurno,Tipo,UsuarioCorporativoId) OUTPUT INSERTED.IdResolucion VALUES(@pid,@turno,@tipo,@uid)`);const idResolucion=rr.recordset[0].IdResolucion;if(tipo==='EVALUACION'){const er=await new sql.Request(tx).input('rid',sql.BigInt,idResolucion).input('uid2',sql.NVarChar(100),usuarioCorporativoId).query(`INSERT dbo.Evaluacion(IdResolucion,UsuarioCorporativoId) OUTPUT INSERTED.IdEvaluacion VALUES(@rid,@uid2)`);const eid=er.recordset[0].IdEvaluacion;for(const itemId of [...new Set(incumplimientos)]) await new sql.Request(tx).input('eid',sql.BigInt,eid).input('iid',sql.Int,itemId).query('INSERT dbo.Incumplimiento(IdEvaluacion,IdItem) VALUES(@eid,@iid)');}await tx.commit();res.status(201).json({ok:true,idResolucion});}catch(e){try{await tx.rollback();}catch{}next(e);}});

app.get('/api/reportes/conformidad/:semanaId',async(req,res,next)=>{try{const p=await getPool();const r=await p.request().input('sem',sql.Int,req.params.semanaId).query('EXEC dbo.sp_ConformidadIndividual @IdSemana=@sem');res.json(r.recordset);}catch(e){next(e);}});

app.use((err,_req,res,_next)=>{console.error(err);res.status(500).json({error:'Error interno',detail:process.env.NODE_ENV==='production'?undefined:err.message});});
const port=Number(process.env.PORT||3000);
app.listen(port,()=>console.log(`API Evaluación Siembra en puerto ${port}`));