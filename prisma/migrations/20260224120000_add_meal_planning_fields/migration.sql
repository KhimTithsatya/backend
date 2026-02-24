-- AlterTable
ALTER TABLE `Meal`
  ADD COLUMN `plannedFor` DATETIME(3) NULL,
  ADD COLUMN `mealType` ENUM('BREAKFAST', 'LUNCH', 'DINNER', 'SNACK', 'OTHER') NOT NULL DEFAULT 'OTHER';

-- CreateIndex
CREATE INDEX `Meal_userId_plannedFor_idx` ON `Meal`(`userId`, `plannedFor`);
