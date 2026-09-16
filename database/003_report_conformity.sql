CREATE OR ALTER PROCEDURE dbo.sp_ConformidadIndividual @IdSemana INT AS
BEGIN
 SET NOCOUNT ON;
 ;WITH M AS(
  SELECT p.IdParticipacion,p.SembradorCorporativoId,COUNT(e.IdEvaluacion) MuestrasReales,
         SUM(CASE WHEN e.IdEvaluacion IS NOT NULL AND NOT EXISTS(SELECT 1 FROM dbo.Incumplimiento i WHERE i.IdEvaluacion=e.IdEvaluacion) THEN 1 ELSE 0 END) MuestrasConformes
  FROM dbo.ParticipacionSemanal p
  LEFT JOIN dbo.ResolucionTurno r ON r.IdParticipacion=p.IdParticipacion AND r.Tipo='EVALUACION'
  LEFT JOIN dbo.Evaluacion e ON e.IdResolucion=r.IdResolucion
  WHERE p.IdSemana=@IdSemana AND p.Estado='EN_LA_SEMANA'
  GROUP BY p.IdParticipacion,p.SembradorCorporativoId
 ), F AS(
  SELECT p.IdParticipacion,i.IdItem,COUNT(*) Fallos
  FROM dbo.ParticipacionSemanal p JOIN dbo.ResolucionTurno r ON r.IdParticipacion=p.IdParticipacion AND r.Tipo='EVALUACION'
  JOIN dbo.Evaluacion e ON e.IdResolucion=r.IdResolucion JOIN dbo.Incumplimiento i ON i.IdEvaluacion=e.IdEvaluacion
  WHERE p.IdSemana=@IdSemana GROUP BY p.IdParticipacion,i.IdItem
 )
 SELECT m.SembradorCorporativoId,m.MuestrasReales,m.MuestrasConformes,
        CASE WHEN m.MuestrasReales=0 THEN NULL ELSE CAST(100.0*m.MuestrasConformes/m.MuestrasReales AS DECIMAL(6,2)) END ConformidadTotal,
        it.IdItem,it.Codigo,it.Nombre,ISNULL(f.Fallos,0) Incumplimientos,
        CASE WHEN m.MuestrasReales=0 THEN NULL ELSE CAST(100.0*(m.MuestrasReales-ISNULL(f.Fallos,0))/m.MuestrasReales AS DECIMAL(6,2)) END ConformidadItem
 FROM M m CROSS JOIN dbo.ItemEvaluacion it LEFT JOIN F f ON f.IdParticipacion=m.IdParticipacion AND f.IdItem=it.IdItem
 WHERE it.Activo=1 ORDER BY m.SembradorCorporativoId,it.Orden;
END;