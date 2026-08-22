INSERT INTO cities (name, country, region, cost_index, popularity)
VALUES ('Tokyo', 'Japan', 'Asia', 78, 92), ('Lisbon', 'Portugal', 'Europe', 52, 74)
ON CONFLICT (name, country) DO NOTHING;

INSERT INTO activities (city_id, name, category, default_cost, duration_min)
SELECT c.id, a.name, a.category, a.cost, a.duration
FROM cities c
JOIN (VALUES
  ('Tokyo','Japan','Senso-ji Temple','sightseeing', 0,   90),
  ('Tokyo','Japan','Tsukiji Outer Market food tour','food', 40, 120),
  ('Lisbon','Portugal','Belém Tower','sightseeing', 6,  60),
  ('Lisbon','Portugal','Fado dinner show','nightlife', 55, 150)
) AS a(city, country, name, category, cost, duration)
  ON a.city = c.name AND a.country = c.country
ON CONFLICT DO NOTHING;
