MERGE dbo.ItemEvaluacion AS t
USING (VALUES
('c1',N'Inclinación',1,1),('c2',N'Distribución',0,2),('c3',N'Estado de planta',0,3),('c4',N'Profundidad',1,4),('c5',N'Selección de esquejes',1,5),('c6',N'EPP',1,6),('c7',N'Limpieza',0,7),('c8',N'Acuerdos de oro',1,8),('c9',N'Siembra con marcador',0,9),('c10',N'Manguera',0,10)
) s(Codigo,Nombre,EsCritico,Orden)
ON t.Codigo=s.Codigo
WHEN MATCHED THEN UPDATE SET Nombre=s.Nombre,EsCritico=s.EsCritico,Orden=s.Orden
WHEN NOT MATCHED THEN INSERT(Codigo,Nombre,EsCritico,Orden) VALUES(s.Codigo,s.Nombre,s.EsCritico,s.Orden);