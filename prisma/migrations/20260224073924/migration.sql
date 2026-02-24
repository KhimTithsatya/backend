-- DropForeignKey (guarded for shadow DBs where constraint may not exist)
SET @fk_exists := (
  SELECT COUNT(*)
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'Meal'
    AND CONSTRAINT_NAME = 'Meal_userId_fkey'
    AND CONSTRAINT_TYPE = 'FOREIGN KEY'
);
SET @drop_fk_sql := IF(@fk_exists > 0, 'ALTER TABLE `Meal` DROP FOREIGN KEY `Meal_userId_fkey`', 'SELECT 1');
PREPARE stmt_drop_fk FROM @drop_fk_sql;
EXECUTE stmt_drop_fk;
DEALLOCATE PREPARE stmt_drop_fk;

-- DropIndex (guarded for shadow DBs where index may not exist)
SET @idx_exists := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'Meal'
    AND INDEX_NAME = 'Meal_userId_plannedFor_idx'
);
SET @drop_idx_sql := IF(@idx_exists > 0, 'DROP INDEX `Meal_userId_plannedFor_idx` ON `Meal`', 'SELECT 1');
PREPARE stmt_drop_idx FROM @drop_idx_sql;
EXECUTE stmt_drop_idx;
DEALLOCATE PREPARE stmt_drop_idx;

-- AddForeignKey
ALTER TABLE `Meal` ADD CONSTRAINT `Meal_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
