-- DropForeignKey
ALTER TABLE `Meal` DROP FOREIGN KEY `Meal_userId_fkey`;

-- DropIndex
DROP INDEX `Meal_userId_plannedFor_idx` ON `Meal`;

-- AddForeignKey
ALTER TABLE `Meal` ADD CONSTRAINT `Meal_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
