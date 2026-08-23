WITH cover_fixes(id, image_url) AS (
  VALUES
    ('dinossauros-irados', 'https://images.unsplash.com/photo-1548980397-dda45023c130?auto=format&fit=crop&w=1200&q=82'),
    ('piores-dia-aula', 'https://images.unsplash.com/photo-1744809482817-9a9d4fc280af?auto=format&fit=crop&w=1200&q=82'),
    ('comfort-foods', 'https://images.unsplash.com/photo-1667499989723-c4ab9549d63c?auto=format&fit=crop&crop=entropy&w=1200&q=82'),
    ('jogadoras-futebol', 'https://images.unsplash.com/photo-1535506349729-56e253fac2b1?auto=format&fit=crop&crop=faces&w=1200&q=82'),
    ('cafes-floripa', 'https://images.unsplash.com/photo-1561522983-385a76fbb4cb?auto=format&fit=crop&crop=entropy&w=1200&q=82'),
    ('restaurantes-veganos-floripa', 'https://images.unsplash.com/photo-1638328740227-1c4b1627614d?auto=format&fit=crop&crop=entropy&w=1200&q=82'),
    ('ferias-mais-legais', 'https://images.unsplash.com/photo-1576696058573-12b47c49559e?auto=format&fit=crop&w=1200&q=82'),
    ('lanches-recreio', 'https://images.unsplash.com/photo-1784979472083-dd3c4c109345?auto=format&fit=crop&w=1200&q=82'),
    ('mundos-games-morar', 'https://images.unsplash.com/photo-1775976964591-f9892ce54619?auto=format&fit=crop&w=1200&q=82'),
    ('jogos-roblox', 'https://images.unsplash.com/photo-1554410637-1a8267402b57?auto=format&fit=crop&w=1200&q=82'),
    ('desastres-date', 'https://images.unsplash.com/photo-1746046350750-4bd632433260?auto=format&fit=crop&w=1200&q=82')
)
UPDATE rankings AS ranking
SET image_url = cover_fixes.image_url
FROM cover_fixes
WHERE ranking.id = cover_fixes.id
RETURNING ranking.id, ranking.image_url;
