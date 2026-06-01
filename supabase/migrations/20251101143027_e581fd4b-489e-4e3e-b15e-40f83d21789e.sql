-- Add import_id to fuel_prices to track which import each record came from
ALTER TABLE fuel_prices 
ADD COLUMN import_id uuid REFERENCES fuel_price_imports(id) ON DELETE CASCADE;

-- Create index for better performance when deleting by import_id
CREATE INDEX idx_fuel_prices_import_id ON fuel_prices(import_id);