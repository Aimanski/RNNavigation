-- Servings
alter table public.foods
  add column if not exists serving_g numeric not null default 100;

-- Estimates
update public.foods set serving_g = v.g
from (values
  ('Banana Smoothie with Milk', 240),
  ('Chicken Adobo (100g)', 100),
  ('Apple Peanut Crunch', 160),
  ('Banana Peanut Oat', 300),
  ('Creamy Protein Oats', 300),
  ('Egg and Cheese Sandwich', 120),
  ('Oatmeal with Apple and Cinnamon', 300),
  ('Oatmeal with Milk', 300),
  ('Peanut Butter with Banana', 200),
  ('Saba Banana (100g)', 100),
  ('Scrambled Eggs with Rice', 240),
  ('Chicken & Sweet Potato', 360),
  ('Chicken Soup with Vegetables', 300),
  ('Grilled Chicken Breast', 100),
  ('Tuna Veggie', 160),
  ('Beef Stir Fry with Rice', 360),
  ('Beef with Rice and Vegetables', 300),
  ('Chicken Adobo', 200),
  ('Chicken Curry with Rice', 300),
  ('Chicken Stir-Fry with Rice', 300),
  ('Chicken Teriyaki with Rice', 300),
  ('Eggs with Rice', 240),
  ('Grilled Chicken Pasta', 300),
  ('Tuna Fried Rice', 300),
  ('Yogurt with Peanut Butter', 200)
) as v(name, g)
where foods.name = v.name and foods.user_id is null;
