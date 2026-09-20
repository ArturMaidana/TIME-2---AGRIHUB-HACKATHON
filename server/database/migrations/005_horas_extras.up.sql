ALTER TABLE hr_indicators
  ADD COLUMN overtime_hours NUMERIC NOT NULL DEFAULT 0 CHECK(overtime_hours >= 0);
