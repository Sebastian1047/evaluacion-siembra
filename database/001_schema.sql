SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF OBJECT_ID('dbo.SemanaEvaluacion','U') IS NULL CREATE TABLE dbo.SemanaEvaluacion(
 IdSemana INT IDENTITY(1,1) PRIMARY KEY,
 AnioEvaluacion SMALLINT NOT NULL,
 NumeroSemana TINYINT NOT NULL,
 FechaInicio DATE NOT NULL,
 FechaFin DATE NOT NULL,
 Estado VARCHAR(20) NOT NULL CONSTRAINT DF_Semana_Estado DEFAULT 'ABIERTA',
 FechaCierre DATETIME2 NULL,
 UsuarioCierreCorporativoId NVARCHAR(100) NULL,
 CreadoEn DATETIME2 NOT NULL CONSTRAINT DF_Semana_Creado DEFAULT SYSUTCDATETIME(),
 CONSTRAINT UQ_Semana_AnioNumero UNIQUE(AnioEvaluacion,NumeroSemana),
 CONSTRAINT UQ_Semana_Inicio UNIQUE(FechaInicio),
 CONSTRAINT CK_Semana_Estado CHECK(Estado IN('ABIERTA','CERRADA','NO_EVALUADA')),
 CONSTRAINT CK_Semana_Dias CHECK(DATEDIFF(DAY,FechaInicio,FechaFin)=6)
);

IF OBJECT_ID('dbo.ItemEvaluacion','U') IS NULL CREATE TABLE dbo.ItemEvaluacion(
 IdItem INT IDENTITY(1,1) PRIMARY KEY, Codigo VARCHAR(30) NOT NULL UNIQUE, Nombre NVARCHAR(150) NOT NULL,
 EsCritico BIT NOT NULL DEFAULT 0, Activo BIT NOT NULL DEFAULT 1, Orden SMALLINT NOT NULL, VigenteDesde DATE NULL,
 CreadoEn DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);

IF OBJECT_ID('dbo.ParticipacionSemanal','U') IS NULL CREATE TABLE dbo.ParticipacionSemanal(
 IdParticipacion INT IDENTITY(1,1) PRIMARY KEY, IdSemana INT NOT NULL,
 SembradorCorporativoId NVARCHAR(100) NOT NULL, TurnoInicio SMALLINT NOT NULL,
 Estado VARCHAR(30) NOT NULL DEFAULT 'EN_LA_SEMANA', CreadoEn DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
 CONSTRAINT FK_Participacion_Semana FOREIGN KEY(IdSemana) REFERENCES dbo.SemanaEvaluacion(IdSemana),
 CONSTRAINT UQ_Participacion UNIQUE(IdSemana,SembradorCorporativoId),
 CONSTRAINT CK_Participacion_Estado CHECK(Estado IN('EN_LA_SEMANA','QUITADO_TEMPORALMENTE')),
 CONSTRAINT CK_Participacion_Turno CHECK(TurnoInicio>=1)
);

IF OBJECT_ID('dbo.ResolucionTurno','U') IS NULL CREATE TABLE dbo.ResolucionTurno(
 IdResolucion BIGINT IDENTITY(1,1) PRIMARY KEY, IdParticipacion INT NOT NULL, NumeroTurno SMALLINT NOT NULL,
 Tipo VARCHAR(20) NOT NULL, UsuarioCorporativoId NVARCHAR(100) NOT NULL,
 ResueltoEn DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
 CONSTRAINT FK_Resolucion_Participacion FOREIGN KEY(IdParticipacion) REFERENCES dbo.ParticipacionSemanal(IdParticipacion),
 CONSTRAINT UQ_Resolucion_Turno UNIQUE(IdParticipacion,NumeroTurno),
 CONSTRAINT CK_Resolucion_Tipo CHECK(Tipo IN('EVALUACION','NO_REALIZADA')),
 CONSTRAINT CK_Resolucion_Numero CHECK(NumeroTurno>=1)
);

IF OBJECT_ID('dbo.Evaluacion','U') IS NULL CREATE TABLE dbo.Evaluacion(
 IdEvaluacion BIGINT IDENTITY(1,1) PRIMARY KEY, IdResolucion BIGINT NOT NULL UNIQUE,
 UsuarioCorporativoId NVARCHAR(100) NOT NULL, EvaluadaEn DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
 CONSTRAINT FK_Evaluacion_Resolucion FOREIGN KEY(IdResolucion) REFERENCES dbo.ResolucionTurno(IdResolucion)
);

IF OBJECT_ID('dbo.Incumplimiento','U') IS NULL CREATE TABLE dbo.Incumplimiento(
 IdIncumplimiento BIGINT IDENTITY(1,1) PRIMARY KEY, IdEvaluacion BIGINT NOT NULL, IdItem INT NOT NULL,
 CONSTRAINT FK_Incumplimiento_Evaluacion FOREIGN KEY(IdEvaluacion) REFERENCES dbo.Evaluacion(IdEvaluacion),
 CONSTRAINT FK_Incumplimiento_Item FOREIGN KEY(IdItem) REFERENCES dbo.ItemEvaluacion(IdItem),
 CONSTRAINT UQ_Incumplimiento UNIQUE(IdEvaluacion,IdItem)
);

IF OBJECT_ID('dbo.AutorizacionCorreccion','U') IS NULL CREATE TABLE dbo.AutorizacionCorreccion(
 IdAutorizacion BIGINT IDENTITY(1,1) PRIMARY KEY, IdResolucion BIGINT NOT NULL,
 SolicitadaPor NVARCHAR(100) NOT NULL, AprobadaPor NVARCHAR(100) NULL,
 Estado VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE', SolicitadaEn DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
 AprobadaEn DATETIME2 NULL, ExpiraEn DATETIME2 NULL, UtilizadaEn DATETIME2 NULL,
 CONSTRAINT FK_Autorizacion_Resolucion FOREIGN KEY(IdResolucion) REFERENCES dbo.ResolucionTurno(IdResolucion),
 CONSTRAINT CK_Autorizacion_Estado CHECK(Estado IN('PENDIENTE','AUTORIZADA','RECHAZADA','UTILIZADA','EXPIRADA'))
);

IF OBJECT_ID('dbo.AuditoriaCorreccion','U') IS NULL CREATE TABLE dbo.AuditoriaCorreccion(
 IdAuditoria BIGINT IDENTITY(1,1) PRIMARY KEY, IdEvaluacion BIGINT NOT NULL,
 UsuarioCorporativoId NVARCHAR(100) NOT NULL, CorregidoEn DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
 EstadoAntes NVARCHAR(MAX) NOT NULL, EstadoDespues NVARCHAR(MAX) NOT NULL, IdAutorizacion BIGINT NULL,
 CONSTRAINT FK_Auditoria_Evaluacion FOREIGN KEY(IdEvaluacion) REFERENCES dbo.Evaluacion(IdEvaluacion),
 CONSTRAINT FK_Auditoria_Autorizacion FOREIGN KEY(IdAutorizacion) REFERENCES dbo.AutorizacionCorreccion(IdAutorizacion)
);

CREATE INDEX IX_Resolucion_Participacion ON dbo.ResolucionTurno(IdParticipacion,NumeroTurno);
CREATE INDEX IX_Incumplimiento_Item ON dbo.Incumplimiento(IdItem,IdEvaluacion);
CREATE INDEX IX_Participacion_Semana ON dbo.ParticipacionSemanal(IdSemana,Estado);

COMMIT TRANSACTION;